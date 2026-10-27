# Servidor de sincronización gratis: Oracle Cloud «Always Free» + DuckDNS

Resultado: `https://TU-NOMBRE.duckdns.org` con la app y la sincronización entre el móvil del padre y la tablet, para una o varias familias.
Tiempo: unos 60-90 minutos la primera vez.

La imagen `ghcr.io/rdt21-lab/mathzilo:latest` es pública y está compilada para x86 y Arm: no hace falta iniciar sesión en GitHub desde el servidor.

---

## Paso 4 · Crear el servidor

### 4.1 Cuenta de Oracle Cloud (15 min)
1. Entra en https://www.oracle.com/cloud/free/ → **Start for free**.
2. Rellena país, nombre y email, y verifica el email.
3. **Home Region**: elige una de la UE, por ejemplo **Germany Central (Frankfurt)**, **Netherlands Northwest (Amsterdam)** o **Spain Central (Madrid)**. No se puede cambiar después, y las máquinas gratuitas Arm solo se crean en esa región.
4. Verificación con tarjeta. Oracle hace una retención temporal para comprobar que es real. Mientras la cuenta siga como «Free Tier», no cobra.
5. Espera al correo de «cuenta lista» (de minutos a una hora) y entra en https://cloud.oracle.com.

### 4.2 Crear la máquina (15 min)
1. Menú ☰ → **Compute → Instances → Create instance**.
2. **Name**: `mathzilo`.
3. **Image and shape → Edit**:
   - **Change image** → **Canonical Ubuntu** → **24.04** → Select.
   - **Change shape** → **Ampere** → **VM.Standard.A1.Flex** → 1 OCPU y 6 GB de memoria. Debe salir la etiqueta «Always Free-eligible».
4. **Networking**: deja «Create new virtual cloud network» y «Assign a public IPv4 address» marcados.
5. **Add SSH keys** → **Generate a key pair for me** → **Save private key**. Guarda el archivo en `%USERPROFILE%\.ssh\mathzilo.key`; crea la carpeta `.ssh` si no existe.
6. **Create**. Si sale «Out of capacity», reinténtalo más tarde o con otro «availability domain»: pasa a menudo con las máquinas gratuitas. En regiones con una sola zona, como Madrid, puede durar días. Lo que lo resolvió en minutos fue pasar la cuenta a **Pay As You Go** (Billing → Upgrade and Manage Payment). Las máquinas «Always Free» siguen sin coste. Crea además un aviso de gasto de 1 € en **Billing → Budgets**.
7. Cuando el estado sea **RUNNING**, copia la **Public IP address**.

### 4.3 Abrir los puertos 80 y 443 en Oracle (5 min)
1. En la página de la instancia, pulsa el enlace de la **Subnet** → **Security Lists** → **Default Security List…** → **Add Ingress Rules**.
2. Source CIDR `0.0.0.0/0`, IP Protocol **TCP**, Destination Port Range `80,443` → **Add Ingress Rules**.

### 4.4 Nombre gratuito con DuckDNS (5 min)
1. Entra en https://www.duckdns.org e inicia sesión (por ejemplo, con GitHub).
2. En «sub domain» escribe un nombre, por ejemplo `mathzilo-rdt`, y pulsa **add domain**.
3. En «current ip» pega la IP pública de Oracle → **update ip**.
4. Tu dirección será `mathzilo-rdt.duckdns.org`.

### 4.5 Entrar en la máquina e instalar Docker (15 min)
En PowerShell, en tu PC:
```powershell
$key = "$env:USERPROFILE\.ssh\mathzilo.key"
icacls $key /inheritance:r
icacls $key /grant:r "$($env:USERNAME):(R)"
ssh -i $key ubuntu@IP_DE_ORACLE
```
La primera vez pregunta «Are you sure you want to continue connecting?» → escribe `yes`.

> Si la red del trabajo bloquea SSH, usa la **Cloud Shell** de Oracle: el icono `>_` arriba en la consola, sube el archivo `mathzilo.key` con su menú y ejecuta allí el mismo `ssh`.

Ya dentro (el indicador será `ubuntu@mathzilo:~$`):
```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu
N=$(sudo iptables -L INPUT --line-numbers -n | awk '/REJECT/{print $1; exit}')
sudo iptables -I INPUT $N -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo iptables -I INPUT $N -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo netfilter-persistent save
exit
```
Las líneas de `iptables` abren los puertos en el cortafuegos propio de Ubuntu en Oracle, que es distinto del del paso 4.3.

---

## Paso 5 · Poner Mathzilo en marcha

### 5.1 Copiar la configuración (2 min)
En PowerShell, en tu PC:
```powershell
scp -i "$env:USERPROFILE\.ssh\mathzilo.key" -r "C:\ruta\a\mathzilo\deploy" ubuntu@IP_DE_ORACLE:~/mathzilo
```

### 5.2 Configurar y arrancar (5 min)
```powershell
ssh -i "$env:USERPROFILE\.ssh\mathzilo.key" ubuntu@IP_DE_ORACLE
```
```bash
cd ~/mathzilo
printf 'DOMAIN=mathzilo-rdt.duckdns.org\nIMAGE=ghcr.io/rdt21-lab/mathzilo:latest\n' > .env
cat .env
docker compose up -d
docker compose ps
```
Cambia `mathzilo-rdt` por tu subdominio. `docker compose ps` debe mostrar **app**, **backup** y **caddy** en estado «running» o «Up».

### 5.3 Comprobar el HTTPS (2 min)
```bash
docker compose logs caddy --tail 30
```
Busca «certificate obtained successfully». Después abre `https://mathzilo-rdt.duckdns.org` en el navegador: debe salir Mathzilo con el candado.

### 5.4 Conectar las familias
- **Si ya usáis la app de GitHub Pages:** en el móvil del padre, **Modo padre → Ajustes → Nube y otros dispositivos** → escribe `https://mathzilo-rdt.duckdns.org` → email y contraseña → **Crear cuenta**. Luego **Vincular una tablet** y escribe el código en la tablet.
- **Si empezáis de cero:** abrid directamente `https://mathzilo-rdt.duckdns.org`; la dirección del servidor ya aparece rellenada.

Ojo: la app de GitHub Pages y la del servidor son direcciones distintas, y el navegador guarda los datos por separado en cada una. Usad siempre la misma en cada dispositivo, o pasad los datos con **Exportar** y **Restaurar una copia**.

---

## Si algo falla
| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| `ssh: connect … timed out` | La red bloquea SSH | Usar la Cloud Shell de Oracle |
| `Permission denied (publickey)` | Clave o usuario | El usuario es `ubuntu`; revisa la ruta de la clave |
| `UNPROTECTED PRIVATE KEY FILE` | Permisos de la clave en Windows | Repetir los dos `icacls` |
| La web no abre o el certificado falla | Puertos cerrados o DuckDNS sin IP | Revisar 4.3 y 4.5 (`iptables`) y que DuckDNS tenga la IP correcta |
| `permission denied … docker.sock` | No has vuelto a entrar tras `usermod` | `exit` y vuelve a entrar con `ssh` |

## Actualizar a una versión nueva
```bash
cd ~/mathzilo && docker compose pull && docker compose up -d
```
