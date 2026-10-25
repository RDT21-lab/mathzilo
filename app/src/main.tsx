import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/lexend/400.css';
import '@fontsource/lexend/500.css';
import '@fontsource/lexend/700.css';
import '@fontsource/lexend/800.css';
import './styles/app.css';
import './styles/app-extra.css';
import { initLang } from './i18n';
import { App } from './App';
import { ErrorBoundary, installErrorHandlers } from './errors';
import { captureInstallPrompt } from './install';

installErrorHandlers();
captureInstallPrompt();

// Solo en desarrollo o en las pruebas de extremo a extremo (indicador sm-e2e): acceso a los datos
// locales desde la consola. No da más poder que las herramientas del navegador: el servidor valida igual.
let e2e = false;
try { e2e = localStorage.getItem('sm-e2e') === '1'; } catch { /* sin almacenamiento */ }
if (import.meta.env.DEV || e2e) {
  Promise.all([import('./data/repo'), import('./data/db'), import('./engine')]).then(([repo, dbm, engine]) => {
    (window as unknown as Record<string, unknown>).__sm = { repo, db: dbm.db, engine };
  });
}

initLang().finally(() => createRoot(document.getElementById('root')!).render(<StrictMode><ErrorBoundary><App /></ErrorBoundary></StrictMode>));
