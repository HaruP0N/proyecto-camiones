-- Actualiza la base de datos para aceptar las categorías del frontend
ALTER TABLE dbo.detalle_inspeccion DROP CONSTRAINT IF EXISTS CK_detalle_categoria;

ALTER TABLE dbo.detalle_inspeccion ADD CONSTRAINT CK_detalle_categoria 
CHECK (categoria IN (
    'Frenos', 'Neumáticos y Ruedas', 'Chasis y Estructura', 'Acople / Quinta Rueda', 
    'Luces y Señalización', 'Documentación', 'Sistema de Fluidos', 'Suspensión', 
    'Cabina', 'Equipo de Seguridad', 'Sistema Eléctrico', 'Accesos', 
    'Estético / Confort', 'Sistema de Frío', 'Carrocería', 'Compartimientos', 'General'
));




-- =================================================================================
-- SCRIPT DE RESETEO TOTAL (Borrón y Cuenta Nueva)
-- =================================================================================

DECLARE @email_inspector NVARCHAR(100) = 'juako332@gmail.com'; 
DECLARE @patente_test NVARCHAR(20) = 'MOVIL-TEST'; -- O usa 'PLND45' si prefieres
DECLARE @inspector_id INT;
DECLARE @camion_id INT;

-- 1. Obtener tu ID de usuario
SELECT @inspector_id = id FROM dbo.usuarios WHERE email = @email_inspector;

-- 2. LIMPIEZA PROFUNDA: Borrar TODAS las inspecciones de este camión
--    (Así eliminamos las que dicen "Rechazado" o "Aprobado" que tú no hiciste)
DELETE FROM dbo.detalle_inspeccion 
WHERE camion_id IN (SELECT id FROM dbo.camiones WHERE patente = @patente_test);

DELETE FROM dbo.inspecciones 
WHERE camion_id IN (SELECT id FROM dbo.camiones WHERE patente = @patente_test);

-- 3. Asegurar que el camión existe (si no, falla)
SELECT TOP 1 @camion_id = id FROM dbo.camiones WHERE patente = @patente_test;

IF @camion_id IS NOT NULL
BEGIN
    -- 4. INSERTAR UNA ÚNICA INSPECCIÓN "VIRGEN" (Pendiente)
    --    Estado: PROGRAMADA (Para que el sistema te deje entrar)
    --    Resultado: PENDIENTE
    INSERT INTO dbo.inspecciones 
    (
        camion_id, 
        inspector_id, 
        fecha_programada, 
        fecha_inspeccion, -- Requerido por tu BD, usamos la misma fecha futura
        estado, 
        resultado_general
    )
    VALUES 
    (
        @camion_id, 
        @inspector_id, 
        CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'Pacific SA Standard Time' AS DATE), -- HOY
        CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'Pacific SA Standard Time' AS DATE), -- HOY
        'PROGRAMADA', 
        'PENDIENTE'
    );

    PRINT '✅ Historial borrado. Se creó una nueva inspección PENDIENTE para que la realices.';
END
ELSE
BEGIN
    PRINT '⚠️ No se encontró el camión ' + @patente_test + '. Créalo primero en Admin.';
END






-- Resetear PLND45 a estado inicial
UPDATE dbo.inspecciones
SET 
    estado = 'PROGRAMADA', 
    resultado_general = 'PENDIENTE',
    revision_admin = 'PENDIENTE', -- Limpiamos el estado de revisión
    nota_final = NULL,
    fecha_inspeccion = NULL
FROM dbo.inspecciones i
INNER JOIN dbo.camiones c ON c.id = i.camion_id
WHERE c.patente = 'PLND45';

-- Borrar respuestas anteriores para llenar de nuevo
DELETE FROM dbo.detalle_inspeccion 
WHERE camion_id IN (SELECT id FROM dbo.camiones WHERE patente = 'PLND45');





-- 1. Agregar columna para el estado de revisión (PENDIENTE, ACEPTADA, RECHAZADA)
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.inspecciones') AND name = 'revision_admin')
BEGIN
    ALTER TABLE dbo.inspecciones 
    ADD revision_admin NVARCHAR(50) DEFAULT 'PENDIENTE' WITH VALUES;
    PRINT '✅ Columna revision_admin agregada.';
END

-- 2. Agregar columna para los comentarios del admin (Por si acaso no la tienes)
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.inspecciones') AND name = 'comentario_admin')
BEGIN
    ALTER TABLE dbo.inspecciones 
    ADD comentario_admin NVARCHAR(MAX) NULL;
    PRINT '✅ Columna comentario_admin agregada.';
END











-- RESETEAR PLND45 PARA HACER LA INSPECCIÓN DE NUEVO
DECLARE @email_inspector NVARCHAR(100) = 'juako332@gmail.com'; 
DECLARE @patente_target NVARCHAR(20) = 'PLND45';

DECLARE @inspector_id INT;
SELECT @inspector_id = id FROM dbo.usuarios WHERE email = @email_inspector;

-- 1. Borrar respuestas previas
DELETE FROM dbo.detalle_inspeccion 
WHERE camion_id IN (SELECT id FROM dbo.camiones WHERE patente = @patente_target);

-- 2. Resetear la inspección
UPDATE dbo.inspecciones
SET 
    estado = 'PROGRAMADA',
    resultado_general = 'PENDIENTE',
    revision_admin = 'PENDIENTE', -- Ahora esta columna SÍ existe
    nota_final = NULL,
    fecha_inspeccion = fecha_programada, 
    inspector_id = @inspector_id
FROM dbo.inspecciones i
INNER JOIN dbo.camiones c ON c.id = i.camion_id
WHERE c.patente = @patente_target;

PRINT '✅ Inspección reseteada y lista para realizarse.';







-- 1. Quitar el candado (Constraint) para poder modificar la tabla
ALTER TABLE dbo.detalle_inspeccion DROP CONSTRAINT IF EXISTS CK_detalle_categoria;

-- 2. Agrandar la columna (De lo que tenga ahora a 100 caracteres)
ALTER TABLE dbo.detalle_inspeccion 
ALTER COLUMN categoria NVARCHAR(100);

-- 3. Volver a poner el candado con las categorías permitidas
ALTER TABLE dbo.detalle_inspeccion ADD CONSTRAINT CK_detalle_categoria 
CHECK (categoria IN (
    'Frenos', 
    'Neumáticos y Ruedas', 
    'Chasis y Estructura', 
    'Acople / Quinta Rueda', 
    'Luces y Señalización', 
    'Documentación', 
    'Sistema de Fluidos', 
    'Suspensión', 
    'Cabina', 
    'Equipo de Seguridad', 
    'Sistema Eléctrico', 
    'Accesos', 
    'Estético / Confort', 
    'Sistema de Frío', 
    'Carrocería', 
    'Compartimientos', 
    'General'
));

PRINT '✅ Columna categoria agrandada. Ahora cabe "Acople / Quinta Rueda".';