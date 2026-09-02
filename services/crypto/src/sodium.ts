import sodium from 'libsodium-wrappers-sumo';

let readyPromise: Promise<typeof sodium> | null = null;

export function sodiumReady(): Promise<typeof sodium> {
  if (readyPromise === null) {
    readyPromise = sodium.ready.then(() => sodium);
  }
  return readyPromise;
}

export async function getSodium(): Promise<typeof sodium> {
  return sodiumReady();
}
