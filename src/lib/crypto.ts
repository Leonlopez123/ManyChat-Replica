import crypto from 'node:crypto';

// AES-256-GCM für den Instagram-Token in der Datenbank. Schlüssel: 32 Byte als Hex in ENCRYPTION_KEY.
function key(hex: string) {
  const k = Buffer.from(hex, 'hex');
  if (k.length !== 32) throw new Error('ENCRYPTION_KEY muss 64 Hex-Zeichen haben (openssl rand -hex 32)');
  return k;
}

export function encrypt(plain: string, keyHex: string): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key(keyHex), iv);
  const data = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return ['v1', iv.toString('base64'), c.getAuthTag().toString('base64'), data.toString('base64')].join('.');
}

export function decrypt(blob: string, keyHex: string): string {
  const [v, iv, tag, data] = blob.split('.');
  if (v !== 'v1') throw new Error('Unbekanntes Token-Format');
  const d = crypto.createDecipheriv('aes-256-gcm', key(keyHex), Buffer.from(iv, 'base64'));
  d.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([d.update(Buffer.from(data, 'base64')), d.final()]).toString('utf8');
}

/** Konstantzeit-Vergleich für Passwörter und Secrets. */
export function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

/** Prüft X-Hub-Signature-256 von Meta (HMAC-SHA256 über den Roh-Body mit dem App Secret). */
export function validMetaSignature(raw: string | Buffer, header: string | null, appSecret: string): boolean {
  if (!header?.startsWith('sha256=')) return false;
  const expected = crypto.createHmac('sha256', appSecret).update(raw).digest('hex');
  const got = header.slice(7);
  return got.length === expected.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}
