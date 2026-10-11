import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CLIPBOARD_CLEAR_MS, createClipboardGuard, type ClipboardState } from '@/services/vault';

/**
 * A fake clipboard that can refuse writes the way a browser does when the tab has no focus,
 * and a refocus signal the test fires by hand.
 */
/** `start` is the tab as a reload leaves it: what the clipboard holds, and the note. */
function harness(start: { note?: boolean; text?: string; refuseWrites?: boolean } = {}) {
  const board = {
    text: start.text ?? '',
    refuseWrites: start.refuseWrites ?? false,
    defer: false,
  };
  // The tab's note that a secret may still be on the clipboard, as it survives a reload.
  const note = { uncleared: start.note ?? false };
  // With defer on, each write waits until the test settles it, so operations can overlap.
  const inFlight: Array<{ text: string; land: () => void; refuse: () => void }> = [];
  const refocus = new Set<() => void>();
  const states: ClipboardState[] = [];
  const write = vi.fn(async (text: string) => {
    if (board.defer) {
      await new Promise<void>((resolve, reject) => {
        inFlight.push({
          text,
          land: () => {
            board.text = text;
            resolve();
          },
          refuse: () => reject(new DOMException('Document is not focused.', 'NotAllowedError')),
        });
      });
      return;
    }
    if (board.refuseWrites) throw new DOMException('Document is not focused.', 'NotAllowedError');
    board.text = text;
  });
  const guard = createClipboardGuard(
    {
      write,
      setTimer: (fn, ms) => setTimeout(fn, ms),
      clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
      onRefocus: (fn) => {
        refocus.add(fn);
        return () => refocus.delete(fn);
      },
      note: {
        set: (uncleared) => {
          note.uncleared = uncleared;
        },
        get: () => note.uncleared,
      },
    },
    (state) => states.push(state),
  );
  const fireRefocus = async () => {
    for (const fn of [...refocus]) fn();
    await vi.advanceTimersByTimeAsync(0);
  };
  const settle = async (action: 'land' | 'refuse') => {
    await vi.advanceTimersByTimeAsync(0);
    const next = inFlight.shift();
    if (!next) throw new Error('no write in flight');
    next[action]();
    await vi.advanceTimersByTimeAsync(0);
  };
  return { board, note, refocus, states, write, guard, fireRefocus, inFlight, settle };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('clipboard guard', () => {
  it('copies, then clears at exactly 45 seconds and says so', async () => {
    const h = harness();
    await h.guard.copy('sk_live_ONE');
    expect(h.board.text).toBe('sk_live_ONE');
    expect(h.guard.state()).toBe('holding');

    await vi.advanceTimersByTimeAsync(CLIPBOARD_CLEAR_MS - 1);
    expect(h.board.text).toBe('sk_live_ONE');

    await vi.advanceTimersByTimeAsync(1);
    expect(h.board.text).toBe('');
    expect(h.states).toEqual(['holding', 'cleared']);
  });

  it('gives a second copy its own full 45 seconds', async () => {
    const h = harness();
    await h.guard.copy('sk_live_ONE');
    await vi.advanceTimersByTimeAsync(40_000);
    await h.guard.copy('sk_live_TWO');

    // The first copy's timer would have fired here and wiped the second value.
    await vi.advanceTimersByTimeAsync(10_000);
    expect(h.board.text).toBe('sk_live_TWO');

    await vi.advanceTimersByTimeAsync(CLIPBOARD_CLEAR_MS - 10_000);
    expect(h.board.text).toBe('');
  });

  it('keeps trying when the clear is refused, and clears on return to the tab', async () => {
    const h = harness();
    await h.guard.copy('sk_live_ONE');
    h.board.refuseWrites = true;
    await vi.advanceTimersByTimeAsync(CLIPBOARD_CLEAR_MS);

    expect(h.board.text).toBe('sk_live_ONE');
    expect(h.guard.state()).toBe('clear-pending');
    expect(h.refocus.size).toBe(1);

    // Still unfocused: another refusal keeps it pending, with exactly one listener.
    await h.fireRefocus();
    expect(h.guard.state()).toBe('clear-pending');
    expect(h.refocus.size).toBe(1);

    h.board.refuseWrites = false;
    await h.fireRefocus();
    expect(h.board.text).toBe('');
    expect(h.guard.state()).toBe('cleared');
    expect(h.refocus.size).toBe(0);
  });

  it('a failed copy throws and schedules nothing', async () => {
    const h = harness();
    h.board.refuseWrites = true;
    await expect(h.guard.copy('sk_live_ONE')).rejects.toThrow('not focused');
    expect(h.guard.state()).toBe('idle');
    h.board.refuseWrites = false;
    await vi.advanceTimersByTimeAsync(CLIPBOARD_CLEAR_MS * 2);
    expect(h.write).toHaveBeenCalledTimes(1);
  });

  it('clearNow clears at once and cancels the scheduled clear', async () => {
    const h = harness();
    await h.guard.copy('sk_live_ONE');
    await h.guard.clearNow();
    expect(h.board.text).toBe('');
    expect(h.guard.state()).toBe('cleared');

    h.board.text = 'something the user copied later';
    await vi.advanceTimersByTimeAsync(CLIPBOARD_CLEAR_MS);
    expect(h.board.text).toBe('something the user copied later');
  });

  // Safari and Firefox refuse a clipboard write that does not run inside the user's click.
  it('starts the write inside the call that asked for it when nothing is queued', async () => {
    const h = harness();
    const copying = h.guard.copy('sk_live_ONE');
    expect(h.write).toHaveBeenCalledWith('sk_live_ONE');
    await copying;
    const clearing = h.guard.clearNow();
    expect(h.write).toHaveBeenLastCalledWith('');
    await clearing;
  });

  it('clearNow does nothing when no secret was copied', async () => {
    const h = harness();
    await h.guard.clearNow();
    expect(h.write).not.toHaveBeenCalled();
  });
  // A reload or navigation runs no cleanup, so the next page in the tab has to do it.
  describe('after a reload', () => {
    it('notes a copy until it is cleared', async () => {
      const h = harness();
      await h.guard.copy('sk_live_ONE');
      expect(h.note.uncleared).toBe(true);
      await vi.advanceTimersByTimeAsync(CLIPBOARD_CLEAR_MS);
      expect(h.note.uncleared).toBe(false);
    });

    it('keeps the note while a clear is refused', async () => {
      const h = harness();
      await h.guard.copy('sk_live_ONE');
      h.board.refuseWrites = true;
      await vi.advanceTimersByTimeAsync(CLIPBOARD_CLEAR_MS);
      expect(h.note.uncleared).toBe(true);
    });

    it('notes a copy before its write lands, so a reload mid-write still clears', async () => {
      const h = harness();
      h.board.defer = true;
      const copying = h.guard.copy('sk_live_ONE');
      await vi.advanceTimersByTimeAsync(0);
      expect(h.inFlight).toHaveLength(1);
      expect(h.note.uncleared).toBe(true);
      await h.settle('land');
      await copying;
    });

    it('a failed copy after a held one keeps the note for the secret still there', async () => {
      const h = harness();
      await h.guard.copy('sk_live_ONE');
      h.board.refuseWrites = true;
      await expect(h.guard.copy('sk_live_TWO')).rejects.toThrow('not focused');
      expect(h.note.uncleared).toBe(true);
    });

    it('a failed copy leaves no note', async () => {
      const h = harness();
      h.board.refuseWrites = true;
      await expect(h.guard.copy('sk_live_ONE')).rejects.toThrow('not focused');
      expect(h.note.uncleared).toBe(false);
    });

    it('a guard that finds the note clears at once and says so', async () => {
      const h = harness({ note: true, text: 'sk_live_LEFT_BEHIND' });
      await vi.advanceTimersByTimeAsync(0);
      expect(h.board.text).toBe('');
      expect(h.states).toEqual(['clear-pending', 'cleared']);
      expect(h.note.uncleared).toBe(false);
    });

    it('a guard that finds the note but cannot clear keeps the warning up', async () => {
      const h = harness({ note: true, text: 'sk_live_LEFT_BEHIND', refuseWrites: true });
      await vi.advanceTimersByTimeAsync(0);
      expect(h.guard.state()).toBe('clear-pending');
      expect(h.board.text).toBe('sk_live_LEFT_BEHIND');
      expect(h.refocus.size).toBe(1);
      h.board.refuseWrites = false;
      await h.guard.clearNow();
      expect(h.board.text).toBe('');
      expect(h.guard.state()).toBe('cleared');
    });

    it('a guard with no note writes nothing', async () => {
      const h = harness();
      await vi.advanceTimersByTimeAsync(CLIPBOARD_CLEAR_MS);
      expect(h.write).not.toHaveBeenCalled();
      expect(h.guard.state()).toBe('idle');
    });
  });

  // Overlapping operations. Each of these left the wrong outcome before writes were serialized.
  describe('overlapping operations', () => {
    it('a lock during an in-flight copy still clears it', async () => {
      const h = harness();
      h.board.defer = true;
      const copying = h.guard.copy('sk_live_ONE');
      const locking = h.guard.clearNow();
      await h.settle('land'); // the copy lands after the lock was requested
      await h.settle('land'); // the lock's clear runs after it
      await Promise.all([copying, locking]);
      expect(h.board.text).toBe('');
      expect(h.guard.state()).toBe('cleared');
      // No timer left behind to fire later.
      await vi.advanceTimersByTimeAsync(CLIPBOARD_CLEAR_MS * 2);
      expect(h.write).toHaveBeenCalledTimes(2);
    });

    it('a refused timed clear followed by a successful lock clear leaves no listener', async () => {
      const h = harness();
      await h.guard.copy('sk_live_ONE');
      h.board.defer = true;
      await vi.advanceTimersByTimeAsync(CLIPBOARD_CLEAR_MS); // timed clear now in flight
      const locking = h.guard.clearNow();
      await h.settle('refuse'); // timed clear refused
      await h.settle('land'); // lock's clear succeeds
      await locking;
      expect(h.guard.state()).toBe('cleared');
      expect(h.refocus.size).toBe(0);
      // A later focus must not wipe something the user copied elsewhere.
      h.board.defer = false;
      h.board.text = 'copied elsewhere';
      await h.fireRefocus();
      expect(h.board.text).toBe('copied elsewhere');
    });

    it('a refused stale clear does not override a newer copy', async () => {
      const h = harness();
      await h.guard.copy('sk_live_ONE');
      h.board.defer = true;
      await vi.advanceTimersByTimeAsync(CLIPBOARD_CLEAR_MS); // first value's clear in flight
      const copying = h.guard.copy('sk_live_TWO');
      // Never two writes at once: whichever landed last would win, in either order.
      await vi.advanceTimersByTimeAsync(0);
      expect(h.inFlight).toHaveLength(1);
      await h.settle('refuse'); // stale clear refused
      await h.settle('land'); // new copy lands
      await copying;
      expect(h.board.text).toBe('sk_live_TWO');
      expect(h.guard.state()).toBe('holding');
      expect(h.refocus.size).toBe(0);
      h.board.defer = false;
      await vi.advanceTimersByTimeAsync(CLIPBOARD_CLEAR_MS);
      expect(h.board.text).toBe('');
    });

    it('a failed copy does not stop the earlier copy from being cleared', async () => {
      const h = harness();
      await h.guard.copy('sk_live_ONE');
      h.board.refuseWrites = true;
      await expect(h.guard.copy('sk_live_TWO')).rejects.toThrow('not focused');
      h.board.refuseWrites = false;
      await vi.advanceTimersByTimeAsync(CLIPBOARD_CLEAR_MS);
      expect(h.board.text).toBe('');
    });
  });
});
