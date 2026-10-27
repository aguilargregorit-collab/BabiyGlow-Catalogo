# Babi & Glow — Catálogo público en tiempo real

Segunda aplicación Next.js que lee la tabla `public.products` de la app de inventario existente. No duplica el stock: los datos se comparten mediante Supabase.

## Funciones
- Catálogo público de productos, fotografía, precio, cantidad disponible y descripción.
- Galería de fotos por producto: deslizar en móvil, controles laterales, indicadores y lupa para abrir la imagen a pantalla ampliada.
- Búsqueda por nombre o características.
- Suscripción Supabase Realtime para INSERT, UPDATE y DELETE en `public.products`.
- Al detectar un producto nuevo muestra un aviso emergente dentro de la página (también en Android) y, si la persona concedió permiso, intenta mostrar una notificación del sistema mediante el service worker.
- Diseño responsive con identidad visual Babi&Glow: rosa, fucsia y crema, usando el mismo logo oficial en el encabezado, el pie y los iconos de la PWA.
- Configuración PWA para instalar como aplicación independiente desde Chrome Android: manifiesto, iconos y service worker.
- Sección pública de Términos y condiciones cargada desde `public.catalog_terms`, con suscripción Realtime para que cualquier cambio realizado desde el sistema de inventario se refleje sin recargar el catálogo.

## Configuración
1. En Supabase usa el mismo proyecto que utiliza el inventario principal.
2. Ejecuta `supabase/enable-realtime.sql` en Supabase → SQL Editor para los eventos en tiempo real de `products`.
3. Ejecuta también `supabase/terms-and-conditions.sql` en el mismo proyecto. Este crea la tabla única `catalog_terms`, carga unas condiciones iniciales editables, permite lectura pública, restringe la escritura a usuarios autenticados y activa Realtime.
4. Ejecuta `supabase/subcategories.sql` y `supabase/product-galleries.sql` para preparar el campo de subtipos y el almacenamiento de varias imágenes.
5. Crea un repositorio separado en GitHub y sube el contenido de esta carpeta.
6. Importa ese repositorio en Vercel como otro proyecto Next.js.
7. En Vercel → Settings → Environment Variables agrega:
   - `NEXT_PUBLIC_SUPABASE_URL` = la URL del proyecto Supabase.
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = la clave publicable `sb_publishable_...` (aunque el nombre heredado diga ANON_KEY) o la clave anon heredada compatible.
8. Despliega o vuelve a desplegar.

También puedes usar `cp .env.example .env.local` para desarrollo local. No subas `.env.local` a GitHub.

## Importante sobre notificaciones
- La sincronización de productos y los avisos emergentes internos funcionan mientras el catálogo está abierto y conectado a Internet. En Android, las notificaciones del sistema se emiten con `ServiceWorkerRegistration.showNotification()` y necesitan permiso concedido.
- Las notificaciones del navegador requieren que cada visitante pulse “Activar notificaciones” y permita los permisos. Los navegadores pueden restringir notificaciones según sus ajustes.
- Esta versión NO envía notificaciones push cuando la página está cerrada o el navegador está detenido. Para notificaciones automáticas en segundo plano hacen falta Web Push, claves VAPID, suscripciones guardadas y un servidor/función que envíe las notificaciones.

## Estructura de datos esperada
Usa la misma tabla que el inventario original: `products` con columnas `id`, `name`, `description`, `quantity`, `price`, `entry_date`, `image_url`, `image_urls`, `subcategory`, `created_at`. Los archivos SQL incluidos añaden `subcategory` e `image_urls` sin borrar los productos existentes.

## Comprobación de seguridad
El esquema de demo del inventario original permite lectura pública. Para un catálogo público, la lectura de productos puede ser pública, pero las operaciones de escritura deben quedar limitadas al inventario autenticado. Revisa las políticas RLS antes de usar con datos reales.


## Avisos de instalación y notificaciones
- La instalación ya no depende de una ventana automática: pulsa el botón con el icono de la app y la flecha de descarga que aparece junto a “Stock en vivo” y la campanita.
- Al pulsar el botón, se abre una ventana titulada “Instalar Aplicación” con las ventajas de usar Babi&Glow. Permite abrir el diálogo de instalación nativo cuando el navegador lo admite; si no, muestra instrucciones para añadir la web a la pantalla de inicio.
- Para probarlo, despliega esta versión y recarga el sitio. Si el navegador conserva una versión antigua, actualiza la página o borra los datos/caché de ese sitio.


## Corrección de ventanas emergentes para Android
- Los productos nuevos generan un popup visual dentro del catálogo, sin depender de los permisos de notificación del sistema.
- Las notificaciones de Android se solicitan mediante el service worker porque el constructor `new Notification()` no está disponible en la mayoría de navegadores móviles.
- La ventana de instalación se abre al pulsar el botón manual de la cabecera y muestra las ventajas de usar Babi&Glow como aplicación.
- Las ventanas modales limitan su altura al área visible del dispositivo y permiten desplazamiento en pantallas pequeñas.


## Términos y condiciones compartidos
- El catálogo consulta `public.catalog_terms` (registro con `id = 1`) y escucha sus cambios mediante Supabase Realtime.
- Los textos iniciales son ejemplos editables y deben ajustarse a las políticas reales de la tienda.
- La consulta pública solo tiene permiso de lectura. El SQL permite administrar los términos a usuarios autenticados; la futura modificación del sistema de inventario debe editar este registro con una sesión autorizada o con una función de servidor segura. No expongas una clave `service_role` en el frontend.
- Ejecuta `supabase/terms-and-conditions.sql` una sola vez por entorno de Supabase. Si vuelves a ejecutarlo, conserva el contenido actual gracias al `on conflict do nothing`.

## Cambios visuales de la fase 2
- Se quitó el botón de exploración del hero y se movió el logo al centro de la parte superior.
- Se reforzaron el peso tipográfico y el contraste de los textos para facilitar su lectura.


## Subtipos dinámicos (Bodys, Baggys, Vestidos, etc.)

- Ejecuta `supabase/subcategories.sql` en el mismo proyecto de Supabase que usa el inventario, antes de desplegar esta versión. El script añade `products.subcategory` y crea el registro central `catalog_subcategories`.
- Cuando un producto reciba una etiqueta en `products.subcategory`, un trigger la registra automáticamente en `catalog_subcategories`. No se crea una tabla de base de datos por cada etiqueta: cada subtipo es una categoría dinámica dentro de una sola tabla.
- El catálogo genera automáticamente un filtro por cada subtipo que aparece en los productos. Por ejemplo, al asignar `Bodys`, `Baggys` o `Vestidos` aparecerán esos filtros y las tarjetas mostrarán la etiqueta. Los cambios en la etiqueta se reflejan mediante el canal Realtime de `products`.
- La aplicación del inventario debe guardar la etiqueta en el campo `subcategory` de la fila del producto. Este ZIP deja preparada la base de datos y el catálogo; si el inventario actual todavía no ofrece ese campo en su formulario, habrá que actualizar esa aplicación para que pueda asignarlo.


## Galerías de imágenes por producto

- Ejecuta `supabase/product-galleries.sql` una sola vez en el SQL Editor del mismo proyecto de Supabase que usa el inventario. El script añade `products.image_urls` como arreglo de URLs y conserva el campo `image_url` actual como imagen principal heredada.
- El catálogo muestra `image_url` como portada y combina las URLs de `image_urls`, eliminando duplicados. Con varias fotos se puede deslizar en Android/iPhone, usar flechas o indicadores; la lupa abre la vista ampliada, que también permite cambiar de foto y cerrarse con Escape en escritorio.
- La columna admite URLs de imágenes ya almacenadas. Para gestionar la galería desde la pantalla del sistema de inventario, ese formulario deberá permitir guardar una lista de URLs en `image_urls` y mantener `image_url` como portada. Este ZIP actualiza el catálogo y el esquema de Supabase; no modifica la interfaz del inventario.
