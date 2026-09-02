import { describe, expect, it } from 'vitest';
import { classifyTablePresence } from './db-status.mjs';

describe('classifyTablePresence', () => {
  it('treats HTTP 200 as present', () => {
    expect(classifyTablePresence(200, '[]')).toBe('present');
  });

  it('treats PostgREST missing-table as missing', () => {
    expect(
      classifyTablePresence(
        404,
        '{"code":"PGRST205","message":"Could not find the table \'public.user_keys\' in the schema cache"}',
      ),
    ).toBe('missing');
  });

  it('treats grant-denied as present (share_verifications has no GRANT)', () => {
    expect(classifyTablePresence(401, '{"message":"permission denied"}')).toBe('present');
    expect(classifyTablePresence(403, '42501')).toBe('present');
  });
});
