# Mathzilo: lanzamiento paso a paso

Tiempo total: unas 2-3 horas repartidas en dos días, más las 2 semanas de piloto.
Coste: un servidor pequeño en la UE (unos pocos euros al mes) y un dominio (unos 10-15 € al año).

> **Antes de empezar.** Este portátil es corporativo y la carpeta está en OneDrive de la empresa.
> Si tu empresa no permite subir proyectos personales a GitHub desde él, haz los pasos 2 y 3 desde un ordenador personal.
> Basta con copiar la carpeta `starmath-fase1` **sin** `app/node_modules` ni `tools/`.

---

## Paso 0 · Decisiones (10 minutos)

1. **Nombre: Mathzilo.** Ya está aplicado en la app, el icono y el logotipo. Si algún día la abres a otras familias, conviene comprobar antes la marca en la EUIPO.
2. **Modalidad:**
   - **A · Solo tablet (sin servidor).** Todo vive en la tablet, el modo padre se abre en la tablet con PIN y no hay móvil del padre. Basta con publicar la web (paso 3-bis). Es lo más sencillo.
   - **B · Tablet + móvil del padre (recomendada).** Hace falta el servidor. Es lo que se describe del paso 1 al 9.
3. **Idioma.** Si en casa solo se usa español, no necesitas la revisión nativa de EN/FR/DE para lanzar.

---

## Paso 1 · Revisión rápida en local (30 minutos)

En PowerShell:
```powershell
cd "C:\ruta\a\mathzilo\app"
$env:PATH = "$PWD\..\tools\node-v24.22.0-win-x64;$env:PATH"
npm run dev
```
Abre http://localhost:5173 y:
1. Haz la bienvenida con datos de prueba (PIN, un hijo) y un test completo.
2. Abre http://localhost:5173/#/revision. Repasa 50 preguntas de los niveles que van a usar tus hijos. Toca una pregunta para ver sus explicaciones. Apunta cualquier error.
3. Para la app con `Ctrl + C`.

> Los datos de prueba se quedan en el navegador de este PC; no se suben a ningún sitio.

---

## Paso 2 · Cuenta de GitHub y repositorio (20 minutos)

1. Crea una cuenta en https://github.com si no la tienes.
2. Crea un repositorio nuevo: **New repository** → nombre `mathzilo` (en minúsculas) → **Private** → sin README → **Create**.
3. En PowerShell, en la carpeta del proyecto:
   ```powershell
   cd "C:\ruta\a\mathzilo"
   git init -b main
   git config user.name "Tu nombre"
   git config user.email "tu-email-de-github@ejemplo.com"
   git add .
   git status        # comprueba que NO aparecen app/node_modules ni tools/
   git commit -m "Mathzilo v0.9"
   git remote add origin https://github.com/TU_USUARIO/mathzilo.git
   git push -u origin main
   ```
   Git abre el navegador para que inicies sesión en GitHub la primera vez.
4. En GitHub, pestaña **Actions**, debe aparecer la ejecución «ci»:
   - El trabajo **check** pasa tipos, pruebas, compilación y pruebas de punta a punta (unos 10 minutos).
   - El trabajo **image** publica la imagen Docker en `ghcr.io/tu_usuario/mathzilo`.
   - El trabajo **deploy** se salta solo hasta que lo configures en el paso 7.
5. Si algo sale en rojo, abre el trabajo, copia el error y pásamelo.

## Paso 3 · Dominio (10 minutos + espera)

1. Compra un dominio en cualquier registrador (por ejemplo, Namecheap, OVH, IONOS o Gandi), o usa un subdominio de uno que ya tengas.
2. Aún no toques el DNS: necesitas la IP del servidor (paso 4).

### Paso 3-bis · Sin dominio ni servidor: GitHub Pages (modalidad A)
La app queda en `https://TU_USUARIO.github.io/mathzilo/`, con HTTPS gratis. Funciona sin conexión y se instala como app. No hay móvil del padre: el modo padre se abre en la tablet con el PIN y todo se guarda en la tablet.

1. **Repositorio público.** Con la cuenta gratuita, GitHub Pages solo publica repositorios públicos. El código no contiene datos ni secretos, y el PDF del plan (que lleva tu nombre) ya está excluido en `.gitignore`. Para cambiarlo: repositorio → **Settings → General → Danger zone → Change visibility → Public**.
2. **Activa Pages:** **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Haz un `git push` (o en **Actions → pages → Run workflow**). El flujo `pages` pasa las pruebas, compila y publica en unos 3 minutos. La dirección aparece en **Settings → Pages**.
4. Abre esa dirección en la tablet, haz la bienvenida e instala la app (paso 8, apartado «Tablet», sin vincular nada).
5. Haz **Exportar datos** cada semana: sin servidor, la única copia está en la tablet.

¿Prefieres que el código siga privado? **Cloudflare Pages** también es gratis y da una dirección `*.pages.dev` sin comprar dominio: Workers & Pages → Create → Pages → conecta el repositorio. Configura **Root directory** `app`, **Build command** `npm ci && npm run build` y **Output directory** `dist`.

¿Más adelante quieres el móvil del padre sin comprar dominio? Usa un servidor (paso 4) con un subdominio gratuito de **DuckDNS** (`tunombre.duckdns.org`) como `DOMAIN` en el paso 5. La app publicada en Pages se conecta a él escribiendo esa dirección en **Ajustes → Nube y otros dispositivos**.

---

## Servidor gratuito (sin pagar servidor ni dominio)

Hay dos formas, las dos con HTTPS gratis:

**Opción 1 · Oracle Cloud «Always Free» + DuckDNS (siempre encendido, en la UE).**
1. Crea una cuenta en Oracle Cloud y elige una región de la UE (Fráncfort, Ámsterdam, Madrid…). Piden tarjeta para verificar la identidad, pero los recursos «Always Free» no se cobran.
2. Crea una instancia **Ampere A1 (Arm) con Ubuntu 24.04** dentro del límite gratuito (con 1 OCPU y 6 GB sobra). En la red, abre los puertos 80 y 443.
3. En https://www.duckdns.org inicia sesión y crea un subdominio, por ejemplo `mathzilo-tufamilia.duckdns.org`, apuntando a la IP pública de la instancia.
4. Sigue los pasos 4 (desde «Entra al servidor e instala Docker») y 5 con `DOMAIN=mathzilo-tufamilia.duckdns.org`. La imagen Docker de GitHub está preparada para Arm y x86.
5. Avisos: Oracle puede recuperar instancias gratuitas que pasen una semana casi sin uso, y en 2026 se ha publicado que redujo el límite de la capa gratuita. Revisa su página de «Always Free» antes de empezar y mantén la copia semanal.

**Opción 2 · Un ordenador de casa (Raspberry Pi o PC viejo) + Tailscale Funnel.**
1. Instala Docker en ese equipo y arranca la app con el `docker-compose` de `deploy/`, quitando el servicio `caddy`. Expón el puerto 8787 del servicio `app`.
2. Instala Tailscale (plan personal gratuito) y publica el servicio con `tailscale funnel 8787`. Te da una dirección fija con HTTPS del tipo `https://equipo.tu-red.ts.net`.
3. Inconveniente: ese equipo tiene que estar siempre encendido. Si se apaga, la tablet sigue funcionando sin conexión y sincroniza cuando vuelva.

En los dos casos, la app publicada en GitHub Pages se conecta a ese servidor escribiendo su dirección en **Ajustes → Nube y otros dispositivos**.

## Paso 4 · Servidor en la UE (30 minutos)

1. Contrata un servidor virtual pequeño en un centro de datos de la UE. Por ejemplo, Hetzner Cloud en Alemania o Finlandia, OVHcloud en Francia o Scaleway en Francia.
   - Sistema: **Ubuntu 24.04**.
   - Tamaño: el más pequeño (1-2 CPU, 2 GB de RAM) sobra.
   - Al crearlo, añade tu **clave SSH**. Si no tienes una, créala en tu PC con `ssh-keygen -t ed25519` y pega el contenido de `C:\Users\TU_USUARIO\.ssh\id_ed25519.pub`.
2. Apunta la **IP pública** del servidor.
3. En el registrador del dominio, crea un registro **A** con nombre `@` (o el subdominio, por ejemplo `mates`) y valor la IP del servidor. Espera a que propague (de minutos a una hora). Compruébalo con `nslookup mates.tudominio.es`.
4. Entra al servidor e instala Docker:
   ```bash
   ssh root@IP_DEL_SERVIDOR
   adduser mathzilo                   # elige una contraseña
   usermod -aG sudo mathzilo
   curl -fsSL https://get.docker.com | sh
   usermod -aG docker mathzilo
   mkdir -p /home/mathzilo/.ssh && cp ~/.ssh/authorized_keys /home/mathzilo/.ssh/ && chown -R mathzilo:mathzilo /home/mathzilo/.ssh
   exit
   ```
5. Si el proveedor tiene cortafuegos, abre solo los puertos **22, 80 y 443**.

## Paso 5 · Poner Mathzilo en marcha en el servidor (20 minutos)

1. Desde tu PC, copia la carpeta `deploy` al servidor:
   ```powershell
   scp -r "C:\ruta\a\mathzilo\deploy" mathzilo@IP_DEL_SERVIDOR:~/mathzilo
   ```
2. En GitHub, crea un token para descargar la imagen privada: foto de perfil → **Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token**. Marca solo **read:packages** y copia el token.
3. En el servidor:
   ```bash
   ssh mathzilo@IP_DEL_SERVIDOR
   cd ~/mathzilo
   nano .env
   ```
   Escribe (con tu dominio y tu usuario en minúsculas) y guarda con `Ctrl + O`, `Enter`, `Ctrl + X`:
   ```
   DOMAIN=mates.tudominio.es
   IMAGE=ghcr.io/tu_usuario/mathzilo:latest
   ```
   Después:
   ```bash
   echo "EL_TOKEN" | docker login ghcr.io -u TU_USUARIO --password-stdin
   docker compose up -d
   docker compose ps                 # app, backup y caddy en «running»
   docker compose logs caddy | tail  # debe decir que obtuvo el certificado
   ```
4. Abre `https://mates.tudominio.es` en el navegador: debe salir la bienvenida de Mathzilo con el candado de HTTPS.

## Paso 6 · Comprobar copias y errores (5 minutos)

```bash
ls ~/mathzilo/backups                     # aparece una carpeta con la fecha (copia diaria)
docker compose logs backup | tail -3
```
El registro de errores técnicos (sin datos personales) está dentro del volumen de datos:
```bash
docker compose exec app sh -c "tail -n 20 /data/errors.log 2>/dev/null || echo sin errores"
```

## Paso 7 · Despliegue automático (opcional, 10 minutos)

Para que cada cambio que subas a GitHub se instale solo en el servidor:
1. En tu PC, crea una clave solo para el despliegue: `ssh-keygen -t ed25519 -f "$HOME\.ssh\mathzilo_deploy" -N '""'`.
2. Añade la clave pública al servidor:
   ```powershell
   type "$HOME\.ssh\mathzilo_deploy.pub" | ssh mathzilo@IP_DEL_SERVIDOR "cat >> ~/.ssh/authorized_keys"
   ```
3. En GitHub → repositorio → **Settings → Secrets and variables → Actions → New repository secret**, crea:
   - `DEPLOY_HOST` = IP del servidor
   - `DEPLOY_USER` = `mathzilo`
   - `DEPLOY_KEY` = todo el contenido de `mathzilo_deploy` (la clave privada, sin `.pub`)
4. En el siguiente `git push`, el trabajo **deploy** actualizará el servidor.

---

## Paso 8 · Instalar en el móvil y en la tablet (20 minutos)

### Móvil del adulto
1. Abre `https://mates.tudominio.es`.
2. Bienvenida: idioma → acepta el aviso de privacidad → crea el **PIN** (de 4 a 6 cifras; no lo olvides) → añade a tus hijos con nivel y mascota → **Empezar**.
3. **Modo padre** (abajo a la derecha) → PIN → **Ajustes → Nube y otros dispositivos**. La dirección del servidor ya viene puesta. Escribe tu email y una contraseña de al menos 8 caracteres → **Crear cuenta**.
4. **Ajustes → Instalar la app**: sigue los pasos que muestra (Android: menú ⋮ → «Instalar app»; iPhone: Compartir → «Añadir a pantalla de inicio»). Pulsa **Proteger los datos**.
5. Añade los premios: **Ajustes → Premios**. Apunta en **Equivalencia** lo que vale una estrella (solo lo ves tú).

### Tablet del niño
1. En el móvil: **Ajustes → Vincular una tablet**. Aparece un código de 6 cifras (dura 10 minutos).
2. En la tablet, abre `https://mates.tudominio.es` → **¿Ya tienes cuenta? Vincula este dispositivo** → **Tablet del niño** → escribe el código → **Vincular**.
3. Instala la app en la tablet. En iPad: Safari → Compartir → «Añadir a pantalla de inicio». Es importante, porque Safari borra los datos de las webs no instaladas que no se usan.
4. Ábrela siempre desde el icono nuevo.
5. Opcional en iPad: **Ajustes → Accesibilidad → Acceso guiado** para que el niño no salga de la app.

## Paso 9 · Prueba de humo con los dispositivos reales (15 minutos)

Marca cada punto:
- [ ] En la tablet, un hijo hace un test de 10 preguntas y gana estrellas.
- [ ] En el móvil, el panel muestra esas estrellas en unos segundos.
- [ ] Pon la tablet en **modo avión**, haz otro test (práctica, sin estrellas) y quita el modo avión: todo se sincroniza.
- [ ] Desde el móvil, canjea un premio pequeño con el PIN. En la tablet, el saldo baja solo.
- [ ] Cierra la app de la tablet en mitad de un test y ábrela: puedes continuarlo.
- [ ] Prueba un PIN incorrecto: avisa de los intentos que quedan.

Si algo falla, anota qué hacías y en qué dispositivo, y mira el paso 6 (errores).

---

## Paso 10 · Piloto de 2 semanas y ajustes

Sigue `docs/piloto.md`:
- Un test al día, sin ayuda. Las observaciones van en **Panel → Resumen del piloto → Notas del piloto**.
- El día 14, exporta los datos (**Ajustes → Datos y privacidad → Exportar datos**) y revisa el resumen del piloto: días con test, aprobados, estrellas al mes frente al premio más caro y explicaciones marcadas como «No lo entiendo».
- Ajusta bonus, precios y niveles. Pásame los textos confusos y los fallos para corregirlos.

## Mantenimiento

| Cuándo | Qué |
|---|---|
| Cada semana | Exportar los datos (el panel lo recuerda). |
| Cada mes | En el servidor: `sudo apt update && sudo apt upgrade -y`, luego `cd ~/mathzilo && docker compose pull && docker compose up -d`. |
| Tras actualizar iOS o Android | Abrir la app y hacer un test de prueba. |
| Si un día abres la app a otras familias | Cambia el nombre, que un profesional revise el aviso de privacidad (RGPD, datos de menores) y pide la revisión nativa de los idiomas que vayas a usar. |

### Restaurar una copia de seguridad
```bash
cd ~/mathzilo
docker compose stop app
docker compose run --rm --user root -v "$PWD/backups:/backups" app node server/backup.mjs --restore /backups/AAAA-MM-DD_HHMM
docker compose start app
```
