/**
 * Landing page copy, kept as data so the honesty and voice rules can be checked by tests
 * instead of by eye. Every capability carries a status. Live means it ships today; Next means
 * it is designed and not shipped, and the page must say so wherever it appears.
 *
 * The only factual claims allowed here are the ones in the security docs: the threat model
 * (section 7), the security promises, ADR-0004, and the PRD problem statement for the pain.
 */

export type Status = 'live' | 'next';

/** The capability ledger. Tests pin these lists; a capability may not drift between them. */
export const LIVE_CAPABILITIES = [
  'signup',
  'recovery-kit',
  'client-side-encryption',
  'masked-reveal',
  'idle-lock',
  'password-change',
] as const;

export const NEXT_CAPABILITIES = [
  'share-links',
  'recipient-verification',
  'open-notifications',
  'revocation',
  'claude-interface',
] as const;

export type Capability = (typeof LIVE_CAPABILITIES)[number] | (typeof NEXT_CAPABILITIES)[number];

/** A sample value for the demo vault. Not a credential; it fails every real key format. */
export const DEMO_SECRET = 'sk_live_demo_4eQx9mT2wLc7Rk8v';
export const DEMO_KEY_NAME = 'STRIPE_SECRET_KEY';

/** Live capabilities, stated once under the hero. Parameters live in the guarantee section. */
export const LIVE_STRIP = [
  'Re-masks after 30s',
  'Locks after 15 min idle',
  '24-word recovery kit',
  'No third-party scripts on vault pages',
] as const;

export const PAIN = {
  eyebrow: 'The problem',
  title: 'Keys leak through the shortcuts. Not through broken math.',
  lead: 'Getting a key out is slow. Handing it over is worse.',
  cards: [
    {
      n: '01',
      tags: ['Retrieval'],
      title: 'Five interactions for one string.',
      body: 'Open the app, find the vault, find the item, find the field, copy. For a string you needed four seconds ago.',
      steps: ['Open the app', 'Find the vault', 'Find the item', 'Find the field', 'Copy'],
    },
    {
      n: '02',
      tags: ['Handoff'],
      title: 'So the key goes into Slack.',
      body: 'Or email, or WhatsApp. Plaintext, permanent, in a channel with unclear retention and a search index.',
      channels: ['Slack', 'Email', 'WhatsApp'],
    },
    {
      n: '03',
      tags: ['Secure links'],
      title: 'The safe path has six steps.',
      body: 'Pick an expiry, set a password, choose a view limit, copy, paste, send the password separately. Under time pressure, people skip it.',
      settings: ['Expiry', 'Password', 'View limit', 'Copy', 'Paste', 'Send password separately'],
    },
  ],
  statementEyebrow: 'The pattern',
  timelineLabel: 'The same key, later',
  timeline: [
    { when: 'Week 1', what: 'Pasted into a DM', tone: 'plain' },
    { when: 'Month 3', what: 'The engagement ends', tone: 'plain' },
    { when: 'Year 2', what: 'Still live. Still in search.', tone: 'exposed' },
  ],
  statement:
    'The secure path is slower than the insecure one. So the credential outlives the engagement by years, and nobody remembers it is there.',
} as const;

export const GUARANTEE = {
  eyebrow: 'The guarantee',
  title: 'Your password stays in the browser. The server gets ciphertext.',
  lead: 'So we started from the other end: a server that cannot read what it stores. HKDF gives the server a login key in place of your password. The encryption key never leaves.',
  lit: 'This browser',
  litNote: 'in the light',
  dark: 'Our server',
  darkNote: 'in the dark',
  holds: 'What it holds',
  canDo: 'What it can do with it',
  verdict: 'Nothing. It has no key.',
  alsoStored:
    'It also receives a login key in place of your password, and it stores product and key names, readable.',
  steps: [
    { id: 'password', zone: 'browser', title: 'Password', detail: 'Typed here. Never sent.' },
    {
      id: 'argon2id',
      zone: 'browser',
      title: 'Argon2id',
      detail: '64 MiB, 3 iterations, parallelism 1, in a Web Worker',
    },
    { id: 'hkdf', zone: 'browser', title: 'HKDF', detail: 'Two keys out' },
    {
      id: 'encryption-key',
      zone: 'browser',
      title: 'Encryption key',
      detail: 'Stays in memory on this device',
    },
    {
      id: 'keypair',
      zone: 'browser',
      title: 'Vault key, X25519 keypair',
      detail: 'Generated here. They leave only wrapped.',
    },
    {
      id: 'seal',
      zone: 'browser',
      title: 'XChaCha20-Poly1305',
      detail: 'Each secret bound to its product, secret id and version',
    },
    {
      id: 'ciphertext',
      zone: 'server',
      title: 'Ciphertext and wrapped keys',
      detail: 'Stored. Cannot be opened here.',
    },
  ],
} as const;

export type HowStep = {
  id: 'pick' | 'reveal' | 'send' | 'watch';
  n: string;
  name: string;
  status: Status;
  capability: Capability;
  summary: string;
  title: string;
  body: string;
};

export const HOW = {
  eyebrow: 'How it works',
  title: 'Pick. Reveal. Send. Watch.',
  lead: 'Two of these ship today. Two are next, and they are labelled that way everywhere on this page.',
  steps: [
    {
      id: 'pick',
      n: '01',
      name: 'Pick',
      status: 'live',
      capability: 'client-side-encryption',
      summary: 'Pick the product and the key.',
      title: 'Name the product, pick the key.',
      body: 'Your vault lists products and key names. Values stay as ciphertext until you ask to see one. Asking Claude in plain language is Next.',
    },
    {
      id: 'reveal',
      n: '02',
      name: 'Reveal',
      status: 'live',
      capability: 'masked-reveal',
      summary: 'One value, 30 seconds.',
      title: 'One value at a time, for 30 seconds.',
      body: 'Reveal decrypts on your device and shows the value with a visible countdown. At 30 seconds it masks itself again.',
    },
    {
      id: 'send',
      n: '03',
      name: 'Send',
      status: 'next',
      capability: 'share-links',
      summary: 'A link that expires.',
      title: 'A link that expires, with a view limit.',
      body: 'Share links will expire and carry a view limit. The recipient proves the inbox with a code before the link opens.',
    },
    {
      id: 'watch',
      n: '04',
      name: 'Watch',
      status: 'next',
      capability: 'open-notifications',
      summary: 'Know when it opens.',
      title: 'Know when it opens. Revoke at any time.',
      body: 'You will be notified when a link opens, and you can revoke it at any time. Revoking cannot un-see a viewed key, so rotate it.',
    },
  ] satisfies HowStep[],
} as const;

export const CLAUDE = {
  eyebrow: 'Claude as the interface',
  status: 'next' as Status,
  capability: 'claude-interface' as Capability,
  title: 'Ask in plain language. Claude will see names, never values.',
  lead: 'This part is Next, not live. When it ships, Claude routes your request and proposes an action. A card shows exactly what will happen, and nothing runs until you confirm it.',
  request: 'send the stripe keys to dana@agency.com for 24 hours',
  recipient: 'dana@agency.com',
  keys: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'],
  principles: [
    {
      title: 'Routes, never reads.',
      body: 'Claude will see product and key names, like Stripe and STRIPE_SECRET_KEY. It will never receive a value.',
    },
    {
      title: 'Proposes. You confirm.',
      body: 'Every action will arrive as a card with the exact keys and the full recipient address. Only your click runs it.',
    },
    {
      title: 'A wrong guess is a card you decline.',
      body: 'The model can misread what you meant. The card will show the exact keys and recipient before anything runs, so you can catch a misread and cancel it.',
    },
  ],
} as const;

export const EVIDENCE = {
  eyebrow: 'Evidence',
  title: 'The guarantee is tested, not promised.',
  lead: 'Four checks stand behind the claim at the top of this page. Each one runs in CI or ships with every page.',
  cards: [
    {
      tag: 'End to end',
      title: 'A real browser looks for the plaintext.',
      body: 'CI drives a full signup, store and reveal session in a real browser, then checks the outgoing requests for the plaintext secret.',
    },
    {
      tag: 'Postgres',
      title: 'Row-level security, forced on every table.',
      body: 'Tested in CI as a real second user, not with the service key.',
    },
    {
      tag: 'Crypto module',
      title: '100% branch coverage.',
      body: 'Every branch of the crypto module is covered, and its outputs are pinned by frozen test vectors.',
    },
    {
      tag: 'Content-Security-Policy',
      title: 'No third-party scripts on vault pages.',
      body: 'A strict Content-Security-Policy decides what may run, and no third-party script runs on the pages where your secrets are decrypted.',
    },
  ],
} as const;

export type Limit = {
  n: string;
  title: string;
  body: string;
  status?: Status;
};

export const LIMITS = {
  eyebrow: 'Limits',
  title: 'Limits, stated.',
  lead: 'Zero knowledge has costs. These are ours, written down before you find them.',
  items: [
    {
      n: '01',
      title: 'Lose the password and the recovery kit, and the data is gone.',
      body: 'Nobody can restore it, including us. That is why the vault opens only after you type back three randomly chosen words from your 24-word kit.',
    },
    {
      n: '02',
      title: 'A compromised device reads what you read.',
      body: 'Malware, a keylogger or an unlocked laptop beats any vault. Ours locks after 15 minutes idle and wipes its keys from memory. That shrinks the window. It does not close it.',
    },
    {
      n: '03',
      title: 'We can see names, not values.',
      body: 'The server knows you have a product called Stripe with three keys. It cannot see what is in them.',
    },
    {
      n: '04',
      title: 'The code we serve is part of the trust.',
      body: 'Decryption runs in your browser, in JavaScript we ship. A compromised build or dependency could read what you read. A strict Content-Security-Policy and no third-party scripts on vault pages narrow that path.',
    },
    {
      n: '05',
      title: 'A weak password is still weak.',
      body: 'Argon2id makes every guess expensive. It does not fix password123.',
    },
    {
      n: '06',
      title: 'Revoking a share will not un-see a key.',
      body: 'If someone already viewed a key, revoking the link cannot take it back. Rotate the credential with the provider.',
      status: 'next',
    },
  ] satisfies Limit[],
} as const;

export const RECOVERY_CHALLENGE = {
  words: 24,
  asks: [
    { index: 4, value: 'harbor' },
    { index: 11, value: 'orbit' },
    { index: 19, value: '' },
  ],
} as const;

export const FAQ = {
  eyebrow: 'FAQ',
  title: 'Questions, answered plainly.',
  items: [
    {
      q: 'Can Secrelyte read my secrets?',
      a: 'No. Your password never leaves your browser. Argon2id and HKDF derive your keys on your device, and each secret is encrypted with XChaCha20-Poly1305 before it is sent. The server stores ciphertext it cannot open.',
    },
    {
      q: 'What is the recovery kit?',
      a: 'Twenty-four words (BIP-39) in a PDF, issued at signup. If you lose both the password and the kit, the data is gone. Nobody can restore it, including us.',
    },
    {
      q: 'Why do I have to type three words back?',
      a: 'So the kit exists before your secrets do. The vault opens only after you type back three randomly chosen words from it.',
    },
    {
      q: 'What happens when I change my password?',
      a: 'Your keys are rewrapped under the new password. Your recovery kit stays valid.',
    },
    {
      q: 'Can I share a secret with someone today?',
      a: 'Not yet. Share links are Next: they will expire, carry a view limit, ask the recipient to prove the inbox with a code, notify you when they open, and be revocable at any time.',
    },
    {
      q: 'Does Claude see my keys?',
      a: 'The Claude interface is Next. When it ships, Claude sees product and key names, never values. It proposes an action and you confirm it.',
    },
    {
      q: 'What does the server store?',
      a: 'Ciphertext for every secret, your vault key and X25519 keypair in wrapped form, and the names of your products and keys. At login it receives a key derived from your password, never the password itself.',
    },
    {
      q: 'How can I check any of this?',
      a: 'Store a secret with your browser’s network tab open and read the request body. In CI, a real browser runs signup, store and reveal, then checks the outgoing requests for the plaintext secret.',
    },
    {
      q: 'Why does the vault lock by itself?',
      a: 'After 15 minutes idle the vault locks and wipes its keys from memory, so an unattended tab stops being an open vault.',
    },
  ],
} as const;

export const CLOSING = {
  title: 'Your secrets, in the light. Our server, in the dark.',
  lead: 'Put your keys somewhere we cannot read them. Create a vault in your browser, download your recovery kit, type back three words, and it opens.',
} as const;
