export {
  IDLE_LOCK_MS,
  REVEAL_MS,
  CLIPBOARD_CLEAR_MS,
  MIN_PASSWORD_LENGTH,
  KDF_LOOKUP_FLOOR_MS,
} from './timing';
export { scorePassword } from './password';
export { pickChallengeIndices, verifyChallenge } from './challenge';
export {
  assembleSignupMaterial,
  wrapForPasswordChange,
  type SignupMaterial,
} from './signup-material';
export { authPasswordFor, unlockFromOwnKeys, type OwnKeysRow } from './unlock';
export {
  isUnlocked,
  getVaultKey,
  getSecretKey,
  unlockKeys,
  lockKeys,
  subscribeUnlocked,
  assertKeysAbsentFromWebStorage,
} from './keystore';
export { startIdleLock } from './idle';
export { wrapNewProductDek, openProductDek, discardDek } from './products';
export { sealSecretValue, openSecretValue } from './secrets';
export { envelopeToBytes, bytesToEnvelope, bytesFromWire, bytesToPgHex } from './envelope';
export { buildRecoveryKitPdf, downloadBytes } from './recovery-pdf';
export { phraseMatchesCurrentVault } from './recovery-gate';
export {
  applyPasswordChange,
  retryAuthPasswordUpdate,
  peekPendingAuthPassword,
  clearPendingAuthPassword,
  AuthUpdatePendingError,
} from './password-change';
