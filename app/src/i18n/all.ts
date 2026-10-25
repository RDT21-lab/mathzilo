/* Todos los idiomas cargados de golpe (para las pruebas). La app los carga bajo demanda. */
import i18n from './index';
import esC from './es/content.json';
import esU from './es/ui.json';
import enC from './en/content.json';
import enU from './en/ui.json';
import frC from './fr/content.json';
import frU from './fr/ui.json';
import deC from './de/content.json';
import deU from './de/ui.json';

export const resources = {
  es: { translation: { ...esC, ...esU } },
  en: { translation: { ...enC, ...enU } },
  fr: { translation: { ...frC, ...frU } },
  de: { translation: { ...deC, ...deU } }
};
for (const [l, r] of Object.entries(resources)) i18n.addResourceBundle(l, 'translation', r.translation, true, true);
