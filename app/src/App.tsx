/* Rutas con hash: #/ modo niño, #/padre modo padre, #/revision hoja de revisión de preguntas. */
import { lazy, Suspense, useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import * as repo from './data/repo';
import type { Family } from './data/types';
import { startBackgroundSync } from './sync/client';
import { useLive } from './ui/common';
import { KidApp } from './ui/kid/KidApp';
// El modo padre, la bienvenida y la revisión se descargan solo cuando se abren
const ParentApp = lazy(() => import('./ui/parent/ParentApp').then(m => ({ default: m.ParentApp })));
const Onboarding = lazy(() => import('./ui/parent/Onboarding').then(m => ({ default: m.Onboarding })));
const Review = lazy(() => import('./ui/Review').then(m => ({ default: m.Review })));

const LOADING = Symbol('loading');

export function App() {
  const family = useLive<Family | undefined | typeof LOADING>(() => repo.getFamily(), [], LOADING);
  const [route, setRoute] = useState(location.hash || '#/');
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({ immediate: true });
  useEffect(() => {
    const f = () => setRoute(location.hash || '#/');
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  const familyId = family === LOADING ? null : family?.id;
  useEffect(() => (familyId ? startBackgroundSync() : undefined), [familyId]);
  const go = (h: string) => { location.hash = h; };

  if (route.startsWith('#/revision')) return <Suspense fallback={null}><Review /></Suspense>;
  if (family === LOADING) return null;
  if (!family) return <Suspense fallback={null}><Onboarding onDone={() => go('#/')} /></Suspense>;
  if (route.startsWith('#/padre')) return <Suspense fallback={null}><ParentApp family={family} onExit={() => go('#/')} /></Suspense>;
  return <KidApp family={family} onParent={() => go('#/padre')} needRefresh={needRefresh} onRefresh={() => updateServiceWorker(true)} />;
}
