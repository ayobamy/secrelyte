import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { expect, type BrowserContext, type Page, type Request, type Route } from '@playwright/test';
import { analyzeEgress, type Egress } from './egress-records';

/**
 * The vault specs drive a real signup against a live Supabase, so they skip unless
 * E2E_VAULT=1. `pnpm test:e2e:vault` sets it, points the build at local Supabase, and fails if
 * any of them skipped anyway.
 */
export const LIVE_VAULT = process.env.E2E_VAULT === '1';
export const LIVE_VAULT_REASON = 'needs a live Supabase: run pnpm test:e2e:vault';

/** Signup runs Argon2id at 64 MiB, a server round trip, and the PDF; budget for all of it. */
export const VAULT_FLOW_TIMEOUT_MS = 120_000;

const PASSWORD = 'correct-horse-battery-staple-orbit';

export type Credentials = {
  email: string;
  password: string;
  /** The 24 words, in order. */
  words: string[];
  /** The same recovery key as printed in base32 on the kit. */
  base32: string;
  /** The raw 32-byte recovery key. */
  rk: Uint8Array;
};

/** RFC 4648 base32, no padding: the kit's fallback encoding of the recovery key. */
function base32Decode(text: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const out: number[] = [];
  let bits = 0;
  let value = 0;
  for (const ch of text.replace(/=+$/, '')) {
    const index = alphabet.indexOf(ch);
    if (index < 0) throw new Error('recovery kit base32 is not base32');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Uint8Array.from(out);
}

function pdfInflatedText(pdf: Buffer): string {
  let out = '';
  let i = 0;
  const marker = Buffer.from('stream');
  while (i < pdf.length) {
    const idx = pdf.indexOf(marker, i);
    if (idx < 0) break;
    let start = idx + marker.length;
    if (pdf[start] === 0x0d) start += 1;
    if (pdf[start] === 0x0a) start += 1;
    const end = pdf.indexOf(Buffer.from('endstream'), start);
    if (end < 0) break;
    const chunk = pdf.subarray(start, end);
    try {
      out += inflateSync(chunk).toString('utf8');
    } catch {
      out += chunk.toString('latin1');
    }
    i = end + 9;
  }
  return out;
}

function pdfVisibleText(pdf: Buffer): string {
  const parts: string[] = [];
  for (const m of pdfInflatedText(pdf).matchAll(/<([0-9A-Fa-f]+)> Tj/g)) {
    parts.push(Buffer.from(m[1]!, 'hex').toString('utf8'));
  }
  return parts.join('\n');
}

/**
 * Signs up a fresh account and clears the recovery kit gate the way a user does: downloads
 * the real PDF, reads the 24 words out of it, and types back the three it asks for.
 * `beforeOpen` runs just before "Open the vault", for tests that need to set up routes first.
 */
export async function signUpAndOpenVault(
  page: Page,
  options: { beforeOpen?: () => Promise<void>; expectOpen?: boolean } = {},
): Promise<Credentials> {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  await page.goto('/signup');
  await expect(page.getByRole('heading', { name: 'Create an account' })).toBeVisible();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Create vault' }).click();
  await expect(page.getByRole('heading', { name: 'Recovery kit' })).toBeVisible({
    timeout: 60_000,
  });

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download PDF' }).click();
  const path = await (await downloadPromise).path();
  if (!path) throw new Error('recovery kit PDF did not download');
  const text = pdfVisibleText(readFileSync(path));
  const words = new Map<number, string>();
  for (const match of text.matchAll(/^(\d{2}) {2}([a-z]+)$/gm)) {
    words.set(Number(match[1]), match[2] ?? '');
  }
  expect(words.size).toBe(24);
  const base32 = text.match(/^[A-Z2-7]{52}$/m)?.[0];
  if (!base32) throw new Error('recovery kit PDF has no base32 key');
  const rk = base32Decode(base32);
  expect(rk.byteLength).toBe(32);

  await page.getByRole('checkbox').check();
  for (const [n, word] of words) {
    // Exact, because 'Word 1' would also match 'Word 11' through 'Word 19'.
    const field = page.getByLabel(`Word ${n}`, { exact: true });
    if ((await field.count()) > 0) {
      await field.fill(word);
    }
  }
  await options.beforeOpen?.();
  await page.getByRole('button', { name: 'Open the vault' }).click();
  if (options.expectOpen !== false) await expectVaultOpen(page);

  const ordered = [...words.entries()].sort(([a], [b]) => a - b).map(([, word]) => word);
  return { email, password: PASSWORD, words: ordered, base32, rk };
}

/**
 * The open vault, not just its heading: the gate's "vault stays closed" screen is headed
 * "Vault" too, so the heading alone would pass for a vault that never opened.
 */
export async function expectVaultOpen(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Vault' })).toBeVisible();
  await expect(page.getByLabel('Product name')).toBeVisible();
}

/** Unlocks from /login. A full navigation drops the in-memory keys, which locks the vault. */
export async function unlockFromLogin(page: Page, credentials: Credentials): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(credentials.email);
  await page.getByLabel('Password', { exact: true }).fill(credentials.password);
  await page.getByRole('button', { name: 'Unlock' }).click();
}

/** Locks the open vault with its own control, then unlocks it from /login. */
export async function lockAndUnlock(page: Page, credentials: Credentials): Promise<void> {
  await page.getByRole('button', { name: 'lock' }).click();
  await unlockFromLogin(page, credentials);
}

/** Creates `product`, selects it, and stores one secret in it. */
export async function storeSecret(
  page: Page,
  secret: { product: string; name: string; value: string },
): Promise<void> {
  await page.getByLabel('Product name').fill(secret.product);
  await page.getByRole('button', { name: 'Add product' }).click();
  const productButton = page.getByRole('button', { name: secret.product, exact: true });
  await expect(productButton).toBeVisible();
  // The vault keeps the first product selected; pick this one so the secret lands here.
  await productButton.click();
  await page.getByLabel('Secret name').fill(secret.name);
  await page.getByLabel('Secret value').fill(secret.value);
  await page.getByRole('button', { name: 'Store ciphertext' }).click();
  await expect(page.getByRole('listitem').filter({ hasText: secret.name })).toBeVisible();
}

/**
 * Runs in the page before any app code. Reports every send from fetch, XHR, sendBeacon and
 * WebSocket the moment it happens. Bodies readable synchronously go in that first report. A
 * Blob, File or Request body is reported as pending (null) first and filled in by a second
 * report with the same id once read, so a page that dies mid-read (a beacon on pagehide)
 * still leaves a record, and an unfilled one counts as unreadable. A stream body is never
 * readable. Binary bodies also carry their exact bytes, since decoding them as text loses
 * them. Ids carry a per-document prefix: a counter alone restarts in every document.
 */
function egressHook(): void {
  type Hooked = { method: string; url: string; headers: string[] };
  type Watched = XMLHttpRequest & {
    __egress?: Hooked;
    /** The failure callback of the send in flight; an XHR can be reused for several. */
    __egressFail?: () => void;
    __egressListening?: boolean;
  };
  type Read = { text: string; raw?: string; parts?: string[] };
  type Report = {
    id: string;
    channel: string;
    method: string;
    url: string;
    headers: string;
    body: string | null;
    raw?: string;
    parts?: string[];
    opaque: boolean;
    failed?: boolean;
  };
  const w = window as unknown as { __secrelyteEgress?: (e: Report) => void };
  const doc = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
  let seq = 0;
  const absolute = (url: string) => new URL(url, location.href).href;
  const latin1 = (bytes: Uint8Array) => {
    let out = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return out;
  };
  const fromBytes = (data: ArrayBuffer | ArrayBufferView): Read => {
    const bytes =
      data instanceof ArrayBuffer
        ? new Uint8Array(data)
        : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    return { text: new TextDecoder().decode(bytes), raw: latin1(bytes) };
  };
  const formRead = (parts: Array<[string, Read]>): Read => ({
    text: parts.map(([key, value]) => `${key}=${value.text}`).join('&'),
    parts: parts.map(([, value]) => value.raw ?? latin1(new TextEncoder().encode(value.text))),
  });

  // A reading, null when it can never be read here, or undefined when it needs an async read.
  function readNow(body: unknown): Read | null | undefined {
    if (body == null) return { text: '' };
    if (typeof body === 'string') return { text: body };
    if (body instanceof URLSearchParams) return { text: body.toString() };
    if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) return fromBytes(body);
    if (body instanceof FormData) {
      const parts: Array<[string, Read]> = [];
      for (const [key, value] of body.entries()) {
        if (typeof value !== 'string') return undefined;
        parts.push([key, { text: value }]);
      }
      return formRead(parts);
    }
    if (body instanceof Blob || body instanceof Promise) return undefined;
    return null;
  }
  async function readLater(body: unknown): Promise<Read | null> {
    if (body instanceof Promise) return readNow(await body) ?? null;
    if (body instanceof Blob) return fromBytes(await body.arrayBuffer());
    if (body instanceof FormData) {
      const parts: Array<[string, Read]> = [];
      for (const [key, value] of body.entries()) {
        parts.push([
          key,
          typeof value === 'string' ? { text: value } : fromBytes(await value.arrayBuffer()),
        ]);
      }
      return formRead(parts);
    }
    return null;
  }

  /** Reports one send; returns a callback for when that send turns out not to have gone out. */
  function report(
    channel: string,
    method: string,
    url: string,
    headers: string,
    body: unknown,
  ): () => void {
    seq += 1;
    const now = readNow(body);
    const base = {
      id: `${doc}-${seq}`,
      channel,
      method,
      url: absolute(url),
      headers,
      opaque: now === undefined,
    };
    const send = (read: Read | null) =>
      w.__secrelyteEgress?.({
        ...base,
        body: read ? read.text : null,
        raw: read?.raw,
        parts: read?.parts,
      });
    send(now ?? null);
    if (now === undefined) {
      void readLater(body).then(send, () => send(null));
    }
    return () => w.__secrelyteEgress?.({ ...base, body: null, failed: true });
  }

  const fetchOriginal = window.fetch.bind(window);
  function recordFetch(input: RequestInfo | URL, init?: RequestInit): () => void {
    const request = input instanceof Request ? input : null;
    const url = request ? request.url : String(input);
    const method = (init?.method ?? request?.method ?? 'GET').toUpperCase();
    const headers = [...new Headers(init?.headers ?? request?.headers).entries()]
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n');
    // A null or missing init.body sends the Request's own body (the Fetch standard's Request
    // constructor), so read that: as bytes, since decoding a binary body as text would lose it.
    const body = init?.body != null ? init.body : request ? request.clone().arrayBuffer() : null;
    return report('fetch', method, url, headers, body);
  }
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    // fetch reports a bad URL, bad headers or a used body as a rejected promise, never a throw.
    // Reading them here would throw, so a send this cannot record goes on unrecorded: fetch
    // then rejects it for the same reason, and any request that does go out still shows at
    // the network layer, where an unread body counts against the test.
    let failed: (() => void) | null = null;
    try {
      failed = recordFetch(input, init);
    } catch (err) {
      console.warn('egress hook could not record a fetch', err);
    }
    const sent = fetchOriginal(input, init);
    if (failed) sent.then(undefined, failed);
    return sent;
  };

  const xhrOpen = XMLHttpRequest.prototype.open;
  const xhrHeader = XMLHttpRequest.prototype.setRequestHeader;
  const xhrSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (this: Watched, ...args: unknown[]) {
    this.__egress = { method: String(args[0]).toUpperCase(), url: String(args[1]), headers: [] };
    return (xhrOpen as (...a: unknown[]) => void).apply(this, args);
  };
  XMLHttpRequest.prototype.setRequestHeader = function (
    this: Watched,
    name: string,
    value: string,
  ) {
    this.__egress?.headers.push(`${name}: ${value}`);
    return xhrHeader.call(this, name, value);
  };
  XMLHttpRequest.prototype.send = function (
    this: Watched,
    body?: Document | XMLHttpRequestBodyInit | null,
  ) {
    const meta = this.__egress ?? { method: 'UNKNOWN', url: location.href, headers: [] };
    const failed = report('xhr', meta.method, meta.url, meta.headers.join('\n'), body);
    // One set of listeners per XHR, each calling the failure callback of the send in flight,
    // so a reused XHR's later failure never marks an earlier send.
    if (!this.__egressListening) {
      this.__egressListening = true;
      for (const event of ['error', 'abort', 'timeout']) {
        this.addEventListener(event, () => this.__egressFail?.());
      }
    }
    const inFlight = this.__egressFail;
    this.__egressFail = failed;
    // A send can also fail by throwing (a second send on the same XHR): no event fires then,
    // and the send already in flight keeps its own callback.
    try {
      return xhrSend.call(this, body);
    } catch (err) {
      this.__egressFail = inFlight;
      failed();
      throw err;
    }
  };

  if (typeof navigator.sendBeacon === 'function') {
    const beacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = (url: string | URL, data?: BodyInit | null) => {
      const failed = report('beacon', 'POST', String(url), '', data);
      let queued = false;
      try {
        queued = beacon(url, data);
      } catch (err) {
        failed();
        throw err;
      }
      if (!queued) failed();
      return queued;
    };
  }

  const wsSend = WebSocket.prototype.send;
  WebSocket.prototype.send = function (
    this: WebSocket,
    data: string | ArrayBufferLike | Blob | ArrayBufferView,
  ) {
    report('websocket', 'SEND', this.url, '', data);
    return wsSend.call(this, data);
  };
}

export type EgressWatch = {
  /**
   * Watches for `value` (labelled for the failure message). Can be added mid-session. A
   * Uint8Array is matched as raw bytes and in its byte encodings, never as text.
   */
  watch: (label: string, value: string | Uint8Array) => void;
  /**
   * Ends the session: runs every page's exit handlers while it is still live, lets in-flight
   * reports land, aborts every request that starts after that (still recorded and checked;
   * a test's own page route outranks the abort), navigates away, then reports.
   * `unreadable` lists sending requests whose body neither layer could read: a blind spot,
   * so a test treats it as a failure rather than a pass.
   */
  finish: () => Promise<{ violations: string[]; unreadable: string[]; records: Egress[] }>;
};

/**
 * How long finish() waits, once in total, for the requests already in flight when it starts to
 * finish or fail. Leaving a page cancels them, and Playwright never settles allHeaders() for a
 * cancelled request, so a slow request cut off there would read as unread. Requests that start
 * after that point are aborted at once, so they settle and are still recorded rather than wait,
 * unless a test's own page route takes them first; one it lets out that is still running at
 * the navigation is cut off like the rest.
 * A request still going after this long is cut off; if its headers had not arrived by then,
 * it is reported as unread.
 */
const IN_FLIGHT_WAIT_MS = 10_000;

/**
 * How long finish() still waits for request headers once it has left every page. Playwright
 * settles allHeaders() when the response or a load failure arrives, so until then a slow
 * response takes as long as it takes. It never settles them for a beacon the browser refused,
 * which hung finish() for good, or for a request the departure cut off; one still without
 * headers this long after leaving counts as unread, a reported blind spot.
 */
const HEADERS_WAIT_MS = 2_000;

/**
 * Records everything the browser context sends, at two layers:
 * - the network: URL, every header, and the body Playwright can read, for every request from
 *   every page and worker;
 * - the page (egressHook): bodies the network layer sees as opaque, and WebSocket frames.
 * Matching happens at finish(), against every watched value, so a secret learned late in the
 * session (the recovery phrase) is still checked against requests sent before it was known.
 * Call before the first navigation.
 *
 * What it is for: catching this app's own code sending a secret by accident, in any encoding
 * an ordinary request would carry. It is not an exfiltration detector. A body compressed or
 * encrypted before sending, and channels the app never opens (WebRTC), would pass; a stream
 * body is reported as unreadable rather than passed.
 */

export async function watchEgress(context: BrowserContext): Promise<EgressWatch> {
  const watched = new Map<string, string | Uint8Array>();
  const records: Egress[] = [];
  const pending: Promise<unknown>[] = [];

  await context.exposeFunction('__secrelyteEgress', (e: Egress) => {
    records.push(e);
  });
  await context.addInitScript(egressHook);

  // Resolves to null HEADERS_WAIT_MS after finish() has left every page, never before.
  let startHeadersDeadline!: () => void;
  const headersDeadline = new Promise<null>((resolve) => {
    startHeadersDeadline = () => {
      setTimeout(() => resolve(null), HEADERS_WAIT_MS);
    };
  });

  // Requests that have neither finished nor failed yet, from every page and worker.
  const inFlight = new Set<Request>();
  context.on('requestfinished', (req) => inFlight.delete(req));
  context.on('requestfailed', (req) => inFlight.delete(req));
  // Waits for the requests in flight now, not for the set to empty: steady traffic would keep
  // it from ever emptying.
  const settleInFlight = async () => {
    const waitingFor = [...inFlight];
    const giveUpAt = Date.now() + IN_FLIGHT_WAIT_MS;
    while (waitingFor.some((req) => inFlight.has(req)) && Date.now() < giveUpAt) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  };
  const abortNew = (route: Route) => route.abort();

  context.on('request', (req) => {
    inFlight.add(req);
    pending.push(
      (async () => {
        const body = req.postDataBuffer();
        let headers = '';
        let headersUnread = false;
        try {
          const all = await Promise.race([req.allHeaders(), headersDeadline]);
          if (all === null) headersUnread = true;
          else {
            headers = Object.entries(all)
              .map(([k, v]) => `${k}: ${v}`)
              .join('\n');
          }
        } catch {
          headersUnread = true;
        }
        records.push({
          channel: 'network',
          method: req.method(),
          url: req.url(),
          headers,
          body: body ? body.toString('utf8') : null,
          raw: body ? body.toString('latin1') : undefined,
          headersUnread,
        });
      })(),
    );
  });
  const onPage = (page: Page) => {
    page.on('websocket', (ws) => {
      ws.on('framesent', (frame) => {
        records.push({
          channel: 'websocket-frame',
          method: 'SEND',
          url: ws.url(),
          headers: '',
          body: typeof frame.payload === 'string' ? frame.payload : frame.payload.toString('utf8'),
          raw:
            typeof frame.payload === 'string'
              ? Buffer.from(frame.payload, 'utf8').toString('latin1')
              : frame.payload.toString('latin1'),
        });
      });
    });
  };
  context.pages().forEach(onPage);
  context.on('page', onPage);

  return {
    watch: (label, value) => {
      watched.set(label, value);
    },
    finish: async () => {
      const live = context.pages().filter((page) => !page.isClosed());
      for (const page of live) {
        // Run exit handlers in a live page, where their beacons can still be observed; a real
        // navigation can tear the document down before its last sends are reported.
        await page.evaluate(() => {
          // Report the page as hidden first, or a handler that sends only once the page is
          // hidden (the common analytics pattern) sees 'visible' and does nothing.
          Object.defineProperty(document, 'visibilityState', {
            configurable: true,
            get: () => 'hidden',
          });
          Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
          document.dispatchEvent(new Event('visibilitychange'));
          window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false }));
          window.dispatchEvent(new Event('beforeunload'));
          window.dispatchEvent(new Event('unload'));
        });
        // A round trip after those sends: reports made before it arrive before its result.
        // Deliberately no page timers here, since the timing specs replace them.
        await page.evaluate(() => true);
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
      // Everything the session and its exit handlers sent is in flight or done. From here on
      // a new request fails at once (still recorded), and what is in flight gets its chance
      // to finish before the navigation below would cancel it.
      await context.route('**/*', abortNew);
      try {
        await settleInFlight();
        for (const page of live) await page.goto('about:blank');
      } finally {
        // Even if leaving a page throws, the context must not keep aborting requests.
        await context.unroute('**/*', abortNew);
      }
      // Late reports from unload handlers.
      await new Promise((resolve) => setTimeout(resolve, 300));
      startHeadersDeadline();
      await Promise.allSettled(pending);

      return analyzeEgress(records, watched);
    },
  };
}
