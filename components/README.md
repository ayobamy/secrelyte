# components

Shared UI. No service logic. No crypto. No data fetching.

Vault and share routes must not load third-party widgets from here.

## App screens

Every screen outside the landing page is built from the same pieces, so signup, unlock, the
recovery kit, the vault and the share preview read as one product:

- `ui.tsx`: the shared vocabulary. Button and link class strings, the amber arrow, the eyebrow,
  the mark drawn large (`Beacon`), state dots and `InlineAlert`.
- `auth-shell.tsx`: the sign-in column (`AuthShell`), the hero card's frame (`Card`), its link
  and fact bands, and the one-line `AppFooter`.
- `auth-forms.tsx`, `password-field.tsx`: signup and unlock. Native validation gates the forms;
  only the browser's bubble is replaced by inline, announced messages.
- `recovery-kit.tsx`, `locked-vault.tsx`, `vault-parts.tsx`: presentational pieces of the vault.
  `vault-app.tsx` owns every handler and passes in state and callbacks.

Styles: `app/surfaces.css` holds the surfaces the landing page and the app share (panel,
bezel, chip card, tags, value box, key rows). `app/app.css` holds the app screens' own classes
and is loaded only by the app routes. No component uses a `style` attribute: the production CSP
blocks them.
