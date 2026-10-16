import { describe, expect, it } from 'vitest';
import { fillTemplate, matchesKeywords, normalize, normalizeKeywords } from '@/lib/engine/text';

describe('Keywords', () => {
  it.each([
    ['Kita', true],
    ['KITA!!', true],
    ['kita bitte 🙏', true],
    ['Ich will Kitas', true],
    ['Kíta', true],
    ['k i t a', false],
    ['Danke', false],
  ])('%s → %s', (text, expected) => {
    expect(matchesKeywords(text, ['kita'])).toBe(expected);
  });

  it('Ausschluss gewinnt', () => {
    expect(matchesKeywords('kitaplatz gesucht', ['kita'], ['kitaplatz'])).toBe(false);
  });

  it('mehrere Wörter als ein Keyword', () => {
    expect(matchesKeywords('Bitte den Leitfaden schicken', ['leitfaden schicken'])).toBe(true);
  });

  it('normalisiert und entfernt Duplikate', () => {
    expect(normalizeKeywords([' Kita ', 'KITA', '', 'Straße'])).toEqual(['kita', 'strasse']);
    expect(normalize('Grüße!')).toBe('grusse');
  });
});

describe('Platzhalter', () => {
  it('Vorname, sonst Benutzername, sonst leer ohne Lücke', () => {
    expect(fillTemplate('Hey {{vorname}}, hier!', { vorname: 'Anna', username: 'a_1' })).toBe('Hey Anna, hier!');
    expect(fillTemplate('Hey {{vorname}}, hier!', { username: 'a_1' })).toBe('Hey a_1, hier!');
    expect(fillTemplate('Hey {{vorname}}, hier!', {})).toBe('Hey, hier!');
  });
});
