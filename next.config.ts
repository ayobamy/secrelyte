import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [
      {
        // Strict routes send Cross-Origin-Embedder-Policy: require-corp, and Chrome will not
        // start a dedicated worker whose script does not itself assert COEP. The Argon2id
        // worker (services/crypto/src/kdf.ts) is bundled into /_next/static, which proxy.ts
        // deliberately excludes from its matcher, so the headers have to come from here or
        // the worker is blocked with ERR_BLOCKED_BY_RESPONSE and every Argon2id path fails:
        // signup, unlock, password change.
        //
        // Dropping COEP would also fix the worker, but cross-origin isolation is worth
        // keeping for a page that holds vault keys in memory.
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
          { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
