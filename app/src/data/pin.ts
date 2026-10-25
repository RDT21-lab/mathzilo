/* PIN del modo padre: PBKDF2-SHA-256 con sal aleatoria. El servidor de sincronización usa el
   mismo formato, así que puede comprobar el PIN de un canje sin conocerlo.                   */
export const PIN_ITER = 120_000;
export const MAX_TRIES = 5;
export const LOCK_MS = 15 * 60_000;
export const IDLE_MS = 5 * 60_000;

const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
const unhex = (s: string) => new Uint8Array(s.match(/../g)!.map(h => parseInt(h, 16)));

export function newSalt(): string { return hex(crypto.getRandomValues(new Uint8Array(16)).buffer); }

export async function hashPin(pin: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: unhex(salt), iterations: PIN_ITER }, key, 256);
  return hex(bits);
}

export const validPin = (pin: string) => /^\d{4,6}$/.test(pin);
