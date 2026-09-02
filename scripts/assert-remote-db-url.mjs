/**
 * Guardrails for `pnpm db:push`. Never log the URI; callers must not print it.
 */

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0']);

export function remoteMigrateAllowed(dryRun, confirm) {
  return Boolean(dryRun) || confirm === '1';
}

export function assertRemoteDbUrl(raw) {
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new Error(
      'SUPABASE_DB_URL is missing. Dashboard > Project Settings > Database > URI (port 5432). Not the sb_secret_ API key.',
    );
  }
  const trimmed = raw.trim();
  if (trimmed.startsWith('sb_')) {
    throw new Error(
      'SUPABASE_DB_URL looks like an API key. Need the Postgres URI from Database settings.',
    );
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('SUPABASE_DB_URL is not a URI.');
  }

  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
    throw new Error('SUPABASE_DB_URL must be postgres:// or postgresql://');
  }

  const host = (parsed.hostname || '').toLowerCase();
  if (LOCAL_HOSTS.has(host)) {
    throw new Error(
      'SUPABASE_DB_URL points at localhost. This script is for the hosted project.',
    );
  }
  const hosted =
    host.endsWith('.supabase.co') || host.endsWith('.pooler.supabase.com');
  if (!hosted) {
    throw new Error(
      'SUPABASE_DB_URL host is not a supabase.co / pooler.supabase.com database host.',
    );
  }

  const port = parsed.port ? Number(parsed.port) : 5432;
  if (port === 6543) {
    throw new Error(
      'Port 6543 is the transaction pooler. DDL needs the direct URI on port 5432.',
    );
  }
  if (port !== 5432) {
    throw new Error(`Unexpected Postgres port ${port}. Use 5432.`);
  }
  if (!parsed.password) {
    throw new Error('SUPABASE_DB_URL is missing the database password.');
  }

  return { host, port };
}

export function projectRefFromDirectHost(host) {
  const m = String(host || '')
    .toLowerCase()
    .match(/^db\.([a-z0-9]+)\.supabase\.co$/);
  return m ? m[1] : null;
}

export function normalizePoolerRegion(region) {
  const r = (region || 'eu-west-1').trim().toLowerCase();
  if (!/^[a-z0-9-]+$/.test(r)) {
    throw new Error('SUPABASE_POOLER_REGION must be a AWS region slug like eu-west-1.');
  }
  return r;
}

/**
 * Direct db.PROJECT.supabase.co is IPv6-only. Session pooler (port 5432) is IPv4.
 * Transaction pooler (6543) is not used here; DDL needs a session.
 */
export function toSessionPoolerUrl(raw, region) {
  const trimmed = String(raw || '').trim();
  const parsed = new URL(trimmed);
  const host = (parsed.hostname || '').toLowerCase();
  if (host.endsWith('.pooler.supabase.com')) {
    return { url: trimmed, rewritten: false, host };
  }
  const ref = projectRefFromDirectHost(host);
  if (!ref) {
    return { url: trimmed, rewritten: false, host };
  }
  const r = normalizePoolerRegion(region);
  const user = parsed.username.includes('.')
    ? parsed.username
    : `${parsed.username}.${ref}`;
  const out = new URL(trimmed);
  out.username = user;
  out.hostname = `aws-0-${r}.pooler.supabase.com`;
  out.port = '5432';
  return { url: out.toString(), rewritten: true, host: out.hostname };
}
