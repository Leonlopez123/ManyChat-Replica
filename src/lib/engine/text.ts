/** Kleinbuchstaben, ohne Akzente, Satzzeichen und Emojis → Leerzeichen, Mehrfach-Leerzeichen zusammengefasst. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** Liste aus Eingabe säubern: normalisiert, ohne Leere und Duplikate. */
export function normalizeKeywords(list: string[]): string[] {
  return [...new Set(list.map(normalize).filter(Boolean))];
}

/** Enthält-Match wie beim Original: "Kita" trifft "kita!", "KITA bitte", "Kitas". */
export function matchesKeywords(text: string, keywords: string[], exclude: string[] = []): boolean {
  const t = ` ${normalize(text)} `;
  const has = (kw: string) => kw && t.includes(normalize(kw));
  if (exclude.some(has)) return false;
  return keywords.some(has);
}

export interface TemplateVars {
  vorname?: string | null;
  username?: string | null;
}

/** Ersetzt {{vorname}} und {{username}}. Ohne Vorname wird der Benutzername genutzt, ohne beides nichts. */
export function fillTemplate(text: string, vars: TemplateVars): string {
  const vorname = vars.vorname?.trim() || vars.username?.trim() || '';
  return text
    .replace(/\{\{\s*vorname\s*\}\}/gi, vorname)
    .replace(/\{\{\s*username\s*\}\}/gi, vars.username ?? '')
    .replace(/[ \t]+([,.!?])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export function firstName(name?: string | null): string | null {
  const first = name?.trim().split(/\s+/)[0];
  return first || null;
}

export function pickRandom<T>(list: T[]): T | undefined {
  return list.length ? list[Math.floor(Math.random() * list.length)] : undefined;
}
