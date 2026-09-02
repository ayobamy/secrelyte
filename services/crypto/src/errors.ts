export class AuthenticationError extends Error {
  readonly name = 'AuthenticationError';

  constructor(message = 'authentication failed') {
    super(message);
  }
}
