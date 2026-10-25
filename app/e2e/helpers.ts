/* Utilidades de las pruebas de extremo a extremo. */
import { expect, type Page, type BrowserContext } from '@playwright/test';

export const PIN = '1234';

/** Activa el acceso de pruebas antes de que cargue la app */
export async function prepare(context: BrowserContext) {
  await context.addInitScript(() => { try { localStorage.setItem('sm-e2e', '1'); } catch { /* nada */ } });
}

/** Primera vez: idioma, consentimiento, PIN e hijos */
export async function onboard(page: Page, kids: { name: string; level: number }[]) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Español' }).click();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByLabel('PIN', { exact: true }).fill(PIN);
  await page.getByLabel('Repite el PIN').fill(PIN);
  await page.getByRole('button', { name: 'Siguiente' }).click();
  for (const [i, k] of kids.entries()) {
    if (i > 0) await page.getByRole('button', { name: '+ Otro hijo' }).click();
    await page.getByLabel('Nombre o alias').fill(k.name);
    for (let l = 1; l < k.level; l++) await page.getByRole('button', { name: 'Más' }).first().click();
    await page.getByRole('button', { name: 'Guardar' }).click();
  }
  await page.getByRole('button', { name: 'Empezar' }).click();
  await expect(page.getByText('¿Quién va a jugar?')).toBeVisible();
}

/** Lo que tiene que pulsar el niño para la pregunta en pantalla (calculado con el motor) */
async function currentAnswer(page: Page, correct: boolean) {
  return page.evaluate(async (correct) => {
    const sm = (window as unknown as { __sm: any }).__sm;
    for (const k of await sm.db.children.toArray()) {
      const a = await sm.repo.getActive(k.id);
      if (!a || a.i >= a.qs.length) continue;
      const q = sm.engine.makeQuestion(a.qs[a.i].gen, a.qs[a.i].seed);
      const v = q.answer;
      const typed = v.k === 'int' ? String(v.v) : v.k === 'frac' ? v.n + '/' + v.d
        : v.k === 'money' ? (v.c % 100 ? (v.c / 100).toFixed(2) : String(v.c / 100))
        : v.k === 'dec' ? (v.u / 10 ** v.p).toFixed(v.p) : '';
      return { type: q.type, idx: q.options.findIndex((o: { tag: string }) => (o.tag === 'ok') === correct), typed: correct ? typed : '9999' };
    }
    return null;
  }, correct);
}

/** Responde todo el test (bien o mal) hasta la pantalla de resultado */
export async function playTest(page: Page, correct = true) {
  for (let i = 0; i < 200; i++) {
    if (await page.locator('.res').isVisible()) return;
    let clicked = false;
    for (const name of ['¡Entendido!', 'Siguiente', 'Seguimos', 'Ver resultado']) {
      const b = page.getByRole('button', { name }).first();
      if (await b.isVisible().catch(() => false) && await b.isEnabled()) { await b.click(); clicked = true; break; }
    }
    if (clicked) continue;
    if (await page.locator('.res').isVisible()) return;
    if (!(await page.locator('.answers').isVisible())) { await page.waitForTimeout(150); continue; }
    if (await page.getByText('Mini-reto').isVisible()) {
      // mini-reto: cualquier respuesta sirve para avanzar
      if (await page.locator('.opt').first().isVisible()) await page.locator('.opt').first().click();
      else await page.keyboard.press('1');
      await page.getByRole('button', { name: 'Comprobar' }).click();
      await page.locator('.fbcard').waitFor();
      continue;
    }
    const ans = await currentAnswer(page, correct);
    if (!ans) { await page.waitForTimeout(200); continue; }
    await page.waitForTimeout(2100);                       // sin prisa: la regla anti-prisa quitaría el bonus
    if (ans.type === 'mc') await page.locator('.opt').nth(ans.idx).click();
    else for (const ch of ans.typed) await page.keyboard.press(ch === '.' ? ',' : ch);
    await page.getByRole('button', { name: 'Comprobar' }).click();
    await page.locator('.fbcard').waitFor();
  }
  throw new Error('el test no terminó');
}

export async function unlockParent(page: Page) {
  // como una persona: botón «Modo padre» si está a la vista; si no, cambiando la ruta
  const btn = page.getByRole('button', { name: 'Modo padre' });
  if (await btn.isVisible().catch(() => false)) await btn.click();
  else await page.evaluate(() => { location.hash = '#/padre'; });
  await expect(page.getByText('Introduce tu PIN')).toBeVisible();
  for (const d of PIN) await page.keyboard.press(d);
  await expect(page.getByRole('heading', { name: 'Hola' })).toBeVisible();
}
