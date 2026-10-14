'use client';

import Link from 'next/link';
import type { FormEvent } from 'react';
import { AuthShell, Card, CardBody, CardFactBand } from '@/components/auth-shell';
import { SiteHeader } from '@/components/site-header';
import { KitStep } from '@/components/vault-parts';
import {
  ArrowDot,
  InlineAlert,
  PRIMARY_BUTTON,
  SMALL_INK,
  SMALL_QUIET,
  StateDot,
  TEXT_LINK,
} from '@/components/ui';

/**
 * The two recovery-kit screens. Presentational only: vault-app.tsx owns the kit, the challenge
 * check and the acknowledgement RPC, and passes in state and callbacks.
 */

/**
 * A failure that is about what was typed (not a dropped connection) marks the fields invalid.
 * Both acknowledgement failures start "Could not record"; those leave the fields alone.
 */
function rejectsInput(error: string | null): boolean {
  return error !== null && !error.startsWith('Could not record');
}

/** "4, 11 and 19": the kit's challenge positions, as a person counts them. */
function wordList(positions: number[]): string {
  const words = positions.map((index) => String(index + 1));
  return words.length > 1 ? `${words.slice(0, -1).join(', ')} and ${words.at(-1)}` : words.join('');
}

type RecoveryKitScreenProps = {
  ids: string;
  downloaded: boolean;
  stored: boolean;
  /** Zero-based word positions the challenge asks for. */
  challenge: number[];
  answers: Record<number, string>;
  error: string | null;
  /** The tab has no session, so the kit cannot be recorded here. */
  signedOut: boolean;
  /** Why: signup skipped the sign-in until the address is confirmed (else the sign-in failed). */
  confirmEmail: boolean;
  onDownload: () => void;
  onStored: (stored: boolean) => void;
  onAnswer: (index: number, value: string) => void;
  onSubmit: (e: FormEvent) => void;
};

/** After signup: download, store, then type three words back. The vault opens after. */
export function RecoveryKitScreen({
  ids,
  downloaded,
  stored,
  challenge,
  answers,
  error,
  signedOut,
  confirmEmail,
  onDownload,
  onStored,
  onAnswer,
  onSubmit,
}: RecoveryKitScreenProps) {
  const ready = downloaded && stored;
  // In reading order, so the three fields follow the kit's numbering top to bottom.
  const asks = [...challenge].sort((a, b) => a - b);
  return (
    <AuthShell
      // No links off the page: until the PDF is saved, the kit exists only in this tab.
      header={<SiteHeader variant="app" bare />}
      footer={false}
      eyebrow="Before the vault opens"
      title="Recovery kit"
      width="wide"
      lead="Secrelyte cannot reset your password or read your data. If you lose the password and this kit, the vault is gone for good."
    >
      <Card>
        <form onSubmit={onSubmit}>
          <ol>
            <KitStep
              n={1}
              state={downloaded ? 'done' : 'current'}
              title="Download the kit"
              body="One PDF: your 24 recovery words, a backup key and this account's email."
            >
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <button
                  type="button"
                  onClick={onDownload}
                  className={downloaded ? SMALL_QUIET : SMALL_INK}
                >
                  Download PDF
                </button>
                <p role="status" className="flex items-center gap-2 text-sm text-sealed-ink">
                  {downloaded ? (
                    <>
                      <StateDot tone="sealed" />
                      Downloaded
                    </>
                  ) : null}
                </p>
              </div>
            </KitStep>
            <KitStep
              n={2}
              state={stored ? 'done' : downloaded ? 'current' : 'todo'}
              title="Store it offline"
              body="Print it, or keep the file somewhere you can reach if this computer is gone."
            >
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-paper px-3.5 py-3 text-sm leading-6 text-ink">
                <input
                  type="checkbox"
                  checked={stored}
                  onChange={(e) => onStored(e.target.checked)}
                  className="check"
                />
                I stored this somewhere safe. Secrelyte cannot recover my data without it.
              </label>
            </KitStep>
            <KitStep
              n={3}
              state={ready ? 'current' : 'todo'}
              title="Type three words back"
              body={`Words ${wordList(asks)} from the kit. This proves the copy you kept can be read.`}
            >
              <div className="grid grid-cols-3 gap-2.5">
                {asks.map((index) => (
                  <div key={index}>
                    <label
                      htmlFor={`${ids}-word-${index}`}
                      className="block text-center font-mono text-[11px] leading-4 text-muted"
                    >
                      Word {index + 1}
                    </label>
                    <input
                      id={`${ids}-word-${index}`}
                      value={answers[index] ?? ''}
                      onChange={(e) => onAnswer(index, e.target.value)}
                      aria-invalid={rejectsInput(error) || undefined}
                      aria-describedby={error ? `${ids}-kit-error` : undefined}
                      autoComplete="off"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      className="field field-mono field-compact field-word mt-1.5"
                    />
                  </div>
                ))}
              </div>
              {error ? (
                <div className="mt-4">
                  <InlineAlert id={`${ids}-kit-error`}>{error}</InlineAlert>
                </div>
              ) : null}
              {/* Only once the PDF is saved: the link leaves the page, and before that, the kit. */}
              {signedOut && downloaded ? (
                <div className="mt-4">
                  <InlineAlert>
                    {confirmEmail
                      ? 'Your account exists, and its email address needs confirming before the kit can be recorded. Keep the PDF you downloaded, confirm the address, then '
                      : 'This tab could not sign in, so the kit cannot be recorded here. Your account exists: keep the PDF you downloaded, then '}
                    <Link href="/login" prefetch className={TEXT_LINK}>
                      go to Unlock
                    </Link>{' '}
                    and type its 24 words to finish.
                  </InlineAlert>
                </div>
              ) : null}
              <div className="mt-5">
                <button
                  type="submit"
                  disabled={!ready}
                  aria-describedby={ready ? undefined : `${ids}-kit-hint`}
                  className={PRIMARY_BUTTON}
                >
                  Open the vault
                  <ArrowDot />
                </button>
                {ready ? null : (
                  <p
                    id={`${ids}-kit-hint`}
                    className="mt-2.5 text-center text-[13px] leading-5 text-muted"
                  >
                    Opens once steps 1 and 2 are done.
                  </p>
                )}
              </div>
            </KitStep>
          </ol>
        </form>
        <CardFactBand aside="Never sent">The words are checked in this tab</CardFactBand>
      </Card>
    </AuthShell>
  );
}

type PhraseCheckScreenProps = {
  ids: string;
  phrase: string;
  error: string | null;
  onPhrase: (phrase: string) => void;
  onSubmit: (e: FormEvent) => void;
};

/** An unlock on a vault whose kit was never acknowledged: the whole phrase, once. */
export function PhraseCheckScreen({
  ids,
  phrase,
  error,
  onPhrase,
  onSubmit,
}: PhraseCheckScreenProps) {
  const typed = phrase.trim() ? phrase.trim().split(/\s+/).length : 0;
  return (
    <AuthShell
      header={<SiteHeader variant="app" current="vault" />}
      eyebrow="One check"
      title="Recovery kit"
      lead="This vault has no record that its kit was stored. Type the 24-word phrase from the kit to confirm you still have it."
    >
      <Card>
        <form onSubmit={onSubmit}>
          <CardBody className="space-y-5">
            <p
              className="notice flex items-start gap-2.5 px-4 py-3 text-sm leading-6 text-ink"
              data-tone="attention"
            >
              <span aria-hidden className="state-dot mt-[9px]" data-tone="attention" />
              Without the phrase this vault stays closed. Secrelyte cannot reset it.
            </p>
            <div>
              <div className="flex items-baseline justify-between gap-3">
                <label htmlFor={`${ids}-phrase`} className="field-label">
                  24-word phrase
                </label>
                <span aria-hidden className="font-mono text-[11px] text-muted tabular-nums">
                  {typed} / 24
                </span>
              </div>
              <textarea
                id={`${ids}-phrase`}
                value={phrase}
                onChange={(e) => onPhrase(e.target.value)}
                rows={5}
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                aria-invalid={rejectsInput(error) || undefined}
                aria-describedby={
                  error ? `${ids}-phrase-hint ${ids}-phrase-error` : `${ids}-phrase-hint`
                }
                className="field field-mono mt-2"
              />
              <p id={`${ids}-phrase-hint`} className="mt-2 text-[13px] leading-5 text-muted">
                In order, separated by spaces.
              </p>
            </div>
            {error ? <InlineAlert id={`${ids}-phrase-error`}>{error}</InlineAlert> : null}
            <button type="submit" className={PRIMARY_BUTTON}>
              Confirm kit
              <ArrowDot />
            </button>
          </CardBody>
        </form>
        <CardFactBand aside="Never sent">The phrase is checked in this tab</CardFactBand>
      </Card>
    </AuthShell>
  );
}
