# Brújula Vocacional — frontend estático

La aplicación funciona sin backend. Las preguntas, carreras y reglas están en `data/` y el cálculo se realiza en el navegador.

## Ejecutar para toda la red LAN

Desde esta carpeta:

```bash
python server.py
```

El servidor escucha en todas las interfaces de red (`0.0.0.0`) y mostrará dos direcciones:

- `http://127.0.0.1:4173` para este equipo.
- `http://IP-LAN-DE-TU-PC:4173` para móviles, tablets y otros ordenadores conectados a la misma red.

Ejemplo:

```text
En la red LAN: http://192.168.1.25:4173
```

Abre exactamente esa dirección en el otro dispositivo.

## Puerto alternativo

```bash
python server.py --port 8080
```

## Host personalizado

El valor predeterminado es `0.0.0.0`. También puede indicarse explícitamente:

```bash
python server.py --host 0.0.0.0 --port 4173
```

## Firewall de Windows

La primera vez, Windows puede solicitar permiso para Python. Marca **Redes privadas** y pulsa **Permitir acceso**.

Si no aparece el aviso, ejecuta PowerShell como administrador:

```powershell
New-NetFirewallRule -DisplayName "Brujula Vocacional 4173" -Direction Inbound -Protocol TCP -LocalPort 4173 -Action Allow -Profile Private
```

## Requisitos de conexión

- Todos los dispositivos deben estar en la misma red Wi-Fi o LAN.
- La red no debe tener activado aislamiento de clientes o AP isolation.
- No uses `127.0.0.1` ni `localhost` desde otro dispositivo.
- Mantén abierta la terminal mientras se usa la aplicación.

Esto expone la aplicación solamente en la red local. No la publica automáticamente en Internet.
