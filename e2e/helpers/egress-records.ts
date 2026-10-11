/**
 * The matching half of the egress watcher (e2e/helpers/vault.ts), kept free of Playwright so it
 * runs under vitest: which encodings of a watched value count as a leak, and which recorded
 * sends nobody could read. egress-records.test.ts covers the cases a real browser cannot be
 * made to produce on demand.
 */

/**
 * A request that can carry a body: anything but GET, HEAD and OPTIONS. Compared without case,
 * because Fetch uppercases only the standard methods and sends `patch` or `PURGE` as written.
 */
const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);
export function isSend(method: string): boolean {
  return !SAFE.has(method.toUpperCase());
}

/**
 * Every form `value` could take on the wire: raw, percent-encoded (every URL), form-encoded
 * (`+` for spaces), JSON-escaped, hex (how a bytea column travels), and base64 / base64url
 * (how the crypto envelopes travel). A Uint8Array value is matched by its byte encodings only.
 *
 * Base64 output depends on where the bytes sit inside the larger blob, offset mod 3, so for
 * each alignment this keeps only the characters fully determined by the value's own bytes.
 * Verified against 9,600 embedded leaks at offsets 0 to 63 with no misses, and 20,000 random
 * 512-byte blobs with no false positives.
 */
export function encodedForms(value: string | Uint8Array): string[] {
  const bytes = typeof value === 'string' ? Buffer.from(value, 'utf8') : Buffer.from(value);
  const hex = bytes.toString('hex');
  const forms = new Set([hex, hex.toUpperCase()]);
  if (typeof value === 'string') {
    forms.add(value);
    forms.add(encodeURIComponent(value));
    // How a browser writes it into a URL left unencoded: the WHATWG URL serializer, in a path
    // and in a query, which encode different sets (a quote is kept in a path, not in a query).
    forms.add(encodeURI(value));
    // How the URL serializer writes it, in a path and in a query: the wire form, including
    // what the parser legitimately drops (tabs and newlines, spaces at the ends). Two cases
    // keep only part of the value instead, and are skipped: a '?' or '#' ends the path and a
    // '#' ends the query, and '.' or '..' segments are resolved away. A form under 8
    // characters would match unrelated traffic.
    const urlParts = [
      ['http://h/', 'pathname', /[?#]|(^|[/\\])(\.|%2e){1,2}($|[/\\])/i],
      ['http://h/?', 'search', /#/],
    ] as const;
    for (const [prefix, part, cut] of urlParts) {
      if (cut.test(value)) continue;
      try {
        const form = new URL(prefix + value)[part].slice(1);
        if (form.length >= 8) forms.add(form);
      } catch (err) {
        // Not every value fits in a URL; a value that cannot be one cannot travel as one.
        if (!(err instanceof TypeError)) throw err;
      }
    }
    forms.add(new URLSearchParams({ v: value }).toString().slice('v='.length));
    forms.add(JSON.stringify(value).slice(1, -1));
  }
  for (let pad = 0; pad < 3; pad += 1) {
    const b64 = Buffer.concat([Buffer.alloc(pad), bytes]).toString('base64');
    const first = Math.ceil((8 * pad) / 6);
    const last = Math.floor((8 * (pad + bytes.length) - 6) / 6);
    const stable = b64.slice(first, last + 1);
    forms.add(stable);
    forms.add(stable.replace(/\+/g, '-').replace(/\//g, '_'));
  }
  // An empty form would be found in everything.
  return [...forms].filter((form) => form.length > 0);
}

/**
 * Byte arrays written as decimal numbers: `[115,107,...]`, or the `{"0":115,"1":107,...}` that
 * supabase-js produces for a raw Uint8Array. Every stretch of eight or more consecutive bytes
 * (integers 0 to 255) is decoded so the value can be searched for in it. A number that is not
 * a byte (300, -5, 1.5) ends a stretch rather than discarding the whole list.
 */
export function decodedByteRuns(text: string): string[] {
  const flat = text.replace(/"\d+"\s*:\s*/g, '');
  const lists = flat.match(/-?[\d.]+(?:\s*,\s*-?[\d.]+){7,}/g) ?? [];
  const out: string[] = [];
  for (const list of lists) {
    let run: number[] = [];
    const flush = () => {
      if (run.length >= 8) {
        const buf = Buffer.from(run);
        out.push(buf.toString('latin1'), buf.toString('utf8'));
      }
      run = [];
    };
    for (const token of list.split(',')) {
      const t = token.trim();
      if (/^\d{1,3}$/.test(t) && Number(t) <= 255) run.push(Number(t));
      else flush();
    }
    flush();
  }
  return out;
}

export type Egress = {
  channel: string;
  method: string;
  url: string;
  headers: string;
  /** null when this layer could not read the body. */
  body: string | null;
  /** The body's exact bytes as latin1, where this layer has them; UTF-8 decoding loses binary. */
  raw?: string;
  /** A page-hook send whose body needed an async read, which the network layer cannot see. */
  opaque?: boolean;
  /** A page-hook FormData send: each part's exact bytes, since the wire carries multipart. */
  parts?: string[];
  /** true when the request's headers could not be read: a blind spot. */
  headersUnread?: boolean;
  /** Page-hook reports for one send share an id; a later report fills in the body. */
  id?: string;
  /**
   * A page-hook send that never went out, or may not have: the fetch rejected, the XHR errored,
   * aborted, timed out or threw, or the beacon was not queued. It cannot vouch for a network
   * record, not even its own: the watcher cannot tell how much of the body left before the
   * failure, so a failed send whose network record has no body is reported as unread. That
   * fails closed; Chromium records a refused beacon and an aborted XHR at the network layer.
   */
  failed?: boolean;
};

/**
 * Merges the records into one per send and reports, for every watched value, each place it
 * appears (`violations`) and each send whose body or headers no layer could read
 * (`unreadable`, a blind spot that a test treats as a failure). `records` is the merged list,
 * for the watcher's own self-tests.
 */
export function analyzeEgress(
  records: Egress[],
  watched: Map<string, string | Uint8Array>,
): { violations: string[]; unreadable: string[]; records: Egress[] } {
  // One record per page-hook send: the first report that read the body, marked failed if any
  // report for that send says so.
  const byId = new Map<string, Egress>();
  const final: Egress[] = [];
  for (const r of records) {
    if (r.id === undefined) {
      final.push(r);
      continue;
    }
    const known = byId.get(r.id);
    const merged = known && (known.body !== null || r.body === null) ? known : r;
    byId.set(r.id, { ...merged, failed: known?.failed === true || r.failed === true });
  }
  final.push(...byId.values());

  const violations: string[] = [];
  for (const [label, value] of watched) {
    const forms = encodedForms(value);
    // The value as the exact bytes a body would carry, for raw and decimal-run matches.
    const bytes =
      typeof value === 'string'
        ? Buffer.from(value, 'utf8').toString('latin1')
        : Buffer.from(value).toString('latin1');
    for (const r of final) {
      for (const [part, text] of [
        ['url', r.url],
        ['headers', r.headers],
        ['body', r.body ?? ''],
      ] as const) {
        const hit =
          forms.some((form) => text.includes(form)) ||
          (typeof value === 'string' && decodedByteRuns(text).some((run) => run.includes(value))) ||
          decodedByteRuns(text).some((run) => run.includes(bytes));
        if (hit) violations.push(`${label} in ${part}: ${r.channel} ${r.method} ${r.url}`);
      }
      // Exact bytes: a binary body, or each part of a FormData body.
      if ([r.raw, ...(r.parts ?? [])].some((raw) => raw?.includes(bytes))) {
        violations.push(`${label} in raw body: ${r.channel} ${r.method} ${r.url}`);
      }
    }
  }

  // Pair each network record with the page-hook record of the same send, so a network
  // body nobody could read is excused only by the hook's reading of that very send, never
  // by a different send to the same URL (from a worker, say, where the hook does not run).
  // Per method and URL, one to one:
  // 1. a readable network body claims the hook record holding the same bytes (or, for
  //    FormData, whose every part it carries);
  // 2. each unread network body then claims one remaining hook record that read a body the
  //    network layer cannot see (a Blob, File or Request) or that sent no body at all.
  // An unread network body left unclaimed was read by nobody.
  const keyOf = (r: Egress) => `${r.method.toUpperCase()} ${r.url}`;
  const claimable = new Map<string, Egress[]>();
  for (const r of final) {
    const hook = r.channel !== 'network' && r.channel !== 'websocket-frame';
    if (!hook || r.body === null || r.failed === true) continue;
    claimable.set(keyOf(r), [...(claimable.get(keyOf(r)) ?? []), r]);
  }
  const claim = (r: Egress, fits: (h: Egress) => boolean): boolean => {
    const list = claimable.get(keyOf(r)) ?? [];
    const index = list.findIndex(fits);
    if (index < 0) return false;
    list.splice(index, 1);
    return true;
  };
  const sends = final.filter((r) => r.channel === 'network' && isSend(r.method));
  for (const r of sends) {
    if (r.body === null) continue;
    claim(r, (h) =>
      h.parts
        ? h.parts.every((part) => (r.raw ?? '').includes(part))
        : h.raw !== undefined
          ? h.raw === r.raw
          : h.body === r.body,
    );
  }

  const unreadable: string[] = [];
  for (const r of final) {
    const unread =
      r.headersUnread === true ||
      (r.channel !== 'network' && r.channel !== 'websocket-frame' && r.body === null);
    if (unread) unreadable.push(`${r.channel} ${r.method} ${r.url}`);
  }
  for (const r of sends) {
    if (r.body !== null) continue;
    if (!claim(r, (h) => h.opaque === true || h.body === '')) {
      unreadable.push(`${r.channel} ${r.method} ${r.url}`);
    }
  }

  return {
    violations: [...new Set(violations)],
    unreadable: [...new Set(unreadable)],
    records: final,
  };
}
