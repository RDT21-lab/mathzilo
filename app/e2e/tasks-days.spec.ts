/* Tareas en un solo móvil (modo padre + modo niño), de un día para otro:
   - una tarea aprobada sigue saliendo ese día (como «¡Confirmada!»);
   - al día siguiente las tareas que se repiten vuelven a salir por hacer, aunque la app se haya quedado abierta;
   - una tarea borrada o en pausa deja de salir, y al reactivarla vuelve.                             */
import { test, expect, type Page } from '@playwright/test';
import { onboard, prepare, unlockParent } from './helpers';

test.use({ viewport: { width: 390, height: 844 } });

async function toParent(page: Page) {
  await page.evaluate(() => { location.hash = '#/'; });
  await unlockParent(page);
  await page.locator('.tabbar button').filter({ hasText: 'Tareas' }).click();     // puede llevar el número de tareas por revisar
}
async function toKid(page: Page) {
  await page.evaluate(() => { location.hash = '#/'; });
  const play = page.getByRole('button', { name: 'Jugar como Sara' });
  if (await play.isVisible().catch(() => false)) await play.click();
}
/** Por defecto se repite todos los días; `everyDay: false` quita el sábado y el domingo */
async function addTask(page: Page, title: string, everyDay: boolean) {
  await page.getByRole('button', { name: '+ Añadir tarea' }).click();
  await page.getByLabel('Tarea', { exact: true }).fill(title);
  const form = page.locator('.taskform');
  if (!everyDay) { await form.getByRole('button', { name: 'sábado' }).click(); await form.getByRole('button', { name: 'domingo' }).click(); }
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.locator('.taskrow').filter({ hasText: title }).first()).toBeVisible();
}

test('las tareas se quedan al aprobarlas y vuelven cada día; borrar o pausar las quita', async ({ page, context }) => {
  await context.clock.install({ time: new Date('2026-11-04T10:00:00') });     // miércoles
  await prepare(context);
  await onboard(page, [{ name: 'Sara', level: 2 }]);
  await unlockParent(page);
  await page.getByRole('button', { name: 'Tareas', exact: true }).click();
  await addTask(page, 'Hacer la cama', true);
  await addTask(page, 'Recoger los juguetes', false);

  // modo niño en el móvil: las dos tareas, por hacer
  await toKid(page);
  await expect(page.locator('.tpill')).toContainText('0/2');
  await page.locator('.tpill').click();
  await expect(page.locator('.tcard')).toHaveCount(2);
  await page.locator('.tcard').filter({ hasText: 'Hacer la cama' }).getByRole('button', { name: '¡Ya la he hecho!' }).click();
  await expect(page.locator('.tcard').filter({ hasText: 'Hacer la cama' })).toContainText('Tu familia la está mirando');

  // el padre la aprueba
  await toParent(page);
  await page.locator('.taskrow').filter({ hasText: 'Hacer la cama' }).first().getByRole('button', { name: 'Sí, está hecha' }).click();
  await expect(page.locator('.taskrow').filter({ hasText: 'Hacer la cama' }).first()).toContainText('Hecha');

  // la niña la sigue viendo, confirmada, junto a la otra
  await toKid(page);
  await expect(page.locator('.tpill')).toContainText('1/2');
  await page.locator('.tpill').click();
  await expect(page.locator('.tcard')).toHaveCount(2);
  await expect(page.locator('.tcard').filter({ hasText: 'Hacer la cama' })).toContainText('¡Confirmada!');

  // al día siguiente, con la app abierta toda la noche: vuelven a estar por hacer
  await page.clock.fastForward('24:00:00');
  await expect(page.locator('.tcard')).toHaveCount(2);
  await expect(page.locator('.tcard').filter({ hasText: 'Hacer la cama' }).getByRole('button', { name: '¡Ya la he hecho!' })).toBeVisible();
  await page.locator('.top .l .icon-btn').click();
  await expect(page.locator('.tpill')).toContainText('0/2');

  // borrar una y pausar la otra: no sale ninguna; al reactivarla vuelve
  await toParent(page);
  const row = (title: string) => page.locator('.taskrow').filter({ hasText: title }).last();
  await row('Recoger los juguetes').getByRole('button', { name: 'Borrar: Recoger los juguetes' }).click();
  await row('Recoger los juguetes').getByRole('button', { name: 'Borrar', exact: true }).click();
  await row('Hacer la cama').getByRole('button', { name: 'Pausar: Hacer la cama' }).click();
  await toKid(page);
  await expect(page.locator('.tpill')).toHaveCount(0);
  await toParent(page);
  await row('Hacer la cama').getByRole('button', { name: 'Activar: Hacer la cama' }).click();
  await toKid(page);
  await expect(page.locator('.tpill')).toContainText('0/1');
  await page.locator('.tpill').click();
  await expect(page.locator('.tcard')).toHaveCount(1);
  await expect(page.locator('.tcard')).toContainText('Hacer la cama');

  // el domingo sigue saliendo la que se repite todos los días
  await page.clock.fastForward(3 * 86400_000);
  await expect(page.locator('.tcard')).toHaveCount(1);
  await expect(page.locator('.tcard').getByRole('button', { name: '¡Ya la he hecho!' })).toBeVisible();
});
