/* Tareas con dos navegadores reales: el padre pone una tarea de 1,5 ★ en el móvil, la niña la
   marca como hecha en la tablet, al padre le aparece para revisar y, al aprobarla, la tablet
   suma 1,5 estrellas sin hacer nada.                                                         */
import { test, expect } from '@playwright/test';
import { onboard, prepare, unlockParent } from './helpers';

test('tarea del padre → «hecha» en la tablet → aprobada → 1,5 ★ en los dos', async ({ browser }) => {
  const phoneCtx = await browser.newContext({ viewport: { width: 390, height: 800 }, locale: 'es-ES' });
  const tabletCtx = await browser.newContext({ viewport: { width: 1024, height: 680 }, locale: 'es-ES' });
  await prepare(phoneCtx); await prepare(tabletCtx);
  const phone = await phoneCtx.newPage(), tablet = await tabletCtx.newPage();

  // Móvil: familia, cuenta y código para la tablet
  await onboard(phone, [{ name: 'Sara', level: 2 }]);
  await unlockParent(phone);
  await phone.getByRole('button', { name: 'Ajustes' }).click();
  await phone.getByLabel('Email').fill('tareas-e2e@example.test');
  await phone.getByLabel('Contraseña (8 caracteres o más)').fill('clave-de-prueba-e2e');
  await phone.getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(phone.getByText('Conectado como tareas-e2e@example.test')).toBeVisible();
  await expect(phone.getByText('Avisos en este móvil')).toBeVisible();
  await phone.getByRole('button', { name: 'Vincular una tablet' }).click();
  const code = (await phone.locator('.paircode b').textContent())!.trim();

  await tablet.goto('/');
  await tablet.getByRole('button', { name: '¿Ya tienes cuenta? Vincula este dispositivo' }).click();
  await tablet.getByLabel('Código de 6 cifras').fill(code);
  await tablet.getByRole('button', { name: 'Vincular' }).click();
  await expect(tablet.getByRole('button', { name: 'Jugar como Sara' })).toBeVisible();

  // Móvil: nueva tarea de 1,5 estrellas, todos los días
  await phone.getByRole('button', { name: 'Tareas', exact: true }).click();
  await phone.getByRole('button', { name: '+ Añadir tarea' }).click();
  await phone.getByLabel('Tarea', { exact: true }).fill('Hacer la cama');
  await phone.getByLabel('Estrellas (puede llevar un decimal: 1,5)').fill('1,5');
  const form = phone.locator('.taskform');
  await form.getByRole('button', { name: 'sábado' }).click();
  await form.getByRole('button', { name: 'domingo' }).click();
  await phone.getByRole('button', { name: 'Guardar' }).click();
  await expect(phone.locator('.taskrow').filter({ hasText: 'Hacer la cama' }).first()).toContainText('+1,5 ★');

  // Tablet: la tarjeta de perfil ya la cuenta; la niña la marca como hecha
  await expect(tablet.locator('.pcard .pinfo')).toContainText('0/1', { timeout: 20_000 });
  await tablet.getByRole('button', { name: 'Jugar como Sara' }).click();
  await tablet.locator('.tpill').click();
  await tablet.getByRole('button', { name: '¡Ya la he hecho!' }).click();
  await expect(tablet.getByText('Tu familia la está mirando')).toBeVisible();

  // Móvil: aparece para revisar (tiempo real) y el padre la aprueba
  await phone.getByRole('button', { name: 'Panel' }).click();
  const review = phone.locator('.review-box');
  await expect(review).toContainText('Sara · Hacer la cama', { timeout: 20_000 });
  await expect(phone.locator('.tabbar .badge')).toHaveText('1');
  await review.getByRole('button', { name: 'Sí, está hecha' }).click();
  await expect(review).toHaveCount(0);
  await expect(phone.locator('.kidcard .bal')).toHaveText('1,5 ★');

  // Tablet: confirmada y 1,5 estrellas sin tocar nada
  await expect(tablet.getByText('¡Confirmada!')).toBeVisible({ timeout: 20_000 });
  await expect(tablet.locator('.pill.gold')).toHaveText('1,5');
  await phoneCtx.close(); await tabletCtx.close();
});
