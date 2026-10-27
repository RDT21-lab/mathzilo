/* Web Push sin dependencias (RFC 8291 cifrado aes128gcm + RFC 8292 VAPID), con el crypto de Node.
   El aviso va cifrado para el navegador del padre: Google, Apple o Mozilla solo lo transportan. */
import crypto from 'node:crypto';

const b64u = buf => Buffer.from(buf).toString('base64url');

/** Par de claves VAPID del servidor: la pública (65 bytes, base64url) la usa el navegador al suscribirse */
export function vapidKeys() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const jwk = publicKey.export({ format: 'jwk' });
  const raw = Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, 'base64url'), Buffer.from(jwk.y, 'base64url')]);
  return { publicKey: b64u(raw), privateKey: privateKey.export({ format: 'pem', type: 'pkcs8' }) };
}

/** Cabecera Authorization: un JWT ES256 firmado para el servicio de avisos de esa suscripción */
export function vapidHeader(endpoint, keys, subject, now = Date.now()) {
  const enc = o => b64u(JSON.stringify(o));
  const data = enc({ typ: 'JWT', alg: 'ES256' }) + '.' + enc({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: subject });
  const sig = crypto.sign('sha256', Buffer.from(data), { key: keys.privateKey, dsaEncoding: 'ieee-p1363' });
  return 'vapid t=' + data + '.' + b64u(sig) + ', k=' + keys.publicKey;
}

/** Cifra el contenido para la suscripción (clave p256dh y secreto auth del navegador) */
export function encrypt(payload, p256dh, authSecret) {
  const ua = Buffer.from(p256dh, 'base64url'), auth = Buffer.from(authSecret, 'base64url');
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.generateKeys();
  const as = ecdh.getPublicKey();
  const shared = ecdh.computeSecret(ua);
  const salt = crypto.randomBytes(16);
  const ikm = Buffer.from(crypto.hkdfSync('sha256', shared, auth, Buffer.concat([Buffer.from('WebPush: info\0'), ua, as]), 32));
  const cek = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));
  const c = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const body = Buffer.concat([c.update(Buffer.concat([Buffer.from(payload), Buffer.from([2])])), c.final(), c.getAuthTag()]);
  const header = Buffer.alloc(21);
  salt.copy(header, 0);
  header.writeUInt32BE(4096, 16);
  header[20] = as.length;
  return Buffer.concat([header, as, body]);
}

/** Envía un aviso; devuelve el código HTTP del servicio (404/410 = la suscripción ya no existe) */
export async function sendPush(sub, payload, keys, subject, fetchImpl = fetch) {
  const body = encrypt(JSON.stringify(payload), sub.keys.p256dh, sub.keys.auth);
  const r = await fetchImpl(sub.endpoint, { method: 'POST', body, headers: {
    authorization: vapidHeader(sub.endpoint, keys, subject), 'content-encoding': 'aes128gcm',
    'content-type': 'application/octet-stream', ttl: '86400', urgency: 'high' } });
  return r.status;
}
