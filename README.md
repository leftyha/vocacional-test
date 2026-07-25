# Brújula Vocacional — frontend estático

La aplicación funciona sin backend. Las preguntas, carreras y reglas están en `data/` y el cálculo se realiza completamente en el navegador.

## Requisitos para compilar

- Node.js 20.11 o superior.
- npm.

Instala las dependencias una sola vez:

```bash
npm install
```

## Desarrollo

```bash
npm run dev
```

El servidor escucha en `0.0.0.0` y muestra las direcciones disponibles para este equipo y para la red LAN.

También se conserva el servidor Python:

```bash
python server.py
```

## Validar la información

```bash
npm run validate
```

La validación comprueba, entre otras cosas:

- IDs y nombres de carreras duplicados.
- Cantidad de carreras declarada en el manifiesto.
- Familias y clústeres profesionales.
- Aptitudes, valores y restricciones desconocidas.
- Especializaciones repetidas o insuficientes.
- Preguntas, opciones y referencias inválidas.

El build se detiene cuando encuentra errores en los datos.

## Crear el build

```bash
npm run build
```

La salida queda en:

```text
dist/
├── index.html
├── assets/
├── data/
└── build-info.json
```

El proceso:

- valida el catálogo y el cuestionario;
- minifica HTML, CSS y JavaScript;
- incorpora Anime.js localmente;
- genera nombres de assets con hash;
- copia y compacta todos los JSON;
- crea una distribución estática lista para desplegar.

## Probar el build

```bash
npm run preview
```

Después abre la dirección mostrada en la terminal. Desde otros dispositivos de la misma red utiliza la dirección LAN.

## Generar un ZIP distribuible

```bash
npm run package
```

El archivo se genera en:

```text
artifacts/brujula-vocacional-2.4.0.zip
```

El ZIP contiene únicamente la aplicación compilada y puede subirse directamente a Vercel, Netlify, Cloudflare Pages, GitHub Pages, Nginx, Apache o cualquier hosting estático.

## Comprobación completa

```bash
npm run check
```

Ejecuta la validación y el build en una sola operación.

## Puerto alternativo

```bash
npm run dev -- --port 8080
npm run preview -- --port 8080
```

## Firewall de Windows

La primera vez, Windows puede solicitar permiso para Node.js o Python. Marca **Redes privadas** y pulsa **Permitir acceso**.

Si no aparece el aviso, ejecuta PowerShell como administrador:

```powershell
New-NetFirewallRule -DisplayName "Brujula Vocacional 4173" -Direction Inbound -Protocol TCP -LocalPort 4173 -Action Allow -Profile Private
```

## Requisitos de conexión LAN

- Todos los dispositivos deben estar en la misma red Wi-Fi o LAN.
- La red no debe tener activado aislamiento de clientes o AP isolation.
- No uses `127.0.0.1` ni `localhost` desde otro dispositivo.
- Mantén abierta la terminal mientras se usa el servidor.

La publicación LAN no expone automáticamente la aplicación a Internet.
