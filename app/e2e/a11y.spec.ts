/* Fase 9: accesibilidad. axe-core en cada pantalla (niño en tablet, padre en móvil), en español
   y en alemán; además, botones de 56 px o más en el modo niño y respeto a «reducir movimiento». */
import { test, expect, type Page } from '@playwright/test';
import { createRequire } from 'node:module';
import { onboard, prepare, unlockParent } from './helpers';

const axePath = createRequire(import.meta.url).resolve('axe-core/axe.min.js');
type Violation = { id: string; impact: string; help: string; nodes: { target: string[] }[] };

async function audit(page: Page, screen: string, found: string[]) {
  await page.waitForTimeout(700);                                   // fin de animaciones
  await page.addScriptTag({ path: axePath });
  const v: Violation[] = await page.evaluate(async () => {
    const r = await (window as unknown as { axe: { run: (c: unknown, o: unknown) => Promise<{ violations: Violation[] }> } }).axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] },
      rules: { region: { enabled: false } }
    });
    return r.violations;
  });
  for (const x of v) found.push(`${screen} · ${x.impact} · ${x.id}: ${x.help} → ${x.nodes.slice(0, 3).map(n => n.target.join(' ')).join(' | ')}`);
}

async function smallTargets(page: Page, screen: string, found: string[]) {
  const small = await page.evaluate(() => [...document.querySelectorAll('.device.kid button')].filter(b => {
    const r = b.getBoundingClientRect(), s = (document.querySelector('.device') as HTMLElement).getBoundingClientRect().width / 1024;
    return r.width > 0 && (r.height / s < 55.5 || r.width / s < 55.5);
  }).map(b => (b.getAttribute('aria-label') ?? b.textContent ?? '').trim().slice(0, 30)));
  for (const s of small) found.push(`${screen} · botón < 56 px: ${s}`);
}

for (const lang of ['es', 'de'] as const) {
  test(`accesibilidad (${lang})`, async ({ browser }) => {
    const found: string[] = [];
    const ctx = await browser.newContext({ viewport: { width: 1024, height: 680 }, locale: 'es-ES', reducedMotion: 'reduce' });
    await prepare(ctx);
    const page = await ctx.newPage();
    await page.goto('/');
    await audit(page, 'bienvenida', found);
    await onboard(page, [{ name: 'Lucía', level: 3 }]);
    if (lang === 'de') await page.evaluate(async () => {
      const sm = (window as unknown as { __sm: any }).__sm;
      for (const c of await sm.db.children.toArray()) await sm.repo.updateChild(c.id, { lang: 'de' });
      await sm.repo.updateSettings({ lang: 'de' });
    });
    const L = lang === 'es'
      ? { play: 'Jugar como Lucía', start: 'Empezar', check: 'Comprobar', got: '¡Entendido!', stars: 'Mis estrellas', home: 'Volver al inicio', mascot: 'Ver a Chispa', redeem: 'Canjear', settings: 'Ajustes' }
      : { play: 'Spielen als Lucía', start: 'Los geht', check: 'Prüfen', got: 'Verstanden!', stars: 'Meine Sterne', home: 'Zur Startseite', mascot: 'Chispa ansehen', redeem: 'Einlösen', settings: 'Einstellungen' };
    await audit(page, 'perfiles', found); await smallTargets(page, 'perfiles', found);
    await page.getByRole('button', { name: L.play }).click();
    await audit(page, 'inicio', found); await smallTargets(page, 'inicio', found);
    await page.getByRole('button', { name: L.stars }).click();
    await audit(page, 'mis estrellas', found);
    await page.keyboard.press('Escape'); await page.locator('.overlay').click({ position: { x: 5, y: 5 } });
    await page.getByRole('button', { name: L.start, exact: false }).last().click();
    await audit(page, 'longitud', found); await smallTargets(page, 'longitud', found);
    await page.locator('.lencard').first().click();
    await audit(page, 'pregunta', found); await smallTargets(page, 'pregunta', found);
    if (await page.locator('.opt').count()) await page.locator('.opt').first().click(); else await page.keyboard.press('9');
    await page.getByRole('button', { name: L.check }).click();
    await page.locator('.fbcard').waitFor();
    await audit(page, 'respuesta', found); await smallTargets(page, 'respuesta', found);
    await page.goto('/#/padre');
    await audit(page, 'PIN', found);
    await page.setViewportSize({ width: 390, height: 800 });
    await unlockParentLang(page, lang);
    await audit(page, 'panel', found);
    await page.locator('.tabbar button').nth(1).click(); await audit(page, 'canjear', found);
    await page.locator('.tabbar button').nth(2).click(); await audit(page, 'ajustes', found);
    await ctx.close();
    expect(found, found.join('\n')).toEqual([]);
  });
}

async function unlockParentLang(page: Page, lang: string) {
  if (lang === 'es') return unlockParent(page);
  for (const d of '1234') await page.keyboard.press(d);
  await expect(page.locator('.tabbar')).toBeVisible();
}
