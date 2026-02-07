-- =========================================================
-- RESETEAR PLND45 PARA HACER LA INSPECCIÓN DE NUEVO
-- =========================================================

DECLARE @email_inspector NVARCHAR(100) = 'juako332@gmail.com'; 
DECLARE @patente_target NVARCHAR(20) = 'PLND45';

DECLARE @inspector_id INT;
SELECT @inspector_id = id FROM dbo.usuarios WHERE email = @email_inspector;

-- 1. Borrar detalles previos (las respuestas de la inspección anterior)
DELETE FROM dbo.detalle_inspeccion 
WHERE camion_id IN (SELECT id FROM dbo.camiones WHERE patente = @patente_target);

-- 2. Resetear el estado de la inspección a PROGRAMADA / PENDIENTE
UPDATE dbo.inspecciones
SET 
    estado = 'PROGRAMADA',
    resultado_general = 'PENDIENTE',
    nota_final = NULL,
    -- Mantenemos la fecha de inspección igual a la programada para cumplir el NOT NULL, 
    -- pero el estado 'PROGRAMADA' es lo que habilita el botón.
    fecha_inspeccion = fecha_programada, 
    inspector_id = @inspector_id -- Aseguramos que esté asignada a ti
FROM dbo.inspecciones i
INNER JOIN dbo.camiones c ON c.id = i.camion_id
WHERE c.patente = @patente_target;

PRINT '✅ Inspección reseteada. Ahora debería aparecer como PENDIENTE en tu dashboard.';




-- 1. Eliminar la restricción antigua de la columna 'resultado'
ALTER TABLE dbo.detalle_inspeccion DROP CONSTRAINT IF EXISTS CK_detalle_resultado;

-- 2. Crear la nueva restricción permitiendo los valores exactos de tu App
ALTER TABLE dbo.detalle_inspeccion ADD CONSTRAINT CK_detalle_resultado 
CHECK (resultado IN ('cumple', 'no_cumple', 'no_aplica'));










-- 1. Quitar el bloqueo temporalmente
ALTER TABLE dbo.detalle_inspeccion DROP CONSTRAINT IF EXISTS CK_detalle_categoria;

-- 2. AGRANDAR la columna (La solución real)
ALTER TABLE dbo.detalle_inspeccion 
ALTER COLUMN categoria NVARCHAR(100);

-- 3. Volver a poner el bloqueo de seguridad
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

PRINT '✅ Columna categoria agrandada correctamente.';


















-- =================================================================================
-- SCRIPT DE REPARACIÓN ESPECÍFICA PARA CAMIÓN ID 3
-- =================================================================================

DECLARE @email_inspector NVARCHAR(100) = 'juako332@gmail.com'; 
DECLARE @camion_target_id INT = 3; -- El ID que sale en tu URL de error

-- 1. Obtener tu ID de usuario
DECLARE @inspector_id INT;
SELECT @inspector_id = id FROM dbo.usuarios WHERE email = @email_inspector;

IF @inspector_id IS NULL
BEGIN
    PRINT '❌ ERROR: No se encontró el usuario ' + @email_inspector;
    RETURN;
END

-- 2. Verificar si existe el camión 3
IF NOT EXISTS (SELECT 1 FROM dbo.camiones WHERE id = @camion_target_id)
BEGIN
    PRINT '❌ ERROR: El camión ID 3 no existe en la base de datos.';
    RETURN;
END

-- 3. BUSCAR Y RESETEAR LA INSPECCIÓN ACTIVA PARA ESTE CAMIÓN
--    (O crearla si no existe)
IF EXISTS (SELECT 1 FROM dbo.inspecciones WHERE camion_id = @camion_target_id)
BEGIN
    -- Si ya existe, la forzamos a ser tuya y estar pendiente
    UPDATE dbo.inspecciones
    SET 
        inspector_id = @inspector_id,      -- ASIGNADA A TI
        estado = 'PROGRAMADA',             -- HABILITADA
        resultado_general = 'PENDIENTE',   -- SIN RESULTADO
        revision_admin = 'PENDIENTE',
        nota_final = NULL,
        fecha_programada = CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'Pacific SA Standard Time' AS DATE), -- HOY
        fecha_inspeccion = CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'Pacific SA Standard Time' AS DATE)  -- HOY (Para cumplir restricción NOT NULL)
    WHERE camion_id = @camion_target_id;

    PRINT '✅ Inspección existente del Camión 3 reseteada y asignada a ti.';
END
ELSE
BEGIN
    -- Si no existe, la creamos desde cero
    INSERT INTO dbo.inspecciones 
    (camion_id, inspector_id, fecha_programada, fecha_inspeccion, estado, resultado_general, revision_admin)
    VALUES 
    (
        @camion_target_id, 
        @inspector_id, 
        CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'Pacific SA Standard Time' AS DATE), 
        CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'Pacific SA Standard Time' AS DATE),
        'PROGRAMADA', 
        'PENDIENTE',
        'PENDIENTE'
    );

    PRINT '✅ Nueva inspección creada para el Camión 3 y asignada a ti.';
END

-- 4. LIMPIEZA DE DETALLES (Para evitar errores de duplicados al guardar)
DELETE FROM dbo.detalle_inspeccion WHERE camion_id = @camion_target_id;
PRINT '✅ Detalles anteriores borrados. Formulario listo para enviar.';