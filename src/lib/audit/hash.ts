/**
 * SHA-256 helper. This is a hash, not encryption: it does not hide the
 * record, identify a person, or make storage immutable.
 */

export class HashUnavailableError extends Error {
  constructor(message = "SHA-256 unavailable. No digest was produced.") {
    super(message);
    this.name = "HashUnavailableError";
  }
}

type DigestSource = {
  digest(algorithm: "SHA-256", data: BufferSource): Promise<ArrayBuffer>;
};

export async function sha256Hex(message: string, subtle?: DigestSource | null): Promise<string> {
  const source = subtle === undefined ? globalThis.crypto?.subtle : subtle;
  if (!source || typeof source.digest !== "function") {
    throw new HashUnavailableError();
  }
  let digest: ArrayBuffer;
  try {
    digest = await source.digest("SHA-256", new TextEncoder().encode(message));
  } catch (error) {
    const reason = error instanceof Error ? error.message : "digest failed";
    throw new HashUnavailableError(`SHA-256 failed: ${reason}. No digest was produced.`);
  }
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
