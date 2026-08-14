import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function sanitizeUrl(url?: string | null): string {
  if (!url || typeof url !== "string") return "#";
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return "#";
}

// M4T5 — PII scrubber for data that lands in the shared global_audits cache.
// Emails, phone numbers, and street addresses are replaced with fixed markers
// before any cache write so one brand's audit cannot leak another person's
// contact details to every subsequent viewer of the cache.

const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/g;
// (?<!\d) instead of \b at the start so "(555) 123-4567" (no word boundary
// before the paren) still matches without starting mid-number.
const PHONE_PATTERN = /(?<!\d)(?:\+?\d{1,3}[-.\s]?)?(?:\(\d{3}\)[-.\s]?|\d{3}[-.\s]?)\d{3}[-.\s]?\d{4}\b/g;
const ADDRESS_PATTERN = /\b\d{1,6}\s+(?:[A-Za-z0-9.#-]+\s+){1,4}(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|way|place|pl|court|ct|circle|cir|terrace|ter|highway|hwy|parkway|pky|square|sq)\.?\b/gi;

export function scrubPii(text: string): string {
  if (!text || typeof text !== "string") return text;
  return text
    .replace(EMAIL_PATTERN, "[REDACTED EMAIL]")
    .replace(PHONE_PATTERN, "[REDACTED PHONE]")
    .replace(ADDRESS_PATTERN, "[REDACTED ADDRESS]");
}

/** Recursively scrub every string in a dossier-shaped object (arrays, nested
 *  objects, plain values pass through untouched). */
export function scrubPiiDeep(value: unknown): unknown {
  if (typeof value === "string") return scrubPii(value);
  if (Array.isArray(value)) return value.map((item) => scrubPiiDeep(item));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = scrubPiiDeep(item);
    }
    return out;
  }
  return value;
}

