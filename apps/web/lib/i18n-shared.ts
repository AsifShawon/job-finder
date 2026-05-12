export type Locale = "bn" | "en";

/**
 * Pick the best-available bilingual variant of a content field.
 *
 * Given a record with `<base>`, `<base>_bn`, `<base>_en` variants, return the
 * best match for the user's locale. Falls back to the other-language variant,
 * then the canonical value.
 */
export function pickLang<T extends object, K extends string>(
  record: T | null | undefined,
  base: K,
  locale: Locale,
): string | null {
  if (!record) return null;
  const bnKey = `${base}_bn` as keyof T;
  const enKey = `${base}_en` as keyof T;
  const baseKey = base as unknown as keyof T;
  const primary = locale === "bn" ? record[bnKey] : record[enKey];
  const secondary = locale === "bn" ? record[enKey] : record[bnKey];
  const canonical = record[baseKey];
  for (const value of [primary, secondary, canonical]) {
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

/**
 * Pick the best-available bilingual variant of a list-valued field.
 */
export function pickLangList<T extends object, K extends string>(
  record: T | null | undefined,
  base: K,
  locale: Locale,
): string[] {
  if (!record) return [];
  const bnKey = `${base}_bn` as keyof T;
  const enKey = `${base}_en` as keyof T;
  const baseKey = base as unknown as keyof T;
  const primary = locale === "bn" ? record[bnKey] : record[enKey];
  const secondary = locale === "bn" ? record[enKey] : record[bnKey];
  const canonical = record[baseKey];
  for (const value of [primary, secondary, canonical]) {
    if (Array.isArray(value) && value.length > 0) return value as string[];
  }
  return [];
}
