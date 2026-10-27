# Bienvenida del calendario en el catálogo

El catálogo consulta la tabla compartida `public.calendar_events` en Supabase y muestra una bienvenida animada cuando hay un evento activo en la fecha local del visitante. La bienvenida se puede cerrar y no se repite durante esa sesión para el mismo evento.

Ejecuta el SQL `supabase-calendar-events.sql` del paquete del catálogo (o `supabase/calendar-events.sql` del paquete del inventario) en el mismo proyecto Supabase que ya usan las dos aplicaciones. Después despliega ambas aplicaciones.

Los eventos y sus mensajes se administran desde la sección Calendario del inventario. La bienvenida usa los temas confeti, Navidad, Halloween, corazones y brillos.
