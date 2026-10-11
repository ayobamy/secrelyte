import { CLIPBOARD_CLEAR_MS } from './timing';

/**
 * Where a copied secret is in its life on the clipboard.
 * - holding: copied, the clear is scheduled.
 * - clear-pending: the clear was refused, so the secret is still on the clipboard. Browsers
 *   refuse clipboard writes from a tab without focus, and some (Firefox, Safari) refuse any
 *   write that does not come from a click. Retried when the tab regains focus; a click on the
 *   "clear now" control always counts as a click. Also where a guard starts when a secret
 *   copied before a reload may still be there.
 * - cleared: overwritten with an empty string.
 */
export type ClipboardState = 'idle' | 'holding' | 'clear-pending' | 'cleared';

export type ClipboardDeps = {
  write: (text: string) => Promise<void>;
  setTimer: (fn: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
  /** Calls `fn` when the page regains focus or becomes visible; returns an unsubscribe. */
  onRefocus: (fn: () => void) => () => void;
  /**
   * A note, kept for this tab across reloads, that a copied secret may still be on the
   * clipboard. A reload or navigation runs no cleanup (browsers drop a clipboard write made
   * while the page is being left), so the next guard in the tab reads the note and clears.
   * Holds a flag only, never the value.
   */
  note: { set: (uncleared: boolean) => void; get: () => boolean };
};

export type ClipboardGuard = {
  /** Writes `value` and restarts the clear timer. A failed write throws and changes nothing. */
  copy: (value: string) => Promise<void>;
  /** Clears now if a copied secret may be on the clipboard: on lock, unmount, or a click. */
  clearNow: () => Promise<void>;
  state: () => ClipboardState;
};

export function createClipboardGuard(
  deps: ClipboardDeps,
  onState: (state: ClipboardState) => void,
  clearAfterMs: number = CLIPBOARD_CLEAR_MS,
): ClipboardGuard {
  // A secret copied before a reload may still be there: start as a refused clear would.
  let current: ClipboardState = deps.note.get() ? 'clear-pending' : 'idle';
  let timer: unknown = null;
  let unsubscribe: (() => void) | null = null;

  /**
   * Every write goes through this chain, one at a time. Without it, a copy still in flight
   * when the vault locks lands after the lock's clear, and a refused clear that settles late
   * overwrites the state of a newer copy.
   *
   * When nothing is queued the operation starts at once, in the caller's own task: a copy or
   * a "clear now" then calls the clipboard inside the click that asked for it, which browsers
   * that require a user gesture for every write insist on. Only an operation that has to wait
   * for another one runs later.
   */
  let chain: Promise<void> = Promise.resolve();
  let queued = 0;
  const settled = (): void => {
    queued -= 1;
  };
  function serial(op: () => Promise<void>): Promise<void> {
    const run = queued === 0 ? op() : chain.then(op);
    queued += 1;
    // A failed copy rejects `run`, which its caller reports; the chain itself carries on.
    chain = run.then(settled, settled);
    return run;
  }

  function set(next: ClipboardState): void {
    current = next;
    onState(next);
  }

  function stopWaiting(): void {
    if (timer !== null) {
      deps.clearTimer(timer);
      timer = null;
    }
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  }

  function clearOp(): Promise<void> {
    return serial(async () => {
      if (current !== 'holding' && current !== 'clear-pending') return;
      stopWaiting();
      try {
        await deps.write('');
        deps.note.set(false);
        set('cleared');
      } catch {
        // Refused, typically because the tab has no focus. Stay visible and retry on return.
        set('clear-pending');
        unsubscribe = deps.onRefocus(() => {
          void clearOp();
        });
      }
    });
  }

  if (current === 'clear-pending') {
    onState(current);
    void clearOp();
  }

  return {
    copy(value) {
      return serial(async () => {
        // Noted before the write, so a reload that lands mid-write still finds it. A failed
        // write changed nothing on the clipboard, so the note goes back to what it was.
        deps.note.set(true);
        try {
          await deps.write(value);
        } catch (err) {
          deps.note.set(current === 'holding' || current === 'clear-pending');
          throw err;
        }
        stopWaiting();
        set('holding');
        timer = deps.setTimer(() => {
          timer = null;
          void clearOp();
        }, clearAfterMs);
      });
    },
    clearNow: clearOp,
    state: () => current,
  };
}

const NOTE_KEY = 'secrelyte.clipboard-uncleared';

/** Browser wiring for createClipboardGuard. */
export function browserClipboardDeps(): ClipboardDeps {
  return {
    // sessionStorage can be missing or throw (storage disabled). The note is then lost, which
    // costs only the after-reload clear; the in-page timer and lock clears still run.
    note: {
      set: (uncleared) => {
        try {
          if (uncleared) sessionStorage.setItem(NOTE_KEY, '1');
          else sessionStorage.removeItem(NOTE_KEY);
        } catch (err) {
          console.warn('clipboard note not saved', err);
        }
      },
      get: () => {
        try {
          return sessionStorage.getItem(NOTE_KEY) === '1';
        } catch (err) {
          console.warn('clipboard note not read', err);
          return false;
        }
      },
    },
    write: (text) => navigator.clipboard.writeText(text),
    setTimer: (fn, ms) => window.setTimeout(fn, ms),
    clearTimer: (handle) => window.clearTimeout(handle as number),
    onRefocus: (fn) => {
      const onVisible = () => {
        if (document.visibilityState === 'visible') fn();
      };
      window.addEventListener('focus', fn);
      document.addEventListener('visibilitychange', onVisible);
      return () => {
        window.removeEventListener('focus', fn);
        document.removeEventListener('visibilitychange', onVisible);
      };
    },
  };
}
