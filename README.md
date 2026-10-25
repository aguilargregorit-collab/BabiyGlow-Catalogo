# Babi & Glow — Catálogo público en tiempo real

Segunda aplicación Next.js que lee la tabla `public.products` de la app de inventario existente. No duplica el stock: los datos se comparten mediante Supabase.

## Funciones
- Catálogo público de productos, fotografía, precio, cantidad disponible y descripción.
- Búsqueda por nombre o características.
- Suscripción Supabase Realtime para INSERT, UPDATE y DELETE en `public.products`.
- Al detectar un producto nuevo muestra una notificación dentro de la página y, si la persona concedió permiso al navegador, una notificación del navegador.
- Diseño responsive con identidad visual Babi&Glow: rosa, fucsia y crema, usando el mismo logo oficial en el encabezado, el pie y los iconos de la PWA.
- Configuración PWA para instalar como aplicación independiente desde Chrome Android: manifiesto, iconos y service worker.

## Configuración
1. En Supabase usa el mismo proyecto que utiliza el inventario principal.
2. Ejecuta `supabase/enable-realtime.sql` en Supabase → SQL Editor. Esto activa los eventos en tiempo real de la tabla `products`.
3. Crea un repositorio separado en GitHub y sube el contenido de esta carpeta.
4. Importa ese repositorio en Vercel como otro proyecto Next.js.
5. En Vercel → Settings → Environment Variables agrega:
   - `NEXT_PUBLIC_SUPABASE_URL` = la URL del proyecto Supabase.
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = la clave publicable `sb_publishable_...` (aunque el nombre heredado diga ANON_KEY) o la clave anon heredada compatible.
6. Despliega o vuelve a desplegar.

También puedes usar `cp .env.example .env.local` para desarrollo local. No subas `.env.local` a GitHub.

## Importante sobre notificaciones
- La sincronización de productos funciona en vivo mientras el catálogo está abierto y conectado a Internet.
- Las notificaciones del navegador requieren que cada visitante pulse “Activar notificaciones” y permita los permisos. Los navegadores pueden restringir notificaciones según sus ajustes.
- Esta versión NO envía notificaciones push si la página está cerrada o el navegador está detenido. El service worker incluido sirve para la instalación y caché limitada de recursos estáticos, no para enviar notificaciones por sí solo. Para notificaciones en segundo plano hace falta implementar Web Push con claves VAPID, suscripciones guardadas y un servidor/función que envíe las notificaciones.

## Estructura de datos esperada
Usa la misma tabla que el inventario original: `products` con columnas `id`, `name`, `description`, `quantity`, `price`, `entry_date`, `image_url`, `created_at`.

## Comprobación de seguridad
El esquema de demo del inventario original permite lectura pública. Para un catálogo público, la lectura de productos puede ser pública, pero las operaciones de escritura deben quedar limitadas al inventario autenticado. Revisa las políticas RLS antes de usar con datos reales.
