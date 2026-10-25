/* Sonidos opcionales, sintetizados (sin archivos que descargar). Nunca hay sonido de fallo. */
let ctx: AudioContext | null = null;
function tone(freq: number, at: number, dur: number, vol = 0.12) {
  if (!ctx) ctx = new AudioContext();
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'triangle'; o.frequency.value = freq;
  g.gain.setValueAtTime(0, ctx.currentTime + at);
  g.gain.linearRampToValueAtTime(vol, ctx.currentTime + at + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + at + dur);
  o.connect(g).connect(ctx.destination);
  o.start(ctx.currentTime + at); o.stop(ctx.currentTime + at + dur + 0.05);
}
export function playOk() { try { tone(660, 0, 0.18); tone(990, 0.12, 0.28); } catch { /* sin audio */ } }
export function playWin() { try { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.3)); } catch { /* sin audio */ } }
