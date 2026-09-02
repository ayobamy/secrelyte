import { afterEach, describe, expect, it, vi } from 'vitest';
import { argon2id32 } from '../src/argon2';
import { hkdfSha256 } from '../src/hkdf';
import { argon2InWorker, argon2OffMainThreadAvailable, deriveMasterKey } from '../src/kdf';
import {
  argon2WorkerErrorMessage,
  handleArgon2WorkerJob,
  installArgon2Worker,
} from '../src/worker';
import { asBytes16, utf8 } from '@/services/crypto';

class FakeWorker {
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  terminated = false;
  readonly mode: 'ok' | 'err' | 'hang' | 'error-event';
  readonly payload: Uint8Array;

  constructor(mode: FakeWorker['mode'] = 'ok', payload = new Uint8Array(32).fill(4)) {
    this.mode = mode;
    this.payload = payload;
  }

  postMessage(): void {
    queueMicrotask(() => {
      if (this.mode === 'hang') {
        return;
      }
      if (this.mode === 'error-event') {
        this.onerror?.(new Error('worker crashed') as unknown as ErrorEvent);
        return;
      }
      if (this.mode === 'err') {
        this.onmessage?.({ data: { ok: false, error: 'worker failed' } } as MessageEvent);
        return;
      }
      this.onmessage?.({ data: { ok: true, mk: this.payload } } as MessageEvent);
    });
  }

  terminate(): void {
    this.terminated = true;
  }
}

describe('HKDF', () => {
  it('is stable with an explicit empty salt and a provided salt', async () => {
    const ikm = utf8('ikm');
    const a = await hkdfSha256({ ikm, info: 'info', length: 16 });
    const b = await hkdfSha256({ ikm, info: 'info', length: 16, salt: new Uint8Array() });
    const c = await hkdfSha256({ ikm, info: 'info', length: 16, salt: utf8('salt') });
    expect(Buffer.from(a).toString('hex')).toBe(Buffer.from(b).toString('hex'));
    expect(Buffer.from(a).toString('hex')).not.toBe(Buffer.from(c).toString('hex'));
  });
});

describe('argon2 worker client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resolves transferred key material from a worker', async () => {
    const worker = new FakeWorker('ok', new Uint8Array(32).fill(9));
    const mk = await argon2InWorker(
      'pw',
      asBytes16(new Uint8Array(16)),
      undefined,
      worker as unknown as Worker,
    );
    expect(Array.from(mk)).toEqual(Array.from(new Uint8Array(32).fill(9)));
    expect(worker.terminated).toBe(true);
  });

  it('rejects a worker error payload', async () => {
    const worker = new FakeWorker('err');
    await expect(
      argon2InWorker('pw', asBytes16(new Uint8Array(16)), undefined, worker as unknown as Worker),
    ).rejects.toThrow('worker failed');
  });

  it('rejects on worker onerror', async () => {
    const worker = new FakeWorker('error-event');
    await expect(
      argon2InWorker('pw', asBytes16(new Uint8Array(16)), undefined, worker as unknown as Worker),
    ).rejects.toThrow('worker crashed');
  });

  it('times out a silent worker', async () => {
    const worker = new FakeWorker('hang');
    await expect(
      argon2InWorker(
        'pw',
        asBytes16(new Uint8Array(16)),
        undefined,
        worker as unknown as Worker,
        20,
      ),
    ).rejects.toThrow('argon2 worker timeout');
    expect(worker.terminated).toBe(true);
  });

  it('uses a Worker when the constructor exists', async () => {
    vi.stubGlobal(
      'Worker',
      class StubWorker extends FakeWorker {
        constructor() {
          super('ok', new Uint8Array(32).fill(6));
        }
      },
    );
    expect(argon2OffMainThreadAvailable()).toBe(true);
    const mk = await deriveMasterKey('pw', asBytes16(new Uint8Array(16)));
    expect(mk[0]).toBe(6);
  });
});

describe('argon2 worker handler', () => {
  it('posts transferred MK bytes on success', async () => {
    const posted: Array<{ ok: boolean; mk?: Uint8Array; error?: string }> = [];
    await handleArgon2WorkerJob({ password: 'pw', salt: new Uint8Array(16).fill(1) }, (message) => {
      posted.push(
        message.ok
          ? { ok: true, mk: new Uint8Array(message.mk) }
          : { ok: false, error: message.error },
      );
    });
    expect(posted[0]?.ok).toBe(true);
    expect(posted[0]?.mk?.byteLength).toBe(32);
  });

  it('posts a string error when argon2 throws', async () => {
    const posted: Array<{ ok: boolean; error?: string }> = [];
    await handleArgon2WorkerJob({ password: 'pw', salt: new Uint8Array(1) }, (message) => {
      posted.push(message);
    });
    expect(posted[0]).toEqual({ ok: false, error: expect.any(String) });
  });

  it('installs a one-shot handler that closes the scope', async () => {
    let closed = false;
    const scope = {
      onmessage: null as
        ((event: MessageEvent<{ password: string; salt: Uint8Array }>) => void) | null,
      close: () => {
        closed = true;
      },
      postMessage: () => undefined,
    };
    installArgon2Worker(scope);
    expect(scope.onmessage).toBeTypeOf('function');
    await new Promise<void>((resolve) => {
      const original = scope.postMessage;
      scope.postMessage = () => {
        original();
        queueMicrotask(resolve);
      };
      scope.onmessage?.({
        data: { password: 'pw', salt: new Uint8Array(16).fill(2) },
      } as MessageEvent<{ password: string; salt: Uint8Array }>);
    });
    expect(closed).toBe(true);
  });

  it('classifies Error and non-Error failures', () => {
    expect(argon2WorkerErrorMessage(new Error('nope'))).toBe('nope');
    expect(argon2WorkerErrorMessage('nope')).toBe('argon2 failed');
  });
});

describe('argon2id32', () => {
  it('hashes with explicit params', async () => {
    const out = await argon2id32({
      password: 'pw',
      salt: new Uint8Array(16).fill(3),
      params: { m: 65536, t: 3, p: 1, v: 1 },
    });
    expect(out.byteLength).toBe(32);
  });
});
