/* De punta a punta en la tablet: alta, test perfecto, estrellas, sin conexión y canje en local. */
import { test, expect } from '@playwright/test';
import { currentAnswer, onboard, playTest, prepare, setTestRules, unlockParent, PIN } from './helpers';

test.use({ viewport: { width: 1024, height: 680 } });

test('un niño completa un test, gana estrellas y la app sigue sin conexión', async ({ page, context }) => {
  await prepare(context);
  await onboard(page, [{ name: 'Lucía', level: 2 }]);
  await setTestRules(page);
  await page.evaluate(() => navigator.serviceWorker.ready);

  await page.getByRole('button', { name: 'Jugar como Lucía' }).click();
  await page.getByRole('button', { name: 'Matemáticas' }).click();
  await page.locator('.lencard').first().click();
  await playTest(page, true);
  await expect(page.getByText('¡Test perfecto!')).toBeVisible();
  await expect(page.locator('.tot b')).toHaveText('+15 ★');                 // 12 aprobado + 3 perfecto (los aciertos no suman)
  await expect(page.locator('.pill.gold')).toHaveText('15');

  // Sin conexión: recargar, ver los datos y hacer un test de práctica (no da estrellas)
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('button', { name: 'Jugar como Lucía' }).click();
  await expect(page.getByRole('button', { name: 'Matemáticas' })).toContainText('Para practicar');
  await page.getByRole('button', { name: 'Matemáticas' }).click();
  await page.locator('.lencard').first().click();
  await playTest(page, false);
  await expect(page.locator('.tot b')).toHaveText('+0 ★');
  await expect(page.locator('.pill.gold')).toHaveText('15');

  // Canje en local (sin cuenta en la nube) con PIN
  await unlockParent(page);
  await page.getByRole('button', { name: 'Canjear' }).click();
  await page.getByLabel('Estrellas a descontar').fill('5');
  await page.getByLabel('Motivo').fill('Cromos');
  await page.getByRole('button', { name: 'Confirmar con PIN' }).click();
  for (const d of PIN) await page.keyboard.press(d);
  await expect(page.locator('.balbig b')).toHaveText('10 ★');
  await context.setOffline(false);
});

test('un test a medias se retoma tras cerrar la app', async ({ page, context }) => {
  await prepare(context);
  await onboard(page, [{ name: 'Mateo', level: 4 }]);
  await page.getByRole('button', { name: 'Jugar como Mateo' }).click();
  await page.getByRole('button', { name: 'Matemáticas' }).click();
  await page.locator('.lencard').nth(1).click();
  await page.locator('.opt, .nk').first().click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'Comprobar' }).click();
  await page.locator('.fbcard').waitFor();
  await page.reload();
  await page.getByRole('button', { name: 'Jugar como Mateo' }).click();
  await expect(page.getByText('Tienes un test a medias: pregunta 2 de 15.')).toBeVisible();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByText('Pregunta 2 de 15')).toBeVisible();
});

test('premios del test: aprobar empieza en 1, suben de 0,5 en 0,5 y no hay estrellas por acierto', async ({ page, context }) => {
  await prepare(context);
  await onboard(page, [{ name: 'Leo', level: 1 }]);
  await unlockParent(page);
  await page.getByRole('button', { name: 'Ajustes' }).click();
  await expect(page.getByText('Por acierto')).toHaveCount(0);
  const row = page.locator('.srow').filter({ hasText: 'Bonus al aprobar 10' });
  await expect(row.locator('b')).toHaveText('1');
  await row.getByRole('button', { name: 'Más' }).click();
  await expect(row.locator('b')).toHaveText('1,5');
  await row.getByRole('button', { name: 'Más' }).click();
  await expect(row.locator('b')).toHaveText('2');
  await row.getByRole('button', { name: 'Menos' }).click();
  await expect(row.locator('b')).toHaveText('1,5');
  for (const label of ['Bonus al aprobar 15', 'Bonus al aprobar 20']) await expect(page.locator('.srow').filter({ hasText: label }).locator('b')).toHaveText('1');
  for (const label of ['Test perfecto', 'Racha de 3 días', 'Racha de 30 días']) await expect(page.locator('.srow').filter({ hasText: label }).locator('b')).toHaveText('0');
  // la tablet: test perfecto de 10 → solo 1,5 por aprobar, nada por cada acierto
  await page.evaluate(() => { location.hash = '#/'; });
  await page.getByRole('button', { name: 'Jugar como Leo' }).click();
  await page.getByRole('button', { name: 'Matemáticas' }).click();
  await expect(page.locator('.lencard').first()).toContainText('+1,5 si apruebas');
  await page.locator('.lencard').first().click();
  await playTest(page, true);
  await expect(page.locator('.rw')).toHaveCount(1);
  await expect(page.locator('.tot b')).toHaveText('+1,5 ★');
  await expect(page.locator('.pill.gold')).toHaveText('1,5');
});

test('temas de geografía: el niño los elige y el padre puede fijarlos', async ({ page, context }) => {
  await prepare(context);
  await onboard(page, [{ name: 'Iris', level: 2 }]);
  await page.getByRole('button', { name: 'Jugar como Iris' }).click();
  await page.getByRole('button', { name: 'Geografía' }).click();
  const topic = (n: string) => page.locator('.topics .topic').filter({ hasText: n });
  for (const n of ['Comunidades', 'Provincias', 'Capitales', 'Montañas', 'Ríos']) await expect(topic(n)).toHaveAttribute('aria-pressed', 'true');
  // el niño deja solo «Capitales»
  for (const n of ['Comunidades', 'Provincias', 'Montañas', 'Ríos']) await topic(n).click();
  await expect(topic('Capitales')).toHaveAttribute('aria-pressed', 'true');
  await topic('Capitales').click();                                   // siempre queda uno
  await expect(topic('Capitales')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('.lencard').first().click();
  for (let i = 0; i < 3; i++) {
    await page.locator('.answers').waitFor();
    await expect(page.locator('.qtext')).toContainText('capital');
    await expect(page.locator('.qcard .geomap').first()).toBeVisible();  // capitales: mapa de provincias con sus capitales
    await page.locator('.opt').first().click();
    await page.getByRole('button', { name: 'Comprobar' }).click();
    await page.locator('.fbcard').waitFor();
    const next = page.getByRole('button', { name: /¡Entendido!|Siguiente/ }).first();
    await next.click();
    if (await page.getByText('Mini-reto').isVisible()) { await page.locator('.opt').first().click(); await page.getByRole('button', { name: 'Comprobar' }).click(); await page.getByRole('button', { name: /Seguimos|Siguiente/ }).first().click(); }
  }
  await page.getByRole('button', { name: 'Pausar y salir' }).click();
  // el padre fija «Ríos» y «Montañas»
  await unlockParent(page);
  await page.getByRole('button', { name: 'Ajustes' }).click();
  const p = (n: string) => page.locator('.topicsP button').filter({ hasText: n });
  for (const n of ['Comunidades', 'Provincias', 'Capitales']) await p(n).click();
  await expect(p('Ríos')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('.srow').filter({ hasText: 'El niño elige los temas' }).getByRole('button', { name: 'No' }).click();
  await page.evaluate(() => { location.hash = '#/'; });
  await page.getByRole('button', { name: 'Jugar como Iris' }).click();
  await page.getByRole('button', { name: 'Empezar otro' }).click();
  await page.getByRole('button', { name: 'Geografía' }).click();
  await expect(page.locator('.topics .topic')).toHaveCount(2);
  await expect(page.getByText('Temas elegidos por tu familia')).toBeVisible();
  await expect(topic('Ríos')).toBeDisabled();
  await page.locator('.lencard').first().click();
  await page.locator('.answers').waitFor();
  await expect(page.locator('.qcard .geomap').first()).toBeVisible();   // ríos y montañas, con mapa
});

test('«No lo entiendo» llega a la ficha del hijo en el panel del padre', async ({ page, context }) => {
  await prepare(context);
  await onboard(page, [{ name: 'Noa', level: 1 }]);
  await page.getByRole('button', { name: 'Jugar como Noa' }).click();
  await page.getByRole('button', { name: 'Matemáticas' }).click();
  await page.locator('.lencard').first().click();
  // responde mal la primera pregunta (respuesta calculada con el motor) y sale la explicación
  await page.locator('.answers').waitFor();
  let ans = await currentAnswer(page, false);
  for (let i = 0; i < 20 && !ans; i++) { await page.waitForTimeout(150); ans = await currentAnswer(page, false); }
  if (!ans) throw new Error('sin pregunta activa');
  if (ans.type === 'mc') await page.locator('.opt').nth(ans.idx).click(); else for (const ch of ans.typed) await page.keyboard.press(ch);
  await page.getByRole('button', { name: 'Comprobar' }).click();
  await page.getByRole('button', { name: 'No lo entiendo' }).click();
  await page.getByRole('button', { name: 'Pausar y salir' }).click();
  await unlockParent(page);
  await page.locator('.kidcard').filter({ hasText: 'Noa' }).click();
  await expect(page.getByText('Explicaciones que no entendió')).toBeVisible();
  await expect(page.locator('.kidcard .hist .led').first()).toContainText('1');
});

test('geografía: test con el mapa, estrellas aparte de las de matemáticas y nivel propio', async ({ page, context }) => {
  await prepare(context);
  await onboard(page, [{ name: 'Lola', level: 3 }]);
  await setTestRules(page, { passBonus: { 10: 2, 15: 0, 20: 0 }, perfect: 0 });
  // el padre pone geografía en nivel 2
  await unlockParent(page);
  await page.getByRole('button', { name: 'Ajustes' }).click();
  const geo = page.locator('.srow').filter({ hasText: 'Nivel de geografía' });
  await expect(geo.locator('b')).toHaveText('1');
  await geo.getByRole('button', { name: 'Más' }).click();
  await expect(geo.locator('b')).toHaveText('2');
  await page.evaluate(() => { location.hash = '#/'; });
  await page.getByRole('button', { name: 'Jugar como Lola' }).click();
  // matemáticas: test perfecto, +2
  await page.getByRole('button', { name: 'Matemáticas' }).click();
  await page.locator('.lencard').first().click();
  await playTest(page, true);
  await expect(page.locator('.tot b')).toHaveText('+2 ★');
  await page.getByRole('button', { name: 'Volver al inicio' }).click();
  // geografía: sigue siendo «test de hoy» y también da estrellas
  await expect(page.getByRole('button', { name: 'Matemáticas' })).toContainText('Para practicar');
  await expect(page.getByRole('button', { name: 'Geografía' })).toContainText('Test de hoy');
  await page.getByRole('button', { name: 'Geografía' }).click();
  await expect(page.getByText('Geografía · Nivel 2')).toBeVisible();
  await page.locator('.lencard').first().click();
  await page.locator('.answers').waitFor();
  if (!(await page.locator('.qtext').textContent())!.includes('capital')) await expect(page.locator('.qcard .geomap:not(.ph)')).toBeVisible();
  await playTest(page, true);
  await expect(page.locator('.tot b')).toHaveText('+2 ★');
  await expect(page.locator('.pill.gold')).toHaveText('4');
  await page.getByRole('button', { name: 'Volver al inicio' }).click();
  await expect(page.getByRole('button', { name: 'Geografía' })).toContainText('Para practicar');
  // en el panel del padre se ve que fue de geografía
  await unlockParent(page);
  await page.locator('.kidcard').filter({ hasText: 'Lola' }).click();
  await expect(page.locator('.kidcard .hist .led').filter({ hasText: 'Geografía' })).toHaveCount(1);
});
