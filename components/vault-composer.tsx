export function VaultComposer() {
  return (
    <div className="rounded-[1.75rem] border border-line bg-line/40 p-1.5 shadow-[0_20px_50px_rgba(14,17,22,0.04)]">
      <div className="rounded-[calc(1.75rem-0.375rem)] border border-line bg-paper px-4 py-4">
        <label htmlFor="vault-prompt" className="text-sm font-medium text-ink">
          Paste a messy block
        </label>
        <p id="vault-prompt-hint" className="mt-1 text-sm text-muted">
          Keys stay on this device. The model will see placeholders, not values.
        </p>
        <textarea
          id="vault-prompt"
          aria-describedby="vault-prompt-hint vault-prompt-submit"
          rows={4}
          placeholder="sk_live_…  AKIA…  postgres://…"
          className="mt-3 w-full resize-none rounded-2xl border border-line bg-base px-4 py-3 font-mono text-sm text-ink placeholder:text-muted/70"
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p id="vault-prompt-submit" className="text-xs text-muted">
            Submit lands when the vault unlocks.
            <span className="hidden sm:inline"> ⌘K is the same input from anywhere.</span>
          </p>
          <button
            type="button"
            disabled
            className="ml-auto rounded-full px-4 py-2 text-sm text-muted ring-1 ring-line"
          >
            Keep local
          </button>
        </div>
      </div>
    </div>
  );
}
