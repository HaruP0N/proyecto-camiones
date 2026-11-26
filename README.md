# Petran Inspect — proyecto camiones

Aplicación Next.js para empresas, flotas e inspecciones. La base de datos es PostgreSQL en Supabase. Las fotos se guardan en un bucket privado de Supabase Storage y el inspector conserva su funcionamiento sin conexión mediante IndexedDB.

## Estado de la migración

El esquema inicial fue aplicado al proyecto Supabase `camiones` (`xkpgdhwcuuulnexszufw`) con la versión `20261126014852`. Antes de aplicarlo se verificó que `public` estaba vacío. Después se importaron los registros del respaldo PostgreSQL local suministrado por el usuario: 4 empresas, 4 proveedores, 2 camiones, 2 inspecciones y 2 usuarios. Se conservaron identificadores y hashes bcrypt; el respaldo y los datos privados no forman parte del repositorio.

El archivo `supabase/migrations/20261126014852_initial_schema.sql` corresponde a esa migración. La migración `20261126015403_preserve_local_backup_fields.sql` conserva los campos adicionales del respaldo. `20261126015629_provision_application_login.sql` crea el acceso limitado `petran_app` con una contraseña aleatoria guardada en Supabase Vault; requiere un proyecto Supabase alojado con Vault y pgcrypto disponibles. No ejecutarlo otra vez sobre ese proyecto. Para otra base nueva, aplicarlo una sola vez mediante las migraciones de Supabase. Si la base ya tiene tablas o datos, inspeccionarla primero con `scripts/db-introspect.sql` y preparar una migración incremental.

Tablas: `usuarios`, `empresas`, `proveedores`, `camiones`, `camion_fotos`, `inspecciones`, `detalle_inspeccion`, `fotos_inspeccion` y `notificaciones`.

Las relaciones son empresa → proveedores → camiones → inspecciones → detalles → fotos. Cada camión puede tener una sola inspección `PROGRAMADA` y cada ítem es único dentro de una inspección. Los estados generales son `PENDIENTE`, `APROBADO`, `OBSERVADO` y `RECHAZADO`; los estados del proceso son `PROGRAMADA`, `REALIZADA` y `CANCELADA`.

## Conexión de la aplicación

Requisitos: Node.js 22 o 24 LTS, un proyecto Supabase con el esquema aplicado y Supabase Storage para las fotografías.

1. Ejecutar `npm ci`.
2. Copiar `.env.example` a `.env.local` y completar sus valores sin subir ese archivo a GitHub.
3. En Supabase, abrir **Connect → Transaction pooler** y copiar el host, puerto y referencia exactos. Este modo está indicado para despliegues como Vercel. No se utilizan prepared statements con nombre.
4. Usar un usuario PostgreSQL exclusivo de la aplicación. La migración crea el grupo `petran_backend` con permisos de lectura, inserción y actualización, sin permisos de eliminación ni cambios de esquema. La migración de aprovisionamiento crea el usuario `petran_app` y le concede membresía en `petran_backend`. Su contraseña se genera en el servidor y se guarda cifrada en Vault con el nombre `petran_app_database_password`; solo administradores deben poder recuperarla. Nunca se incluye en las migraciones ni en Git.
5. Guardar la URL completa en `DATABASE_URL`, con el usuario `petran_app.<project-ref>` para el pooler y la contraseña codificada como componente de URL. Nunca usar `NEXT_PUBLIC_DATABASE_URL` ni publicar la URL en el navegador.
6. La conexión remota exige TLS con verificación del certificado. Si corresponde, guardar la CA PEM en `DATABASE_SSL_CA`; también se admiten saltos de línea representados por `\n`. No desactivar la verificación TLS.
7. Generar valores aleatorios distintos de al menos 32 bytes para `ADMIN_JWT_SECRET` y `CLIENTE_JWT_SECRET`.
8. Configurar `SUPABASE_URL` y `SUPABASE_SECRET_KEY` solo en servidor. Crear el bucket privado `petran-images`, límite 3 MB y tipos `image/jpeg`, `image/png`, `image/webp`. Dejar `NEXT_PUBLIC_API_BASE` vacío cuando la API y el sitio usan el mismo dominio.
9. Ejecutar `npm run db:check`, después `npm run dev`.

Documentación: [conexiones PostgreSQL de Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres), [roles y privilegios](https://supabase.com/docs/guides/database/postgres/roles).

## Primer administrador

En el proyecto actual ya se importaron el administrador y el inspector del respaldo, con los identificadores originales. Sus contraseñas se actualizaron durante la puesta en marcha a petición del usuario; no se publican en el repositorio. No es necesario volver a crear esos usuarios. Las empresas del respaldo no tenían PIN; el administrador puede configurarlo mediante la acción de restablecer PIN.

Solo para una instalación nueva sin usuarios: Definir temporalmente `SETUP_ADMIN_EMAIL` y `SETUP_ADMIN_PASSWORD` en `.env.local`; la contraseña debe tener al menos 12 caracteres. Ejecutar `npm run db:create-admin` y eliminar ambas variables después. El script guarda solamente el hash bcrypt y nunca reemplaza la contraseña de un usuario existente.

Después se pueden crear inspectores desde la interfaz de administración. Las empresas se registran con RUT y PIN desde el flujo de clientes o desde **Admin → Empresas → Nueva empresa**. El administrador puede editar datos y prioridades y abrir **Gestionar flota** para agregar camiones, modificarlos y subir sus fotos.

La autenticación sigue usando las sesiones firmadas de Next.js; esta migración no cambia los usuarios a Supabase Auth. El backend valida el rol y la empresa antes de ejecutar consultas. Las nueve tablas tienen RLS y una política para `petran_backend`; los roles de navegador `anon` y `authenticated` carecen de acceso a las tablas. Por eso no se necesita ninguna clave `service_role` en el frontend.

## Vercel

Configurar las variables privadas `DATABASE_URL`, `ADMIN_JWT_SECRET` y `CLIENTE_JWT_SECRET`, junto con `SUPABASE_URL` y `SUPABASE_SECRET_KEY`, en los entornos donde se desplegará la aplicación. Conectar Supabase al chat permite administrar su base; no configura automáticamente las variables de Vercel.

Aplicar primero las migraciones pendientes, comprobar la conexión y desplegar la rama que contiene la adaptación PostgreSQL. No publicar la versión anterior de Azure SQL apuntando a esta base: utiliza otro controlador y otro dialecto SQL.

## Acceso y agenda

`/login` es el único acceso de personal (pantalla blanca). Los accesos anteriores redirigen allí. Cada rol abre su panel correspondiente y el cierre de sesión vuelve al mismo formulario.

La agenda se valida por día en `America/Santiago`: hoy y días posteriores son válidos. Se aceptan fecha sola y hora local con o sin segundos. **Sin agenda** significa sin inspección programada activa; para cambiar una cita se usa **Reagendar** desde **Programadas** o **Vencidas**.

Las fotografías se suben como archivos reales al bucket privado, sin acceso público. `/api/media/...` verifica empresa o asignación del inspector antes de servirlas. El inspector conserva las evidencias en su cola local si falla una subida y reintenta después. La clave privada nunca se entrega al navegador.

## Verificaciones

- `npm run test:db`: pruebas de integración con PostgreSQL embebido (PGlite), sin credenciales ni servicios externos. Verifica la migración, sesiones, flota, agenda, revisión, notificaciones, aislamiento por empresa, transacciones, reintentos y permisos de roles.
- `npm run db:check`: comprueba la conexión real y las tablas y columnas requeridas; no modifica datos.
- `npm run build`: genera la versión de producción. La descarga de las fuentes de Google requiere acceso a Internet.
- `npx tsc --noEmit`: el repositorio ya contiene errores de tipos en `lib/inspector/camera.ts` y `lib/inspector/inspection-items.ts`. La configuración existente de Next.js omite esa comprobación al compilar; esos errores se mantienen separados de esta migración.

Los antiguos scripts de SQL Server están archivados en `scripts/legacy-azure/` únicamente como referencia. No ejecutarlos en Supabase. La importación inicial de datos se realizó por separado, en una transacción y sobre un destino vacío, conservando las claves y sus relaciones. Para otras bases, una migración de esquema no importa automáticamente sus registros.

Next.js se actualizó a 16.4.6 dentro de la misma versión principal para corregir vulnerabilidades de la versión anterior antes de desplegar.
