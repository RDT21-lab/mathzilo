/* Fases 8 y 9: ningún texto cortado ni desbordado, en los 4 idiomas, con letra normal y grande.
   Recorre perfiles, inicio, hojas, mascota, longitud y un test entero (con explicaciones). */
import { test, expect, type Page } from '@playwright/test';
import { addTasks, onboard, prepare } from './helpers';

async function overflow(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const dev = document.querySelector('.device'); if (!dev) return [];
    const D = dev.getBoundingClientRect(), out: string[] = [];
    for (const el of dev.querySelectorAll<HTMLElement>('*')) {
      if (el.closest('.sr-only')) continue;
      const hasText = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent!.trim());
      if (!hasText) continue;
      const r = el.getBoundingClientRect(); if (!r.width) continue;
      const box = (el.closest('.card,.pcard,.lencard,.qcard,.fbcard,.opt,.btn,.pill,.chip,.step,.rrow,.kidcard,.sect,.tcard,.sheetbox,.sheet-p,.tabbar button,.segs button,.pbtn,.bubble') as HTMLElement) || dev;
      const B = box.getBoundingClientRect();
      const ox = getComputedStyle(el).overflowX;
      // en los textos de un dibujo SVG, scrollWidth/clientWidth no significan nada: allí cuenta solo la posición
      const cut = !(el instanceof SVGElement) && el.scrollWidth > el.clientWidth + 1 && ox !== 'auto' && ox !== 'scroll' && el.clientWidth > 0;
      if (cut || r.right > B.right + 1 || r.left < B.left - 1 || r.right > D.right + 1 ||
          (box !== dev && r.bottom > B.bottom + 1 && getComputedStyle(box).overflowY === 'visible'))
        out.push(((el as unknown as { className: { baseVal?: string } }).className.baseVal ?? el.className) + ': ' + el.textContent!.trim().slice(0, 50));
    }
    return out;
  });
}

const L = {
  es: { play: 'Jugar como Ana', check: 'Comprobar', next: ['¡Entendido!', 'Siguiente', 'Seguimos', 'Ver resultado'] },
  en: { play: 'Play as Ana', check: 'Check', next: ['Got it!', 'Next', "Let's go on", 'See result'] },
  fr: { play: 'Jouer : Ana', check: 'Vérifier', next: ["J'ai compris !", 'Suivant', 'On continue', 'Voir le résultat'] },
  de: { play: 'Spielen als Ana', check: 'Prüfen', next: ['Verstanden!', 'Weiter', "Weiter geht's", 'Zum Ergebnis'] }
} as const;

for (const big of [false, true]) {
  for (const lang of ['de', 'fr', 'en', 'es'] as const) {
    for (const level of [2, 5]) {
      test.setTimeout(420_000);
      test(`maquetación ${lang} · nivel ${level}${big ? ' · letra grande' : ''}`, async ({ browser }) => {
        const ctx = await browser.newContext({ viewport: { width: 1024, height: 680 }, locale: 'es-ES', reducedMotion: 'reduce' });
        await prepare(ctx);
        const page = await ctx.newPage();
        await onboard(page, [{ name: 'Ana', level }]);
        await addTasks(page);
        await page.evaluate(async ([lang, big]) => {
          const sm = (window as unknown as { __sm: any }).__sm;
          for (const c of await sm.db.children.toArray()) await sm.repo.updateChild(c.id, { lang, bigText: big });
          await sm.repo.updateSettings({ lang });
        }, [lang, big] as const);
        const bad: string[] = [];
        const check = async (where: string) => { for (const o of await overflow(page)) bad.push(where + ' → ' + o); };
        await page.waitForTimeout(300);
        await check('perfiles');
        await page.getByRole('button', { name: L[lang].play }).click();
        await check('inicio');
        await page.locator('.tpill').click(); await page.waitForTimeout(1200); await check('tareas');
        await page.locator('.top .l .icon-btn').click();
        await page.locator('.pill.gold').click(); await check('estrellas'); await page.locator('.overlay').click({ position: { x: 5, y: 5 } });
        await page.locator('.top .r .icon-btn').first().click(); await check('ajustes niño'); await page.locator('.overlay').click({ position: { x: 5, y: 5 } });
        await page.locator('.nametag').click(); await check('mascota');
        await page.locator('.top .icon-btn').first().click();
        await page.locator('.cta .btn').last().click(); await check('longitud');
        await page.locator('.lencard').first().click();
        for (let i = 0; i < 200 && !(await page.locator('.res').isVisible()); i++) {
          if (process.env.DEBUG_LAYOUT) console.log(i, Date.now() % 100000, await page.locator('.count').textContent({ timeout: 300 }).catch(() => '-'));
          await check('pregunta ' + (await page.locator('.qtext').textContent({ timeout: 300 }).catch(() => '')));
          let clicked = false;
          for (const name of L[lang].next) {
            const b = page.getByRole('button', { name, exact: true }).first();
            if (await b.isVisible().catch(() => false) && await b.isEnabled().catch(() => false)) { await b.click(); clicked = true; break; }
          }
          if (clicked) continue;
          if (!(await page.locator('.answers').isVisible())) { await page.waitForTimeout(100); continue; }
          if (await page.locator('.opt').count()) await page.locator('.opt').last().click(); else await page.keyboard.press('7');
          await page.getByRole('button', { name: L[lang].check }).click();
          await page.locator('.fbcard').waitFor();
        }
        if (process.env.DEBUG_LAYOUT) console.log('fin del bucle');
        await check('resultado');
        if (process.env.DEBUG_LAYOUT) console.log('resultado comprobado');
        await ctx.close();
        if (process.env.DEBUG_LAYOUT) console.log('cerrado');
        expect([...new Set(bad)].slice(0, 15)).toEqual([]);
      });
    }
  }
}
