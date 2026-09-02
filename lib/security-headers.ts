export type CspTier = 'marketing' | 'strict';

export type HeaderMap = Record<string, string>;

const HSTS = 'max-age=63072000; includeSubDomains; preload';
const PERMISSIONS = 'camera=(), microphone=(), geolocation=(), payment=()';

export function isStrictPath(pathname: string): boolean {
  return pathname === '/vault' || pathname.startsWith('/vault/') || pathname.startsWith('/s/');
}

export function buildCsp(opts: {
  nonce: string;
  isDev: boolean;
  supabaseOrigin: string | null;
  tier: CspTier;
}): string {
  const { nonce, isDev, supabaseOrigin, tier } = opts;
  const connect = ["'self'", supabaseOrigin].filter(Boolean).join(' ');
  const defaultSrc = tier === 'strict' ? "'none'" : "'self'";
  const scriptEval = isDev ? " 'unsafe-eval'" : '';
  // libsodium WASM needs this on vault/share once Phase 1 lands.
  const wasm = tier === 'strict' ? " 'wasm-unsafe-eval'" : '';
  const style = isDev ? `'self' 'nonce-${nonce}' 'unsafe-inline'` : `'self' 'nonce-${nonce}'`;

  return [
    `default-src ${defaultSrc};`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${scriptEval}${wasm};`,
    `style-src ${style};`,
    `img-src 'self' data:;`,
    `font-src 'self';`,
    `connect-src ${connect};`,
    `frame-ancestors 'none';`,
    `form-action 'self';`,
    `base-uri 'none';`,
    `object-src 'none';`,
    `upgrade-insecure-requests;`,
  ]
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function securityHeaders(opts: {
  pathname: string;
  nonce: string;
  isDev: boolean;
  isProd: boolean;
  supabaseOrigin: string | null;
}): HeaderMap {
  const strict = isStrictPath(opts.pathname);
  const headers: HeaderMap = {
    'Content-Security-Policy': buildCsp({
      nonce: opts.nonce,
      isDev: opts.isDev,
      supabaseOrigin: opts.supabaseOrigin,
      tier: strict ? 'strict' : 'marketing',
    }),
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': strict ? 'no-referrer' : 'strict-origin-when-cross-origin',
    'Permissions-Policy': PERMISSIONS,
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'X-DNS-Prefetch-Control': 'off',
  };

  if (opts.isProd) {
    headers['Strict-Transport-Security'] = HSTS;
  }

  if (strict) {
    headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, private';
    if (opts.isProd) {
      headers['Cross-Origin-Embedder-Policy'] = 'require-corp';
    }
  }

  return headers;
}

const GRADE_A_REQUIRED = [
  'Content-Security-Policy',
  'X-Content-Type-Options',
  'X-Frame-Options',
  'Referrer-Policy',
  'Permissions-Policy',
] as const;

export type HeaderGrade = {
  grade: 'A' | 'F';
  missing: string[];
};

export function gradeHeaders(headers: HeaderMap, opts: { requireHsts: boolean }): HeaderGrade {
  const missing: string[] = [];
  for (const name of GRADE_A_REQUIRED) {
    if (!headers[name]) missing.push(name);
  }
  if (opts.requireHsts && !headers['Strict-Transport-Security']) {
    missing.push('Strict-Transport-Security');
  }
  const csp = headers['Content-Security-Policy'] ?? '';
  if (!csp.includes('default-src')) {
    missing.push('CSP default-src');
  }
  if (csp.includes('unsafe-inline') && !csp.includes('nonce-')) {
    missing.push('CSP nonce (unsafe-inline without nonce)');
  }
  if (opts.requireHsts && csp && !csp.includes('upgrade-insecure-requests')) {
    missing.push('CSP upgrade-insecure-requests');
  }
  return { grade: missing.length === 0 ? 'A' : 'F', missing };
}
