/* Criterio de la fase 7 con dos navegadores reales: móvil del padre y tablet en modo avión. */
import { test, expect } from '@playwright/test';
import { onboard, playTest, prepare, unlockParent, PIN } from './helpers';

test('test sin conexión en la tablet + canje del padre → mismo saldo en los dos', async ({ browser }) => {
  const phoneCtx = await browser.newContext({ viewport: { width: 390, height: 800 }, locale: 'es-ES' });
  const tabletCtx = await browser.newContext({ viewport: { width: 1024, height: 680 }, locale: 'es-ES' });
  await prepare(phoneCtx); await prepare(tabletCtx);
  const phone = await phoneCtx.newPage(), tablet = await tabletCtx.newPage();

  // Móvil: alta de la familia y cuenta en el servidor
  await onboard(phone, [{ name: 'Sara', level: 3 }]);
  await unlockParent(phone);
  await phone.getByRole('button', { name: 'Ajustes' }).click();
  await phone.getByLabel('Email').fill('familia-e2e@example.test');
  await phone.getByLabel('Contraseña (8 caracteres o más)').fill('clave-de-prueba-e2e');
  await phone.getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(phone.getByText('Conectado como familia-e2e@example.test')).toBeVisible();
  await phone.getByRole('button', { name: 'Vincular una tablet' }).click();
  const code = (await phone.locator('.paircode b').textContent())!.trim();
  expect(code).toMatch(/^\d{6}$/);

  // Tablet: se vincula con el código
  await tablet.goto('/');
  await tablet.getByRole('button', { name: '¿Ya tienes cuenta? Vincula este dispositivo' }).click();
  await tablet.getByLabel('Código de 6 cifras').fill(code);
  await tablet.getByRole('button', { name: 'Vincular' }).click();
  await expect(tablet.getByRole('button', { name: 'Jugar como Sara' })).toBeVisible();
  await tablet.evaluate(() => navigator.serviceWorker.ready);

  // Modo avión: test perfecto
  await tabletCtx.setOffline(true);
  await tablet.getByRole('button', { name: 'Jugar como Sara' }).click();
  await tablet.getByRole('button', { name: 'Empezar' }).click();
  await tablet.locator('.lencard').first().click();
  await playTest(tablet, true);
  await expect(tablet.locator('.tot b')).toHaveText('+15 ★');
  await expect(tablet.locator('.pill.gold')).toHaveText('15');

  // El móvil aún no lo sabe
  await phone.getByRole('button', { name: 'Panel' }).click();
  await expect(phone.locator('.kidcard .bal')).toHaveText('0 ★');

  // Vuelve la conexión: la tablet sincroniza y el móvil se entera en tiempo real
  await tabletCtx.setOffline(false);
  await tablet.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(phone.locator('.kidcard .bal')).toHaveText('15 ★', { timeout: 20_000 });

  // Canje del padre (el servidor comprueba el PIN y el saldo)
  await phone.getByRole('button', { name: 'Canjear' }).click();
  await phone.getByLabel('Estrellas a descontar').fill('6');
  await phone.getByLabel('Motivo').fill('Helado pequeño');
  await phone.getByRole('button', { name: 'Confirmar con PIN' }).click();
  for (const d of PIN) await phone.keyboard.press(d);
  await expect(phone.locator('.balbig b')).toHaveText('9 ★');

  // La tablet recibe el canje sin hacer nada
  await expect(tablet.locator('.pill.gold')).toHaveText('9', { timeout: 20_000 });
  await phoneCtx.close(); await tabletCtx.close();
});
