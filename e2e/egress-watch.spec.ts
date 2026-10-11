import { createHash } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { AddressInfo, Socket } from 'node:net';
import { expect, test, type Page } from '@playwright/test';
import { watchEgress } from './helpers/vault';

/**
 * The no-plaintext-egress test is only as good as its watcher, so the watcher is tested: each
 * case below leaks a value one way, and the watcher has to catch it. The previous watcher
 * missed Blob and ArrayBuffer bodies, headers, beacons, WebSocket frames, and the
 * `{"0":115,...}` shape supabase-js gives a raw Uint8Array.
 *
 * Everything goes to a loopback server started here; nothing leaves the machine.
 */
const SECRET = 'sk_live_SENTINEL_egress_selftest';
/** Longer than HEADERS_WAIT_MS in helpers/vault.ts. */
const SLOW_RESPONSE_MS = 2_500;
/** Shaped like the recovery phrase: words joined by spaces, which every encoding changes. */
const PHRASE = 'abandon ability able about above absent absorb abstract';
/** Shaped like the raw recovery key: 32 bytes, most of them not printable. */
const KEY = Uint8Array.from({ length: 32 }, (_, i) => (i * 97 + 200) % 256);

/**
 * One loopback server for the probe page, its HTTP traffic and a real WebSocket. Playwright's
 * routeWebSocket would swap in a mock WebSocket class and bypass the code under test, and a
 * routed public origin may not open a socket to 127.0.0.1 (Private Network Access), so
 * everything shares this origin. It only completes the RFC 6455 handshake; frames are observed
 * in the browser.
 */
let server: Server;
// Upgraded sockets leave the server's connection tracking, so closeAllConnections() misses them.
const upgraded = new Set<Socket>();
let origin = '';
let wsUrl = '';

test.beforeAll(async () => {
  server = createServer((req, res) => {
    req.resume();
    // Any query string still gets the page, so a test can open a second document.
    if (req.method === 'GET' && new URL(req.url ?? '/', 'http://probe').pathname === '/') {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end('<!doctype html><title>probe</title>');
      return;
    }
    // A response a little slow, as steady background traffic would be.
    if (req.url?.startsWith('/mid')) {
      setTimeout(() => {
        res.writeHead(204);
        res.end();
      }, 600);
      return;
    }
    // A response slower than the watcher's headers wait, which only starts in finish().
    if (req.url?.startsWith('/slow')) {
      setTimeout(() => {
        res.writeHead(204);
        res.end();
      }, SLOW_RESPONSE_MS);
      return;
    }
    res.writeHead(204);
    res.end();
  });
  server.on('upgrade', (req, socket: Socket) => {
    upgraded.add(socket);
    socket.on('close', () => upgraded.delete(socket));
    const accept = createHash('sha1')
      .update(`${req.headers['sec-websocket-key']}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
      .digest('base64');
    socket.write(
      `HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`,
    );
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  origin = `http://127.0.0.1:${port}`;
  wsUrl = `ws://127.0.0.1:${port}/`;
});

test.afterAll(async () => {
  for (const socket of upgraded) socket.destroy();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});

async function openProbePage(page: Page): Promise<void> {
  await page.goto(`${origin}/`);
}

/**
 * Runs `script` in the probe page with the secret as S, the phrase as P, the key bytes as K
 * and the socket URL as WS.
 */
function leak(page: Page, script: string): Promise<unknown> {
  const values = [
    `const S = ${JSON.stringify(SECRET)};`,
    `const P = ${JSON.stringify(PHRASE)};`,
    `const K = new Uint8Array(${JSON.stringify([...KEY])});`,
    `const WS = ${JSON.stringify(wsUrl)};`,
  ].join(' ');
  return page.evaluate(`(async () => { ${values} await ${script}; })()`);
}

const LEAKS: Array<[name: string, script: string]> = [
  ['fetch string body', `fetch('/p', { method: 'POST', body: JSON.stringify({ v: S }) })`],
  ['fetch Blob body', `fetch('/p', { method: 'POST', body: new Blob([S]) })`],
  [
    'fetch ArrayBuffer body',
    `fetch('/p', { method: 'POST', body: new TextEncoder().encode(S).buffer })`,
  ],
  [
    'fetch FormData body',
    `(() => { const f = new FormData(); f.append('v', S); return fetch('/p', { method: 'POST', body: f }); })()`,
  ],
  ['fetch Request body', `fetch(new Request('/p', { method: 'POST', body: S }))`],
  ['request header', `fetch('/p', { headers: { 'x-api-key': S } })`],
  ['URL query', `fetch('/p?k=' + encodeURIComponent(S))`],
  ['XHR body', `(() => { const x = new XMLHttpRequest(); x.open('POST', '/p'); x.send(S); })()`],
  ['sendBeacon Blob', `navigator.sendBeacon('/p', new Blob([S]))`],
  [
    'WebSocket frame',
    `new Promise((r) => { const ws = new WebSocket(WS); ws.onopen = () => { ws.send(S); r(null); }; })`,
  ],
  [
    'Uint8Array as JSON object',
    `fetch('/p', { method: 'POST', body: JSON.stringify(new TextEncoder().encode(S)) })`,
  ],
  [
    'byte array JSON',
    `fetch('/p', { method: 'POST', body: JSON.stringify(Array.from(new TextEncoder().encode(S))) })`,
  ],
  [
    'hex body',
    `fetch('/p', { method: 'POST', body: Array.from(new TextEncoder().encode(S), (b) => b.toString(16).padStart(2, '0')).join('') })`,
  ],
  ['base64 at an odd offset', `fetch('/p', { method: 'POST', body: btoa('xy' + S + 'z') })`],
  [
    'byte array after a number that is not a byte',
    `fetch('/p', { method: 'POST', body: JSON.stringify([300, -5, ...new TextEncoder().encode(S)]) })`,
  ],
];

// The recovery phrase never travels as typed: a URL percent-encodes its spaces, a form body
// turns them into '+', and code that holds it as a word list sends a JSON array.
const PHRASE_LEAKS: Array<[name: string, script: string]> = [
  ['phrase in a URL query, spaces left to the browser', `fetch('/p?k=' + P)`],
  ['phrase in an encoded URL query', `fetch('/p?k=' + encodeURIComponent(P))`],
  [
    'phrase in a URLSearchParams body',
    `fetch('/p', { method: 'POST', body: new URLSearchParams({ k: P }) })`,
  ],
  [
    'phrase as a JSON word array',
    `fetch('/p', { method: 'POST', body: JSON.stringify({ words: P.split(' ') }) })`,
  ],
  [
    'phrase as a word array inside a JSON string',
    `fetch('/p', { method: 'POST', body: JSON.stringify({ blob: JSON.stringify(P.split(' ')) }) })`,
  ],
];

// The recovery key's raw bytes, as binary and in each text encoding of bytes.
const KEY_LEAKS: Array<[name: string, script: string]> = [
  ['key as a binary body', `fetch('/p', { method: 'POST', body: K })`],
  // Blob, Request and File bodies are opaque to the network layer; only the hook sees them.
  ['key as a binary Blob body', `fetch('/p', { method: 'POST', body: new Blob([K]) })`],
  ['key as a binary beacon', `navigator.sendBeacon('/p', new Blob([K]))`],
  ['key as a binary Request body', `fetch(new Request('/p', { method: 'POST', body: K }))`],
  [
    'key as a binary FormData file',
    `(() => { const f = new FormData(); f.append('k', new Blob([K])); return fetch('/p', { method: 'POST', body: f }); })()`,
  ],
  [
    'key as a binary WebSocket frame',
    `new Promise((r) => { const ws = new WebSocket(WS); ws.binaryType = 'arraybuffer'; ws.onopen = () => { ws.send(K); r(null); }; })`,
  ],
  ['key as base64', `fetch('/p', { method: 'POST', body: btoa(String.fromCharCode(...K)) })`],
  [
    'key as hex',
    `fetch('/p', { method: 'POST', body: Array.from(K, (b) => b.toString(16).padStart(2, '0')).join('') })`,
  ],
  [
    'key as a JSON byte array',
    `fetch('/p', { method: 'POST', body: JSON.stringify(Array.from(K)) })`,
  ],
  ['key as a JSON object', `fetch('/p', { method: 'POST', body: JSON.stringify({ k: K }) })`],
];

test.describe('egress watcher', () => {
  for (const [name, script] of LEAKS) {
    test(`catches a leak through ${name}`, async ({ page, context }) => {
      const egress = await watchEgress(context);
      egress.watch('secret', SECRET);
      await openProbePage(page);
      await leak(page, script);
      const { violations } = await egress.finish();
      expect(violations, name).not.toEqual([]);
    });
  }

  for (const [name, script] of PHRASE_LEAKS) {
    test(`catches the ${name}`, async ({ page, context }) => {
      const egress = await watchEgress(context);
      egress.watch('phrase', PHRASE);
      egress.watch('phrase words', JSON.stringify(PHRASE.split(' ')));
      await openProbePage(page);
      await leak(page, script);
      const { violations } = await egress.finish();
      expect(violations, name).not.toEqual([]);
    });
  }

  for (const [name, script] of KEY_LEAKS) {
    test(`catches the ${name}`, async ({ page, context }) => {
      const egress = await watchEgress(context);
      egress.watch('key', KEY);
      await openProbePage(page);
      await leak(page, script);
      const { violations } = await egress.finish();
      expect(violations, name).not.toEqual([]);
    });
  }

  // A value mixing spaces with URL punctuation: browsers encode the spaces and keep the rest.
  test('catches a value with spaces and slashes written raw into a URL', async ({
    page,
    context,
  }) => {
    const value = 'svc account/prod:eu@acme 2026 token';
    const egress = await watchEgress(context);
    egress.watch('mixed', value);
    await openProbePage(page);
    await page.evaluate((v) => fetch('/p/' + v), value);
    const { violations } = await egress.finish();
    expect(violations).not.toEqual([]);
  });

  // Hook record ids used to restart at 1 in every document, and merging by id let a later
  // document's send replace an earlier document's leak.
  test('keeps the sends of each document apart', async ({ page, context }) => {
    const egress = await watchEgress(context);
    egress.watch('secret', SECRET);
    await openProbePage(page);
    await leak(page, `fetch('/p', { method: 'POST', body: new Blob([S]) })`);
    await page.goto(`${origin}/?second`);
    await page.evaluate(() => fetch('/p', { method: 'POST', body: new Blob(['harmless']) }));
    const { violations } = await egress.finish();
    expect(violations).not.toEqual([]);
  });

  // A Request body is read by the hook through clone(), which turns the body the browser sends
  // into a stream, so in Chromium neither layer pairs it by bytes. Its one hook record still
  // excuses exactly one unread send: the worker's must be reported. The case where the network
  // layer does read the Request is covered in e2e/helpers/egress-records.test.ts.
  test('lets a Request body vouch for its own send only', async ({ page, context }) => {
    const egress = await watchEgress(context);
    egress.watch('secret', SECRET);
    await openProbePage(page);
    await leak(
      page,
      `(async () => {
        await fetch(new Request('/p', { method: 'POST', body: 'harmless' }));
        const code = "fetch('" + location.origin + "/p', { method: 'POST', body: new Blob([self.name]) }).then(() => postMessage('sent'), (e) => postMessage('failed ' + e));";
        const worker = new Worker(URL.createObjectURL(new Blob([code])), { name: S });
        const sent = await new Promise((r) => { worker.onmessage = (e) => r(e.data); });
        if (sent !== 'sent') throw new Error(String(sent));
      })()`,
    );
    const { violations, unreadable } = await egress.finish();
    expect([...violations, ...unreadable]).not.toEqual([]);
  });

  // fetch(request, { body: null }) and { body: undefined } send the Request's own body. The
  // hook used to record the null instead, which then excused the unread network record.
  for (const init of ['{ body: null }', '{ body: undefined }']) {
    test(`catches a Request body sent with ${init}`, async ({ page, context }) => {
      const egress = await watchEgress(context);
      egress.watch('secret', SECRET);
      await openProbePage(page);
      await leak(
        page,
        `fetch(new Request('/p', { method: 'POST', body: new Blob([S]) }), ${init})`,
      );
      const { violations } = await egress.finish();
      expect(violations).not.toEqual([]);
    });
  }

  /** A worker, which the hook does not watch, sends S in an unreadable body with `method`. */
  const workerSend = (method: string) =>
    `(async () => {
      const code = "fetch('" + location.origin + "/p', { method: '${method}', body: new Blob([self.name]) }).then(() => postMessage('sent'), (e) => postMessage('failed ' + e));";
      const worker = new Worker(URL.createObjectURL(new Blob([code])), { name: S });
      const sent = await new Promise((r) => { worker.onmessage = (e) => r(e.data); });
      if (sent !== 'sent') throw new Error(String(sent));
    })()`;

  // Fetch sends `patch` as written; only the standard methods are uppercased.
  for (const method of ['patch', 'PURGE']) {
    test(`treats ${method} as a send`, async ({ page, context }) => {
      const egress = await watchEgress(context);
      egress.watch('secret', SECRET);
      await openProbePage(page);
      await leak(page, workerSend(method));
      const { violations, unreadable } = await egress.finish();
      expect([...violations, ...unreadable]).not.toEqual([]);
    });
  }

  // An aborted fetch never went out, so its hook record cannot vouch for the worker's send.
  test('does not let a send that never went out vouch for another', async ({ page, context }) => {
    const egress = await watchEgress(context);
    egress.watch('secret', SECRET);
    await openProbePage(page);
    await leak(
      page,
      `(async () => {
        try {
          await fetch('/p', { method: 'POST', body: new Blob(['x']), signal: AbortSignal.abort() });
        } catch (e) { void e; }
        await ${workerSend('POST')};
      })()`,
    );
    const { violations, unreadable } = await egress.finish();
    expect([...violations, ...unreadable]).not.toEqual([]);
  });

  // A second send on the same XHR throws instead of going out, and fires no event. Its hook
  // record used to stay claimable and excuse the worker's send.
  test('does not let an XHR send that threw vouch for another', async ({ page, context }) => {
    const egress = await watchEgress(context);
    egress.watch('secret', SECRET);
    await openProbePage(page);
    await leak(
      page,
      `(async () => {
        const x = new XMLHttpRequest();
        x.open('POST', '/p');
        x.send(new Blob(['first']));
        try { x.send(new Blob(['second'])); } catch (e) { void e; }
        await ${workerSend('POST')};
      })()`,
    );
    const { violations, unreadable } = await egress.finish();
    expect([...violations, ...unreadable]).not.toEqual([]);
  });

  // A send that failed may have sent part of its body first, so it counts as unread rather
  // than read. Chromium still records the aborted XHR and the refused beacon at the network
  // layer, each with no body: both must be reported, not paired with their own hook record.
  // The refused beacon's headers never arrive either, which used to hang finish() for good.
  test('reports an aborted XHR and a refused beacon as unread', async ({ page, context }) => {
    // The refused beacon never settles, so finish() spends its full in-flight wait on it.
    test.setTimeout(45_000);
    const egress = await watchEgress(context);
    egress.watch('secret', SECRET);
    await openProbePage(page);
    const queued = await page.evaluate(() => {
      const x = new XMLHttpRequest();
      x.open('POST', '/aborted');
      x.send(new Blob(['harmless']));
      x.abort();
      // Over the 64 KiB beacon quota, so the browser refuses it.
      return navigator.sendBeacon('/refused', new Blob([new Uint8Array(70_000)]));
    });
    expect(queued).toBe(false);
    const { unreadable, records } = await egress.finish();
    expect(unreadable).toEqual(
      expect.arrayContaining([`network POST ${origin}/aborted`, `network POST ${origin}/refused`]),
    );
    // The hook marked both sends failed itself, rather than the network layer happening to.
    for (const path of ['/aborted', '/refused']) {
      const hooked = records.find((r) => r.channel !== 'network' && r.url === origin + path);
      expect(hooked?.failed, path).toBe(true);
    }
  });

  // A request that never settles used to cost the full in-flight wait once per page, so three
  // pages took over 30 s. The wait is now one deadline for the whole of finish().
  test('spends the in-flight wait once, however many pages are open', async ({ context }) => {
    test.setTimeout(60_000);
    const egress = await watchEgress(context);
    egress.watch('secret', SECRET);
    const pages = await Promise.all([context.newPage(), context.newPage(), context.newPage()]);
    for (const p of pages) await openProbePage(p);
    // Over the beacon quota: the browser refuses it, and Playwright never settles the request.
    const queued = await pages[0]!.evaluate(() =>
      navigator.sendBeacon('/refused', new Blob([new Uint8Array(70_000)])),
    );
    expect(queued).toBe(false);
    const started = Date.now();
    await egress.finish();
    expect(Date.now() - started).toBeLessThan(15_000);
  });

  // If leaving a page fails (here, the page closes while finish() waits), finish() rejects;
  // the context must not be left aborting every request after that.
  test('stops aborting requests even when finish() fails', async ({ context }) => {
    test.setTimeout(30_000);
    const egress = await watchEgress(context);
    const [first, second] = await Promise.all([context.newPage(), context.newPage()]);
    await openProbePage(first!);
    await openProbePage(second!);
    // Keeps finish() waiting long enough to close a page under it.
    await first!.evaluate(() => {
      void fetch('/slow-hold');
    });
    const finishing = egress.finish();
    await new Promise((resolve) => setTimeout(resolve, 1_200));
    await second!.close();
    await expect(finishing).rejects.toThrow();
    const after = await context.newPage();
    await openProbePage(after);
    expect(await after.evaluate(() => fetch('/p').then((r) => r.status))).toBe(204);
  });

  // Listeners added per send used to stay on a reused XHR, so a later abort marked every
  // earlier send on it as failed too.
  test('a later failure on a reused XHR marks only that send', async ({ page, context }) => {
    const egress = await watchEgress(context);
    egress.watch('secret', SECRET);
    await openProbePage(page);
    await page.evaluate(async () => {
      const x = new XMLHttpRequest();
      await new Promise((resolve) => {
        x.onloadend = resolve;
        x.open('POST', '/first');
        x.send(new Blob(['harmless']));
      });
      x.onloadend = null;
      x.open('POST', '/second');
      x.send(new Blob(['harmless']));
      x.abort();
    });
    const { unreadable, records } = await egress.finish();
    expect(unreadable).not.toContain(`network POST ${origin}/first`);
    expect(unreadable).toContain(`network POST ${origin}/second`);
    const hooked = (path: string) =>
      records.find((r) => r.channel === 'xhr' && r.url === origin + path);
    expect(hooked('/first')?.failed).toBe(false);
    expect(hooked('/second')?.failed).toBe(true);
  });

  // Headers arrive with the response, so a slow server used to make a harmless request look
  // unreadable once it passed the watcher's wait. The wait now starts only in finish().
  test('does not report a slow response as unread', async ({ page, context }) => {
    test.setTimeout(30_000);
    const egress = await watchEgress(context);
    egress.watch('secret', SECRET);
    await openProbePage(page);
    await page.evaluate(async () => {
      await fetch('/slow-get');
      await fetch('/slow-post', { method: 'POST', body: 'harmless' });
    });
    const { violations, unreadable } = await egress.finish();
    expect({ violations, unreadable }).toEqual({ violations: [], unreadable: [] });
  });

  // Leaving a page cancels what is still in flight, and a cancelled request never gets its
  // headers. finish() now waits for those requests first, so a slow one is read, not cut off.
  test('does not report a request still in flight at finish() as unread', async ({
    page,
    context,
  }) => {
    test.setTimeout(30_000);
    const egress = await watchEgress(context);
    egress.watch('secret', SECRET);
    await openProbePage(page);
    await page.evaluate(() => {
      void fetch('/slow-in-flight-get');
      void fetch('/slow-in-flight-post', { method: 'POST', body: 'harmless' });
    });
    const { violations, unreadable } = await egress.finish();
    expect({ violations, unreadable }).toEqual({ violations: [], unreadable: [] });
  });

  // finish() used to wait for the in-flight set to empty, which steady traffic never lets
  // happen: it waited out the full limit, then cut the requests off as unread. It now waits
  // only for what was in flight when it started, and aborts what starts after.
  test('finishes promptly under steady traffic and reports none of it as unread', async ({
    page,
    context,
  }) => {
    test.setTimeout(30_000);
    const egress = await watchEgress(context);
    egress.watch('secret', SECRET);
    await openProbePage(page);
    await page.evaluate(() => {
      setInterval(() => {
        fetch('/mid-tick').catch((e: unknown) => e);
        fetch('/mid-tick', { method: 'POST', body: 'harmless' }).catch((e: unknown) => e);
      }, 150);
    });
    await page.waitForTimeout(700);
    const started = Date.now();
    const { violations, unreadable } = await egress.finish();
    expect(Date.now() - started).toBeLessThan(8_000);
    expect({ violations, unreadable }).toEqual({ violations: [], unreadable: [] });
  });

  // A page route of the test's own outranks the watcher's abort, so new requests keep going
  // out and the in-flight set never empties. Waiting only for what was in flight when finish()
  // started keeps it prompt; the requests cut off after that are reported, failing closed.
  test('finishes promptly when a page route keeps new requests going', async ({
    page,
    context,
  }) => {
    test.setTimeout(30_000);
    const egress = await watchEgress(context);
    egress.watch('secret', SECRET);
    await page.route('**/mid-tick*', (route) => route.continue());
    await openProbePage(page);
    await page.evaluate(() => {
      setInterval(() => {
        fetch('/mid-tick').catch((e: unknown) => e);
      }, 150);
    });
    await page.waitForTimeout(700);
    const started = Date.now();
    const { violations } = await egress.finish();
    expect(Date.now() - started).toBeLessThan(8_000);
    expect(violations).toEqual([]);
  });

  // A second send that throws must not take over the failure callback of the send still in
  // flight: that send's abort has to mark it, not the one that never went out.
  test('a send that threw leaves the in-flight send its own failure', async ({ page, context }) => {
    const egress = await watchEgress(context);
    egress.watch('secret', SECRET);
    await openProbePage(page);
    await page.evaluate(() => {
      const x = new XMLHttpRequest();
      x.open('POST', '/slow-first');
      x.send(new Blob(['first']));
      try {
        x.send(new Blob(['second']));
      } catch (e) {
        void e;
      }
      x.abort();
    });
    const { unreadable, records } = await egress.finish();
    const sends = records.filter((r) => r.channel === 'xhr');
    expect(sends.find((r) => r.body === 'first')?.failed).toBe(true);
    expect(sends.find((r) => r.body === 'second')?.failed).toBe(true);
    expect(unreadable).toContain(`network POST ${origin}/slow-first`);
  });

  // sendBeacon throws for a URL it will not send to. That send never went out.
  test('marks a beacon that threw as failed', async ({ page, context }) => {
    const egress = await watchEgress(context);
    egress.watch('secret', SECRET);
    await openProbePage(page);
    const outcome = await page.evaluate(() => {
      try {
        navigator.sendBeacon('ftp://example.invalid/p', 'harmless');
        return 'sent';
      } catch {
        return 'threw';
      }
    });
    expect(outcome).toBe('threw');
    const { records } = await egress.finish();
    expect(records.find((r) => r.channel === 'beacon')?.failed).toBe(true);
  });

  // fetch reports a bad URL as a rejected promise. The hook used to throw synchronously,
  // which changed how the app's own error handling saw it.
  test('keeps fetch failures asynchronous', async ({ page, context }) => {
    await watchEgress(context);
    await openProbePage(page);
    const outcome = await page.evaluate(() => {
      try {
        return fetch('http://[bad').then(
          () => 'resolved',
          () => 'rejected',
        );
      } catch {
        return 'threw';
      }
    });
    expect(outcome).toBe('rejected');
  });

  // The page hook does not run inside workers. A worker's unread send to the same URL as a
  // send the hook did read must still count as unread: one hook record vouches for one send.
  test('does not let a readable send vouch for an unread one to the same URL', async ({
    page,
    context,
  }) => {
    const egress = await watchEgress(context);
    egress.watch('secret', SECRET);
    await openProbePage(page);
    await leak(
      page,
      `(async () => {
        await fetch('/p', { method: 'POST', body: new Blob(['harmless']) });
        // A blob worker cannot resolve a relative URL. Its network record has no body at all.
        const code = "fetch('" + location.origin + "/p', { method: 'POST', body: new Blob([self.name]) }).then(() => postMessage('sent'), (e) => postMessage('failed ' + e));";
        const worker = new Worker(URL.createObjectURL(new Blob([code])), { name: S });
        const sent = await new Promise((r) => { worker.onmessage = (e) => r(e.data); });
        if (sent !== 'sent') throw new Error(String(sent));
      })()`,
    );
    const { violations, unreadable } = await egress.finish();
    expect([...violations, ...unreadable]).not.toEqual([]);
  });

  // A beacon sent while the page is being left may not be readable by either layer. It must
  // still fail the real test: caught as a leak, or reported as a body nobody could read.
  test('does not let a beacon on pagehide pass silently', async ({ page, context }) => {
    const egress = await watchEgress(context);
    egress.watch('secret', SECRET);
    await openProbePage(page);
    await leak(
      page,
      `addEventListener('pagehide', () => navigator.sendBeacon('/p', new Blob([S])))`,
    );
    const { violations, unreadable } = await egress.finish();
    expect([...violations, ...unreadable]).not.toEqual([]);
  });

  test('catches a beacon sent only once the page is hidden', async ({ page, context }) => {
    const egress = await watchEgress(context);
    egress.watch('secret', SECRET);
    await openProbePage(page);
    await leak(
      page,
      `document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') navigator.sendBeacon('/p', S);
      })`,
    );
    const { violations } = await egress.finish();
    expect(violations).not.toEqual([]);
  });

  test('catches a WebSocket frame sent from a worker', async ({ page, context }) => {
    const egress = await watchEgress(context);
    egress.watch('secret', SECRET);
    await openProbePage(page);
    await leak(
      page,
      `(async () => {
        const code = "const ws = new WebSocket(" + JSON.stringify(WS) + "); ws.onopen = () => { ws.send(self.name); postMessage('sent'); }; ws.onerror = () => postMessage('failed');";
        const worker = new Worker(URL.createObjectURL(new Blob([code])), { name: S });
        const sent = await new Promise((r) => { worker.onmessage = (e) => r(e.data); });
        if (sent !== 'sent') throw new Error(String(sent));
      })()`,
    );
    const { violations, unreadable } = await egress.finish();
    expect([...violations, ...unreadable]).not.toEqual([]);
  });

  test('reports a body it cannot read instead of passing it', async ({ page, context }) => {
    const egress = await watchEgress(context);
    egress.watch('secret', SECRET);
    await openProbePage(page);
    await leak(
      page,
      `(async () => {
        const body = new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode('opaque')); c.close(); } });
        try { await fetch('/p', { method: 'POST', body, duplex: 'half' }); } catch (e) { void e; }
      })()`,
    );
    const { unreadable } = await egress.finish();
    expect(unreadable).not.toEqual([]);
  });

  test('reports nothing for traffic that carries no watched value', async ({ page, context }) => {
    const egress = await watchEgress(context);
    egress.watch('secret', SECRET);
    await openProbePage(page);
    await leak(
      page,
      `(async () => {
        await fetch('/p', { method: 'POST', body: JSON.stringify({ ciphertext: 'q7Hf0zX2', nonce: [1, 2, 3] }) });
        await fetch('/p', { method: 'POST', body: new Blob(['harmless']) });
        await fetch(new Request('/p', { method: 'POST', body: new Uint8Array([1, 2, 3]) }));
        await fetch('/p', { method: 'POST' });
        await fetch('/p', { method: 'POST', body: JSON.stringify([300, 115, 107, 95, 108, 105, 118, 101]) });
        navigator.sendBeacon('/p', 'ping');
      })()`,
    );
    const { violations, unreadable } = await egress.finish();
    expect({ violations, unreadable }).toEqual({ violations: [], unreadable: [] });
  });
});
