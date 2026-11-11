/** Alias remains on this browser until Reset Alias is selected. */
export const TRAFFIC_ALIAS_STORAGE_KEY = 'pico.trafficStorm.alias.v1';

/** Only letters and single spaces are accepted for the alias. */
export function sanitizeHackerName(input: string): string {
  return input.normalize('NFC').replace(/[^\p{L}\p{M} ]/gu, '').replace(/ {2,}/g, ' ').replace(/^ /, '').slice(0, 24);
}

export function validateHackerName(input: string): string | null {
  const name = input.trim();
  if (name.length < 2) return 'Use at least 2 letters for your name.';
  if (name.length > 24) return 'Keep your name within 24 characters.';
  if (!/^[\p{L}\p{M}]+(?: [\p{L}\p{M}]+)*$/u.test(name)) return 'Use letters and spaces only. No numbers or symbols.';
  return null;
}

export function readSavedTrafficAlias(storage?: Pick<Storage, 'getItem'>): string | null {
  try {
    const source = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    const name = source?.getItem(TRAFFIC_ALIAS_STORAGE_KEY)?.trim().normalize('NFC');
    return name && validateHackerName(name) === null ? name : null;
  } catch { return null; }
}

export function saveTrafficAlias(name: string, storage?: Pick<Storage, 'setItem'>): boolean {
  const clean = name.trim().normalize('NFC');
  if (validateHackerName(clean)) return false;
  try {
    const target = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    if (!target) return false;
    target.setItem(TRAFFIC_ALIAS_STORAGE_KEY, clean);
    return true;
  } catch { return false; }
}

export function clearTrafficAlias(storage?: Pick<Storage, 'removeItem'>): void {
  try {
    const target = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    target?.removeItem(TRAFFIC_ALIAS_STORAGE_KEY);
  } catch { /* Storage may be blocked; the current session still resets. */ }
}
