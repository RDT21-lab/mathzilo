import { defineConfig } from '@playwright/test';
import os from 'node:os';
import path from 'node:path';

// Pruebas de extremo a extremo contra la app compilada (dist/) servida por el servidor de
// sincronización, con un directorio de datos temporal. En local usa el Chrome instalado.
const dataDir = path.join(os.tmpdir(), 'starmath-e2e-' + Date.now());

export default defineConfig({
  testDir: 'e2e',
  timeout: 180_000,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:8788',
    channel: process.env.CI ? undefined : 'chrome',
    locale: 'es-ES',
    serviceWorkers: 'allow',
    actionTimeout: 15_000
  },
  expect: { timeout: 10_000 },
  webServer: {
    command: 'node server/sync-server.mjs',
    url: 'http://localhost:8788/api/time',
    env: { PORT: '8788', DATA_DIR: dataDir },
    reuseExistingServer: false
  }
});
