# Mathzilo — nota de traspaso (para continuar en otra conversación de Claude)

## Qué es
App PWA de repaso diario de matemáticas para niños de 6–12 años (niveles 1–6, 1–3 hijos por familia). Uso familiar, no se vende. El niño usa una tablet; el padre gestiona desde el móvil con PIN. Nombre: **Mathzilo** (elegido el 25-10-2026 para sustituir a «StarMath», que chocaba con «Star Math» de Renaissance Learning; en una búsqueda no apareció ninguna app con ese nombre). Logo elegido: "estrella con órbita".
Plan completo de 12 fases: `Mathzilo — diseño de la app y plan de desarrollo de la PWA.pdf` (en esta carpeta).

## Decisiones tomadas
- Tests diarios de 10/15/20 preguntas (opción múltiple + teclado numérico con coma, barra de fracción y signo menos según el nivel).
- Recompensa en **estrellas** (nunca euros). El padre decide en privado lo que vale una estrella, define los premios y descuenta estrellas tras un canje con PIN.
- Rachas con **escudo** (se gana a los 7 días, máx. 2), mascota (zorro o robot, 4 etapas por mejor racha; nunca retrocede).
- Explicaciones de los fallos sin rojo (coral), en **dos tonos** (6-8 y 9-12 años, elegible por hijo) y con mini-reto.
- 4 idiomas (ES/EN/FR/DE), funciona sin conexión, las respuestas se calculan con aritmética exacta.
- **Foto del cuaderno: aplazada** (decisión del usuario, 19-10-2026). Gemini descartado.
- **Sin Supabase** (decisión del usuario). La fase 7 usa un **servidor de sincronización propio** (`app/server/sync-server.mjs`, Node sin dependencias) que sustituye a Supabase.
- Node no estaba instalado: se usa **Node 24 LTS portátil** en `tools/node-v24.22.0-win-x64/` (zip oficial verificado con SHA-256).

## Estado (19-10-2026): fases 1 a 8 hechas

| Fase | Qué hay | Criterio del plan | Estado |
|---|---|---|---|
| 1 Prototipo | `src/app.js`, `src/template.html`, `build.py` → `dist/starmath-prototipo.html` (6 pantallas niño + 4 padre, PIN demo 1234) | Lo aprueba el usuario y lo prueba un niño | **Pendiente de tu aprobación y de la prueba con un niño** |
| 2 Esqueleto PWA | `app/`: Vite + React + TS + Tailwind (preset de tokens) + i18next + vite-plugin-pwa (manifest, iconos, precaché) | Se instala y abre sin conexión | Verificado en navegador: abre con el servidor apagado. **Falta probar la instalación en tablet y móvil reales** |
| 3 Motor | `app/src/engine/`: 46 generadores (niveles 1-6), racionales exactos, árbol de la operación para doble comprobación | 10.000 semillas por generador + revisión a mano de 50 por nivel | 460.000 preguntas, 0 fallos. Hoja de revisión en `#/revision`. **Falta tu revisión a mano** |
| 4 Flujo niño | Perfiles, inicio, longitud, pregunta, resultado, mascota, mis estrellas, ajustes del niño; IndexedDB (Dexie), libro de movimientos, rachas, escudos, test que se pausa y se retoma | Un niño completa tests de niveles 1-3 sin conexión | Recorrido completo probado en el navegador |
| 5 Explicaciones | 52 etiquetas de error × 2 tonos, pasos por generador, apoyo visual (decenas, columnas, reloj, tartas, rectángulos, recta numérica…), mini-reto | Cada distractor tiene explicación | Comprobado por prueba automática en los 4 idiomas |
| 6 Modo padre | PIN (PBKDF2, 5 fallos = 15 min, 5 min de inactividad), panel con dominio/errores/calendario/sugerencia de nivel, premios, canje con PIN, historial con compensación, ajustes, exportar y borrar | El saldo cuadra tras tests y canjes | Prueba automática en verde |
| 7 Nube | Servidor propio + cola offline + tiempo real (SSE) + vinculación de la tablet con código de 6 cifras; canjes validados con PIN en el servidor | Tablet en modo avión hace un test; tras volver la conexión y un canje, mismo saldo | Prueba automática con dos dispositivos en verde. Además: la tablet no puede alterar saldo, reglas ni PIN; un solo test con estrellas al día; reloj adelantado corregido por el servidor |
| 8 Niveles 4-6 e idiomas | Generadores 4-6, problemas con texto (palabras con género en ES/FR), traducción completa EN/FR/DE | Capturas en 4 idiomas sin textos cortados | Barrido automático de todas las pantallas en los 4 idiomas sin desbordes (el alemán primero). **Falta la revisión por nativos** |

## Estado (21-10-2026): fases 0, 9, 10 y 11 preparadas

| Fase | Qué hay | Lo que no se puede hacer sin ti |
|---|---|---|
| 0 Preparación | `.github/workflows/ci.yml` (tipos, pruebas, compilación, E2E; en `main` publica la imagen en GHCR y despliega por SSH si hay secretos), `Dockerfile`, `deploy/docker-compose.yml` + `Caddyfile` (HTTPS automático), `.gitignore`, `.dockerignore` | Nombre definitivo, dominio, cuenta de GitHub y servidor en la UE. Docker no está en este PC: la imagen no se ha construido aquí |
| 9 Calidad | axe-core sin infracciones en todas las pantallas (ES y DE); botones del modo niño ≥ 56 px; opción **Letra grande**; «reducir movimiento» respetado; Lighthouse móvil 4G: **rendimiento 90, accesibilidad 100, buenas prácticas 100**, FCP 2,6 s, interactiva 3,0 s, 242 KB (idiomas y modo padre bajo demanda + compresión en el servidor); pruebas de punta a punta con Playwright (`app/e2e/`): flujo del niño sin conexión, retomar test, dos dispositivos con canje, accesibilidad y maquetación en 4 idiomas con letra normal y grande | Pruebas en tablet y móvil reales y prueba con 1-2 niños sin ayuda |
| 10 Privacidad y despliegue | Aviso de privacidad en 4 idiomas (borrador), exportar y borrar datos, recordatorio semanal de exportar, copias diarias del servidor (`server/backup.mjs`, se guardan 30, con restauración), registro de errores sin datos personales (`/api/log` → `errors.log`, limpieza de emails/tokens/números largos, límite por hora) y pantalla amable si algo falla, ayuda de instalación dentro de la app (según iPad/Android/escritorio) y «Proteger los datos», guía para la familia en `docs/guia-instalacion.md` | Revisión legal del aviso de privacidad; poner el servidor en producción |
| 11 Piloto | Botón **«No lo entiendo»** en las explicaciones (se sincroniza), **Resumen del piloto** en el panel (días con test, aprobados, estrellas al mes frente al premio más caro, tests con prisa, explicaciones más marcadas) y notas del piloto incluidas en la exportación; protocolo en `docs/piloto.md` | Las 2 semanas de uso real y la sesión de ajustes |

Pruebas (21-10-2026, todas en verde):
- `npm test`: **88** unitarias (motor con 10.000 semillas por generador, datos, sincronización, idiomas, servidor, actualización de esquema sin pérdida de datos).
- `npm run e2e`: **21** de punta a punta con Chrome (flujo del niño sin conexión, retomar test, dos dispositivos con canje, axe en ES y DE, maquetación en 4 idiomas × niveles 2 y 5 × letra normal y grande). Necesita `npm run build` antes.

## Estado (27-10-2026): tareas, perfiles con resultados, dificultad y avisos (v0.9.0)
Pedido por la familia piloto:
- **Perfiles del niño** (tablet): cada tarjeta muestra estrellas para gastar, último test, % de aciertos de la semana y tareas de hoy (aprobadas / por revisar).
- **Tareas** (pestaña nueva del modo padre, `ui/parent/Tasks.tsx`): por hijo; de un día concreto o de varios días de la semana; en pausa o borradas; **días con tareas** por hijo (p. ej. fines de semana desconectados); estrellas con **un decimal**; **premios por conjunto** (todas las del día o un grupo elegido).
- **Flujo**: el niño pulsa «¡Ya la he hecho!» (estado `claimed`); el padre ve «Tareas por revisar» en el panel (y un número en la pestaña) y decide «Sí, está hecha» (paga la tarea y, si completa un conjunto, el premio) o «Aún no». Los apuntes de tareas tienen id fijo `tarea:<tarea>:<día>`: aprobar dos veces o desde dos móviles no paga dos veces.
- **Avisos al móvil del padre** (Web Push propio, sin dependencias, `server/webpush.mjs`: cifrado RFC 8291 + VAPID RFC 8292; claves VAPID en `index.json` del servidor). Se activan en Ajustes → Nube → «Avisos en este móvil». En iPhone/iPad hace falta tener la app instalada en la pantalla de inicio (iOS 16.4+). Solo se envía a servicios de avisos conocidos (Google, Mozilla, Apple, Windows).
- **Dificultad**: en el panel, al abrir la tarjeta del hijo, «Dificultad» con los últimos tests del nivel y botones para subir o bajar (decide el padre; la sugerencia automática sigue).
- Servidor: tablas `tasks` y `checks` (última modificación gana); la tablet solo puede marcar `claimed` y nunca deshacer una aprobada; solo el padre crea apuntes `tarea` (validados contra la tarea y con un decimal como mucho). Base local Dexie v3.
- Pruebas: `tests/tasks.test.ts` (reglas, decimales, flujo local, dos dispositivos, aviso cifrado descifrado y firma VAPID comprobada) y `e2e/tasks.spec.ts` (móvil + tablet reales). Accesibilidad y maquetación cubren las pantallas nuevas.
- Pendiente: probar los avisos en un móvil real (Android Chrome e iPhone con la app instalada).
- **v0.9.1 (28-10-2026), correcciones de la revisión**: el PIN de la tablet en modo padre se renueva con el uso (antes caducaba a los 5 min y el servidor rechazaba aprobaciones y tareas nuevas); los pasos de una tarea siempre ganan al anterior aunque los relojes no cuadren; lo que el servidor rechaza vuelve en local al estado del servidor (salvo la familia); una tarea con fecha sale aunque ese día de la semana esté desconectado; sin avisos de tareas en pausa o borradas.
- Límites conocidos: aprobaciones hechas en la tablet sin conexión que tardan más de 5 min en sincronizar se rechazan (hay que repetirlas); un premio por conjunto cuyas tareas se aprueban en dos dispositivos antes de sincronizar no se paga solo.

## Cómo arrancar
Desde `starmath-fase1/app` (en PowerShell o Git Bash):
```
$env:PATH = "$PWD\..\tools\node-v24.22.0-win-x64;$env:PATH"   # PowerShell
npm test               # pruebas unitarias (motor 10.000 semillas, datos, sync, idiomas, servidor)
npm run dev            # desarrollo en http://localhost:5173 (sin service worker)
npm run build          # compila a app/dist
npm run e2e            # punta a punta con Playwright y el Chrome instalado (tras build)
npm run sync-server    # servidor de sincronización en :8787; también sirve app/dist (comprimido)
node server/backup.mjs # copia de seguridad de los datos del servidor
```
- Prototipo de la fase 1: `python build.py` (en `starmath-fase1/`) → `dist/starmath-prototipo.html`.
- En desarrollo, la consola expone `window.__sm = { repo, db, engine }` para preparar datos de prueba.
- Rutas: `#/` niño · `#/padre` padre · `#/revision` hoja de revisión de preguntas.

## Arquitectura (resumen)
- `engine/`: `core.ts` (azar con semilla, racionales, valores, lectura del teclado), `gens-basic.ts` (niveles 1-3), `gens-advanced.ts` (4-6), `index.ts` (armado del test 70 % nivel actual priorizando menor dominio + 30 % repaso de errores, etiquetas, reglas de estrellas).
- `data/`: `db.ts` (Dexie), `domain.ts` (día con hora de inicio, rachas/escudos calculados desde las sesiones, saldo = suma de apuntes, dominio, sugerencias), `repo.ts` (acciones; cada escritura va a la cola `outbox`), `pin.ts`.
- `sync/client.ts` + `server/sync-server.mjs`: sesiones, respuestas y apuntes son inmutables (unir, no sobrescribir); hijos/premios/ajustes por última modificación; canjes y correcciones solo vía `/api/redeem` con PIN; la primera subida de un dispositivo puede importar canjes antiguos.
- `i18n/<idioma>/content.json` (enunciados, palabras, habilidades, frases de error, pasos) y `ui.json`. Números con `Intl` según idioma.
- `ui/`: `kid/KidApp.tsx`, `parent/ParentApp.tsx`, `parent/Onboarding.tsx`, `visuals.tsx`, `Review.tsx`. El diseño se dibuja a 1024×680 (niño) o 390 de ancho (padre) y se escala.

## PENDIENTE (todo requiere personas, cuentas o dispositivos reales)
1. **Tú**: aprobar la app y que al menos un niño la pruebe (criterio de las fases 1 y 9).
2. **Tú**: revisar a mano 50 preguntas por nivel en `#/revision` (fase 3) y contrastar los niveles con el currículo de cada país.
3. **Nativos**: revisar EN/FR/DE (enunciados, explicaciones, símbolos × · ÷ :, HCF/PGCD/ggT).
4. **Fase 0**: repositorio en GitHub `mathzilo` y publicación. Sin dominio: GitHub Pages (solo tablet). Con móvil del padre: servidor Docker en la UE (con un subdominio gratuito de DuckDNS si no quieres comprar dominio). Pasos en `docs/lanzamiento-paso-a-paso.md`.
5. **Fase 9**: probar en un iPad/tablet y un móvil reales (instalación, sin conexión, tiempo real).
6. **Fase 10**: revisión legal del aviso de privacidad (RGPD, datos de menores).
7. **Fase 11**: piloto de 2 semanas siguiendo `docs/piloto.md` y sesión de ajustes.
8. Aplazado: foto del cuaderno (con un proveedor de IA que permita apps para menores), voz, otras materias.

## Notas
- La carpeta está en OneDrive: `node_modules` (~420 paquetes) se sincroniza. Si molesta, mueve `app/` fuera de OneDrive o excluye `node_modules`.
- El PIN de las pruebas automáticas y de la demo es 1234 (solo datos de prueba).
- El token de la tablet viaja en la URL del canal de tiempo real (EventSource no admite cabeceras); con HTTPS es aceptable para uso familiar.
