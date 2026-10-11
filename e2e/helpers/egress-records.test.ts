import { describe, expect, it } from 'vitest';
import { analyzeEgress, decodedByteRuns, encodedForms, type Egress } from './egress-records';

/**
 * The egress watcher's matching rules, on hand-built records. The browser self-tests in
 * e2e/egress-watch.spec.ts prove the recording; these prove the rules, including shapes
 * Chromium does not produce today but another engine or version could.
 */

const URL_P = 'http://127.0.0.1:1/p';
const SECRET = 'sk_live_SENTINEL_records_unit';

function net(body: string | null, extra: Partial<Egress> = {}): Egress {
  return {
    channel: 'network',
    method: 'POST',
    url: URL_P,
    headers: '',
    body,
    raw: body === null ? undefined : Buffer.from(body, 'utf8').toString('latin1'),
    ...extra,
  };
}

function hook(id: string, body: string | null, extra: Partial<Egress> = {}): Egress {
  return { channel: 'fetch', method: 'POST', url: URL_P, headers: '', body, id, ...extra };
}

function run(records: Egress[], watched: Record<string, string | Uint8Array> = {}) {
  return analyzeEgress(records, new Map(Object.entries(watched)));
}

describe('analyzeEgress: unread sends', () => {
  it('excuses an unread network body by the hook reading of that send', () => {
    expect(run([hook('a-1', 'payload', { opaque: true }), net(null)]).unreadable).toEqual([]);
  });

  it('lets one hook record excuse only one unread send to the same URL', () => {
    const { unreadable } = run([hook('a-1', 'payload', { opaque: true }), net(null), net(null)]);
    expect(unreadable).toEqual([`network POST ${URL_P}`]);
  });

  // The round-2 critic's case: the network layer read the hook record's own send, so that
  // record must not then vouch for a worker's unread send to the same URL.
  it('does not let a hook record already paired with a readable send excuse another', () => {
    const { unreadable } = run([
      hook('a-1', 'harmless', { opaque: true }),
      net('harmless'),
      net(null),
    ]);
    expect(unreadable).toEqual([`network POST ${URL_P}`]);
  });

  it('pairs a FormData hook record with the multipart body that carries its parts', () => {
    const multipart =
      '--b\r\nContent-Disposition: form-data; name="k"\r\n\r\nfilebytes\r\n--b--\r\n';
    const { unreadable } = run([
      hook('a-1', 'k=filebytes', { opaque: true, parts: ['filebytes'] }),
      net(multipart),
      net(null),
    ]);
    expect(unreadable).toEqual([`network POST ${URL_P}`]);
  });

  it('excuses a POST with no body, one for one', () => {
    expect(run([hook('a-1', ''), net(null)]).unreadable).toEqual([]);
    expect(run([hook('a-1', ''), net(null), net(null)]).unreadable).toHaveLength(1);
  });

  it('does not let a body readable in both layers excuse an unread one', () => {
    // A string body is not opaque: its own network record carries it, so it vouches for none.
    expect(run([hook('a-1', 'text'), net(null)]).unreadable).toHaveLength(1);
  });

  it('reports a hook send whose body never arrived, and unread headers', () => {
    expect(run([hook('a-1', null, { opaque: true })]).unreadable).toEqual([`fetch POST ${URL_P}`]);
    expect(run([net('x', { headersUnread: true })]).unreadable).toHaveLength(1);
  });

  it('keeps the filled-in report of a send over its pending one', () => {
    const records = [hook('a-1', null, { opaque: true }), hook('a-1', 'payload', { opaque: true })];
    expect(run([...records, net(null)]).unreadable).toEqual([]);
  });

  it('keeps sends from two documents apart when their counters collide', () => {
    const { violations } = run(
      [
        hook('doc1-1', null, { opaque: true }),
        hook('doc1-1', SECRET, { opaque: true }),
        hook('doc2-1', null, { opaque: true }),
        hook('doc2-1', 'harmless', { opaque: true }),
      ],
      { secret: SECRET },
    );
    expect(violations).not.toEqual([]);
  });

  it('ignores reads that send nothing', () => {
    expect(run([net(null, { method: 'GET' })]).unreadable).toEqual([]);
    expect(run([net(null, { method: 'head' })]).unreadable).toEqual([]);
  });

  // Fetch uppercases only the standard methods: `patch` and custom ones go out as written.
  it('treats every other method as a send, whatever its case', () => {
    for (const method of ['patch', 'PURGE', 'delete', 'PROPFIND']) {
      expect(run([net(null, { method })]).unreadable, method).toHaveLength(1);
    }
    // The hook uppercases what it records; pairing still finds the send.
    expect(
      run([hook('a-1', 'x', { method: 'PATCH', opaque: true }), net(null, { method: 'patch' })])
        .unreadable,
    ).toEqual([]);
  });

  // A fetch that rejected, an XHR that errored, a beacon the browser would not queue: none of
  // them may vouch for a send to the same URL from somewhere the hook does not run.
  it('does not let a send that never went out vouch for another', () => {
    const failed = hook('a-1', '', { failed: true });
    expect(run([failed, net(null)]).unreadable).toHaveLength(1);
    // The failure can arrive after the body was read: the merged record is still failed.
    const read = hook('a-2', 'payload', { opaque: true });
    expect(run([read, { ...read, body: null, failed: true }, net(null)]).unreadable).toHaveLength(
      1,
    );
  });
});

describe('analyzeEgress: leaks', () => {
  const KEY = Uint8Array.from({ length: 32 }, (_, i) => (i * 97 + 200) % 256);
  const latin1 = (bytes: Uint8Array) => Buffer.from(bytes).toString('latin1');

  it('finds raw key bytes in a hook record, where a Blob body is only visible', () => {
    const raw = latin1(Uint8Array.from([1, 2, ...KEY, 3]));
    const { violations } = run([hook('a-1', '�', { opaque: true, raw })], { key: KEY });
    expect(violations).toEqual([`key in raw body: fetch POST ${URL_P}`]);
  });

  it('finds raw key bytes in one part of a FormData body', () => {
    const { violations } = run([hook('a-1', 'k=?', { opaque: true, parts: ['x', latin1(KEY)] })], {
      key: KEY,
    });
    expect(violations).not.toEqual([]);
  });

  it('finds a value in the URL, the headers and the body', () => {
    const { violations } = run(
      [
        net('', { url: `${URL_P}?k=${encodeURIComponent(SECRET)}` }),
        net('', { headers: `x-api-key: ${SECRET}` }),
        net(JSON.stringify({ v: SECRET })),
      ],
      { secret: SECRET },
    );
    expect(violations.map((v) => v.split(':')[0])).toEqual([
      'secret in url',
      'secret in headers',
      'secret in body',
      'secret in raw body',
    ]);
  });

  it('reports nothing for a record that carries no watched value', () => {
    expect(run([net('{"ciphertext":"q7Hf0zX2"}')], { secret: SECRET }).violations).toEqual([]);
  });
});

describe('encodedForms', () => {
  it('finds a value written raw into a URL path or query, as browsers serialize it', () => {
    // Characters encodeURI treats differently from the URL serializer, which encodes a quote in
    // a query but not in a path.
    const value = "svc key|[eu]^{x}%' 2026";
    for (const url of [new URL(`${URL_P}/${value}`).href, new URL(`${URL_P}?${value}`).href]) {
      expect(run([net('', { url })], { mixed: value }).violations, url).not.toEqual([]);
    }
  });

  // The serializer keeps only part of a value that contains '?' or '#', or resolves '..' away.
  // Such a prefix is not the value, and an empty one would match every request.
  it('never yields a truncated or empty URL form', () => {
    for (const value of ['?token-0123456789abcdef', 'pass?word-0123456789', 'a#b-0123456789abcd']) {
      const forms = encodedForms(value);
      expect(
        forms.every((form) => form.length > 0),
        value,
      ).toBe(true);
      expect(
        forms.every((form) => !value.startsWith(form) || form === value),
        value,
      ).toBe(true);
    }
    expect(encodedForms('abc/../def-0123456789')).not.toContain('def-0123456789');
    // A harmless request is not flagged for any of them.
    for (const value of ['?token-0123456789abcdef', 'pass?word-0123456789']) {
      expect(run([net('{"ok":true}', { method: 'GET' })], { v: value }).violations).toEqual([]);
    }
  });

  // The URL parser drops tabs and newlines anywhere and spaces at the ends. That shorter form
  // is what travels, so it is the one to look for.
  it('finds a value the URL parser shortened on the way out', () => {
    for (const value of [
      'sk_live_SENTINEL_newline_value\n',
      'sk_live_SENTINEL\ttab_value_x',
      'sk_live_SENTINEL_trailing_space ',
    ]) {
      const url = new URL(`${URL_P}?k=${value}`).href;
      expect(run([net('', { url })], { v: value }).violations, JSON.stringify(value)).not.toEqual(
        [],
      );
    }
  });

  // A '?' ends the path, so the serializer would keep only the part before it, which is not
  // the value and would match a request that merely shares its first words.
  it('does not mistake the part of a value before a ? for the value', () => {
    const value = 'svc key x?y-0123456789';
    const url = `${URL_P}/svc%20key%20x`;
    expect(run([net('', { url })], { v: value }).violations).toEqual([]);
  });

  // A '#' ends the query, so the serializer keeps only what comes before it.
  it('does not mistake the part of a value before a # for the value', () => {
    const value = 'session-prefix-0123#fragment-part';
    const url = `${URL_P}?k=session-prefix-0123`;
    expect(run([net('', { url })], { v: value }).violations).toEqual([]);
  });

  // A value the parser shrinks to a couple of characters would match unrelated traffic.
  it('drops a URL form too short to mean anything', () => {
    const value = 'ab\t\t\t\t\t\t\t\t\t\t';
    expect(run([net('', { url: `${URL_P}/about` })], { v: value }).violations).toEqual([]);
  });

  it('never produces an empty form, which would match everything', () => {
    expect(encodedForms('')).not.toContain('');
    expect(encodedForms(new Uint8Array(0))).not.toContain('');
  });

  it('covers every way a URL or a form writes a value with spaces and punctuation', () => {
    const value = 'svc account/prod:eu@acme 2026';
    const forms = encodedForms(value);
    expect(forms).toContain(value);
    expect(forms).toContain(encodeURIComponent(value));
    expect(forms).toContain(encodeURI(value));
    expect(forms).toContain(new URLSearchParams({ v: value }).toString().slice(2));
    expect(forms).toContain(JSON.stringify(value).slice(1, -1));
  });

  it('matches a byte value only by its byte encodings, never as text', () => {
    const forms = encodedForms(Uint8Array.from([0xde, 0xad, 0xbe, 0xef]));
    expect(forms).toContain('deadbeef');
    expect(forms).toContain('DEADBEEF');
  });
});

describe('decodedByteRuns', () => {
  const bytes = [...Buffer.from(SECRET, 'utf8')];

  it('decodes a byte array and the index-keyed object supabase-js writes', () => {
    expect(decodedByteRuns(JSON.stringify(bytes)).some((r) => r.includes(SECRET))).toBe(true);
    const keyed = JSON.stringify(Object.fromEntries(bytes.map((b, i) => [String(i), b])));
    expect(decodedByteRuns(keyed).some((r) => r.includes(SECRET))).toBe(true);
  });

  it('keeps the bytes next to a number that is not a byte', () => {
    for (const lead of [[300], [-5], [1.5], [300, 7]]) {
      const text = JSON.stringify([...lead, ...bytes, 999]);
      expect(
        decodedByteRuns(text).some((r) => r.includes(SECRET)),
        String(lead),
      ).toBe(true);
    }
  });

  it('decodes UTF-8 as well as latin1', () => {
    const value = 'clé-secrète-ünïcode-2026';
    const text = JSON.stringify([...Buffer.from(value, 'utf8')]);
    expect(decodedByteRuns(text).some((r) => r.includes(value))).toBe(true);
  });
});
