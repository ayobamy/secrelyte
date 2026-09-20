import 'server-only';

export function signupConfirmsEmail(): boolean {
  return process.env.SECRELYTE_REQUIRE_EMAIL_CONFIRM !== '1';
}
