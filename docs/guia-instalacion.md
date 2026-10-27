# Mathzilo: guía de instalación para la familia

Son dos partes: **poner el servidor en marcha** (una sola vez, la hace quien gestiona la app) e **instalar la app** en la tablet del niño y en el móvil del adulto.

> Sin servidor, Mathzilo también funciona: todo se guarda en un único dispositivo. El servidor solo hace falta para que el móvil del adulto y la tablet compartan estrellas y canjes.

---

## 1. Servidor (una vez)

Hace falta un servidor con Docker en la UE (cualquier VPS pequeño vale: 1 CPU y 1 GB de RAM sobran para varias familias) y un dominio que apunte a él (por ejemplo, `mates.mifamilia.es`).

1. Copia la carpeta `deploy/` del proyecto al servidor como `~/mathzilo`.
2. Crea `~/mathzilo/.env` con:
   ```
   DOMAIN=mates.mifamilia.es
   IMAGE=ghcr.io/USUARIO/REPOSITORIO:latest
   ```
   (La imagen la publica sola la integración continua de GitHub en cada cambio de la rama `main`. Sin GitHub, también puedes construirla en el servidor con `docker build -t mathzilo .` desde la raíz del proyecto y poner `IMAGE=mathzilo`.)
3. Arranca: `docker compose up -d`. Caddy pide el certificado HTTPS solo, en un minuto.
4. Comprueba que `https://mates.mifamilia.es` abre la app.

Qué queda en marcha:
- **app**: la PWA y el servidor de sincronización (datos en el volumen `data`).
- **backup**: una copia diaria de los datos en `~/mathzilo/backups/` (se guardan 30). Para restaurar: `docker compose stop app`, luego `docker compose run --rm --user root -v "$PWD/backups:/backups" app node server/backup.mjs --restore /backups/AAAA-MM-DD_HHMM` y `docker compose start app`.
- **caddy**: HTTPS automático.

Errores: la app envía al servidor los errores técnicos **sin datos personales** (solo mensaje, pila y versión). Se guardan en el volumen de datos, en `errors.log`.

Despliegue automático (opcional): en GitHub, añade los secretos `DEPLOY_HOST`, `DEPLOY_USER` y `DEPLOY_KEY` (clave SSH). Cada cambio en `main` se publica solo.

---

## 2. Móvil del adulto

1. Abre `https://mates.mifamilia.es` en el móvil.
2. Primera vez: elige el idioma, acepta el aviso de privacidad, crea un **PIN** de 4 a 6 cifras y añade a los hijos (solo nombre o alias, nivel y mascota).
3. Entra en **Modo padre → Ajustes → Nube y otros dispositivos**: escribe tu email y una contraseña y pulsa **Crear cuenta**. Se suben los datos.
4. **Instala la app** (Ajustes → Instalar la app explica los pasos de tu móvil):
   - Android (Chrome): menú ⋮ → «Instalar app».
   - iPhone (Safari): Compartir → «Añadir a pantalla de inicio».
5. Pulsa **Proteger los datos** en la misma sección.
6. Para recibir un aviso cuando un hijo marque una tarea como hecha: **Ajustes → Nube y otros dispositivos → Activar avisos** y acepta el permiso. Pulsa **Probar** para comprobarlo. En iPhone, primero instala la app (paso 4) y ábrela desde el icono.

## 3. Tablet del niño

1. En el móvil: Modo padre → Ajustes → **Vincular una tablet**. Aparece un código de 6 cifras (dura 10 minutos).
2. En la tablet, abre `https://mates.mifamilia.es` y pulsa **¿Ya tienes cuenta? Vincula este dispositivo** → Tablet del niño → escribe el código.
3. Instala la app:
   - iPad (Safari): Compartir → «Añadir a pantalla de inicio». Importante: Safari puede borrar los datos de las webs que no se usan; instalada no pasa.
   - Tablet Android (Chrome): menú ⋮ → «Instalar app».
4. Opcional en iPad: **Acceso guiado** (Ajustes → Accesibilidad → Acceso guiado) para que el niño no salga de la app. Se activa con tres pulsaciones del botón lateral.
5. En la tablet también se puede entrar al modo padre (botón «Modo padre» abajo a la derecha) con el mismo PIN.

## 4. Día a día

- El niño elige su perfil, pulsa **Empezar** y hace el test (10, 15 o 20 preguntas). Solo el primer test del día da estrellas.
- **Tareas**: Modo padre → **Tareas** → elige hijo → **+ Añadir tarea** (nombre, estrellas, que pueden llevar un decimal como 1,5, y los días de la semana o un día concreto). En **Premios por cumplir tareas** se dan estrellas extra por hacerlas todas o un grupo. En **Días con tareas** se desconectan días enteros, como el fin de semana.
- El niño ve sus tareas en el botón **Tareas** de su pantalla y pulsa **¡Ya la he hecho!**. Al adulto le llega el aviso y la ve en el panel, en **Tareas por revisar**: **Sí, está hecha** suma las estrellas; **Aún no** se la devuelve al niño para que lo intente de nuevo.
- **Dificultad**: en el panel, toca la tarjeta del hijo → **Dificultad** muestra sus últimos tests en el nivel actual; tú decides si sube o baja.
- Para canjear un premio: Modo padre → **Canjear** → elegir hijo y premio → confirmar con el PIN. Necesita conexión, porque el servidor comprueba el PIN.
- Cada semana conviene **Exportar datos** (Ajustes → Datos y privacidad). El panel lo recuerda.
- ¿Has olvidado el PIN? En la pantalla del PIN, «¿Has olvidado el PIN?»: con el email y la contraseña de la cuenta se crea uno nuevo.

## 5. Si algo falla

| Problema | Qué hacer |
|---|---|
| La tablet no ve un canje | Comprueba la conexión. Se sincroniza sola en segundos al volver. En el panel, el indicador de nube muestra el estado. |
| «Canjear necesita conexión» | El móvil está sin conexión: espera a tenerla. |
| Saldo negativo con aviso | Dos dispositivos canjearon sin conexión a la vez. No se borra nada: corrige con «Corregir» en el historial. |
| Pantalla de «¡Uy! Algo no ha ido bien» | Pulsa «Volver a empezar». Los datos están a salvo. El error queda registrado sin datos personales. |
| Aparece «Nueva versión: actualizar» | Púlsalo en la pantalla de perfiles (nunca interrumpe un test). |
