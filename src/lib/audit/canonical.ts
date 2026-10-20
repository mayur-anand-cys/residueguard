/**
 * Canonical serialization for ResidueGuard audit hashes.
 *
 * Contract `rg-audit-canon-1`:
 * - UTF-8 JSON, no insignificant whitespace.
 * - Object keys are sorted by UTF-16 code unit at every depth.
 * - Array order is preserved.
 * - Strings use JSON escaping. Finite numbers use JSON number form (`-0` becomes `0`).
 * - `null` and booleans are allowed.
 * - `undefined`, non-finite numbers, bigint, functions, symbols, and class instances are rejected.
 * - The `eventHash` field is never part of the hashed document.
 *
 * The same logical content always produces the same string, regardless of
 * the order properties were inserted.
 */

export const CANON_ID = "rg-audit-canon-1";

export class CanonicalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CanonicalError";
  }
}

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export function canonicalize(value: unknown): string {
  return serialize(value);
}

function serialize(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new CanonicalError("Non-finite numbers cannot be hashed consistently.");
    }
    return JSON.stringify(value);
  }
  if (typeof value === "bigint" || typeof value === "function" || typeof value === "symbol") {
    throw new CanonicalError("Unsupported value in audit payload.");
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => serialize(item)).join(",")}]`;
  }
  if (typeof value === "object") {
    if (Object.getPrototypeOf(value) !== Object.prototype) {
      throw new CanonicalError("Only plain objects can be hashed.");
    }
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    const parts: string[] = [];
    for (const key of keys) {
      const child = record[key];
      if (child === undefined) {
        throw new CanonicalError("Undefined values cannot be hashed consistently.");
      }
      parts.push(`${JSON.stringify(key)}:${serialize(child)}`);
    }
    return `{${parts.join(",")}}`;
  }
  throw new CanonicalError("Unsupported value in audit payload.");
}
