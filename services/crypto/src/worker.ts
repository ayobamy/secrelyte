import { argon2id32, type Argon2Job } from './argon2';

export type Argon2WorkerOk = { ok: true; mk: Uint8Array };
export type Argon2WorkerErr = { ok: false; error: string };
export type Argon2WorkerResult = Argon2WorkerOk | Argon2WorkerErr;

export type Argon2WorkerScope = {
  onmessage: ((event: MessageEvent<Argon2Job>) => void) | null;
  postMessage: (message: Argon2WorkerResult, transfer?: Transferable[]) => void;
  close: () => void;
};

export function argon2WorkerErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'argon2 failed';
}

export async function handleArgon2WorkerJob(
  job: Argon2Job,
  postMessage: Argon2WorkerScope['postMessage'],
): Promise<void> {
  try {
    const mk = await argon2id32(job);
    postMessage({ ok: true, mk }, [mk.buffer]);
  } catch (err: unknown) {
    postMessage({ ok: false, error: argon2WorkerErrorMessage(err) });
  }
}

export function installArgon2Worker(scope: Argon2WorkerScope): void {
  scope.onmessage = (event: MessageEvent<Argon2Job>) => {
    void handleArgon2WorkerJob(event.data, scope.postMessage.bind(scope)).finally(() => {
      scope.close();
    });
  };
}

/* v8 ignore start */
function maybeInstallDedicatedWorker(): void {
  const ctor = (globalThis as { DedicatedWorkerGlobalScope?: new () => Argon2WorkerScope })
    .DedicatedWorkerGlobalScope;
  if (!ctor) {
    return;
  }
  if (self instanceof ctor) {
    installArgon2Worker(self as unknown as Argon2WorkerScope);
  }
}

maybeInstallDedicatedWorker();
/* v8 ignore stop */
