# WiFi Surcante — portal de pago

Esta versión del portal de pago ya está conectada de verdad con
Mercado Pago (Checkout Pro): cuando un pasajero elige un plan y paga,
el dinero se cobra de verdad en tu cuenta. Lo único que todavía falta
conectar es la autorización automática del acceso en el controlador
Omada (ver la sección "Qué falta para el flujo completo").

## Cómo correrlo en tu computadora

Necesitás tener instalado Node.js (versión 18 o más nueva). Si no lo
tenés, descargalo de https://nodejs.org (elegí la versión "LTS").

1. Descomprimí este zip en una carpeta.
2. Abrí una terminal (en Windows: "Símbolo del sistema" o "PowerShell";
   en Mac: "Terminal") y entrá a esa carpeta:
   ```
   cd ruta/a/la/carpeta/surcante-wifi
   ```
3. Instalá las dependencias (esto se hace una sola vez):
   ```
   npm install
   ```
4. Creá un archivo `.env.local` (junto a `package.json`) con estas
   tres líneas, completando con tus propios valores:
   ```
   CLAVE_ADMIN=elegí-una-clave-para-el-panel-admin
   MERCADOPAGO_ACCESS_TOKEN=tu-access-token-de-mercado-pago
   MERCADOPAGO_PUBLIC_KEY=tu-public-key-de-mercado-pago
   ```
5. Iniciá el servidor de prueba:
   ```
   npm run dev
   ```
6. Abrí el navegador en http://localhost:3000

IMPORTANTE: si usás las credenciales de PRODUCCIÓN de Mercado Pago
(no las de prueba) en tu computadora local, un pago de prueba va a
cobrar dinero real. Para probar sin gastar plata real, generá
credenciales de prueba desde el panel de Mercado Pago Developers
(sección "Credenciales de prueba") y usá esas en tu `.env.local`.

## Panel de códigos de acceso libre (para vos, no para choferes)

Hay una segunda página, `/admin`, protegida con contraseña, donde
generás códigos de acceso gratuito e ilimitado para una sola persona
o equipo (por ejemplo personal de la empresa). Cada código solo puede
usarse en UN dispositivo: una vez canjeado, queda atado a ese celular
y no funciona en otro.

Para probarla en tu computadora, con el servidor corriendo
(`npm run dev`), entrá a http://localhost:3000/admin e ingresá la
clave que pusiste en `CLAVE_ADMIN`.

IMPORTANTE: por ahora los códigos (y los pagos pendientes) se guardan
en la memoria del servidor, no en una base de datos. Esto significa
que si reiniciás el servidor (o hacés un redeploy en Vercel), la
lista se borra. Para el piloto con pocos códigos esto es manejable,
pero antes de depender de esto en serio conviene migrar a una base
de datos real (por ejemplo Vercel KV o Postgres).

## Qué falta para el flujo completo

El cobro con Mercado Pago ya funciona de punta a punta: se crea la
preferencia de pago, el pasajero paga en Mercado Pago, y tu sitio
recibe la confirmación por webhook. Lo que falta es el último paso:

1. Conectar la API del controlador Omada para que, cuando el webhook
   confirme un pago, se autorice automáticamente al dispositivo
   (identificado por su MAC) por la cantidad exacta de minutos del
   plan comprado. Este punto está marcado con comentarios "ACA VA
   OMADA" en `app/api/webhook-pago/route.ts` y
   `app/api/canjear-codigo/route.ts`.
2. Migrar el almacenamiento en memoria (`lib/codigos.ts` y
   `lib/pagos.ts`) a una base de datos persistente antes de confiar
   en esto para operación real con muchos buses.

## Estructura del proyecto

- `app/page.tsx` — la pantalla principal que ve el pasajero
- `app/pagado/page.tsx` — la pantalla de éxito después de pagar
- `app/error/page.tsx` — la pantalla de error
- `app/admin/page.tsx` — panel para generar códigos de acceso libre
- `app/api/crear-pago/route.ts` — crea la preferencia real en Mercado Pago
- `app/api/webhook-pago/route.ts` — recibe la confirmación de pago (falta Omada)
- `app/api/canjear-codigo/route.ts` — valida códigos de acceso libre (falta Omada)
- `app/api/admin-codigos/route.ts` — genera y lista códigos (protegido por CLAVE_ADMIN)
- `lib/planes.ts` — ACÁ se editan los precios y nombres de los planes
- `lib/codigos.ts` — almacenamiento en memoria de los códigos de acceso libre
- `lib/pagos.ts` — almacenamiento en memoria de los pagos pendientes/confirmados
