-- =================================================================================
-- SCRIPT CORREGIDO (ASIGNADO A juako332@gmail.com)
-- =================================================================================

DECLARE @email_inspector NVARCHAR(100) = 'juako332@gmail.com'; 
DECLARE @patente_test NVARCHAR(20) = 'MOVIL-TEST';
DECLARE @inspector_id INT;
DECLARE @camion_id INT;

-- 1. OBTENER ID DEL INSPECTOR
SELECT @inspector_id = id FROM dbo.usuarios WHERE email = @email_inspector;

IF @inspector_id IS NULL
BEGIN
    PRINT '❌ ERROR: No se encontró el usuario ' + @email_inspector;
    RETURN;
END

-- 2. LIMPIEZA: Borrar inspecciones previas de este camión
DELETE FROM dbo.inspecciones 
WHERE camion_id IN (SELECT id FROM dbo.camiones WHERE patente = @patente_test);

-- 3. OBTENER CAMIÓN (Si no existe, el script anterior ya lo creó, pero aseguramos)
SELECT TOP 1 @camion_id = id FROM dbo.camiones WHERE patente = @patente_test;

IF @camion_id IS NULL
BEGIN
    PRINT '❌ ERROR: El camión no se encontró. Ejecuta el script completo anterior o crea el camión manualmente.';
    -- (Opcional: aquí podrías repetir la lógica de creación si quisieras ser redundante)
    RETURN;
END

-- 4. CREAR LA INSPECCIÓN FINAL (CORREGIDO: fecha_inspeccion = fecha_programada)
INSERT INTO dbo.inspecciones 
(camion_id, inspector_id, fecha_programada, fecha_inspeccion, estado, resultado_general)
VALUES 
(
    @camion_id, 
    @inspector_id, 
    CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'Pacific SA Standard Time' AS DATE), -- Fecha Programada (HOY)
    CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'Pacific SA Standard Time' AS DATE), -- Fecha Inspección (HOY - Requerido NO NULL)
    'PROGRAMADA', 
    'PENDIENTE'
);

PRINT '🚀 ¡LISTO! Inspección creada exitosamente.';
PRINT '   -> Camión: ' + @patente_test;
PRINT '   -> Asignada a: ' + @email_inspector + ' (ID: ' + CAST(@inspector_id AS VARCHAR) + ')';






-- Actualizar la fecha de PLND45 al día de hoy (hora actual del servidor)
UPDATE i
SET 
    i.fecha_programada = CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'Pacific SA Standard Time' AS DATETIME2),
    i.fecha_inspeccion = CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'Pacific SA Standard Time' AS DATE)
FROM dbo.inspecciones i
INNER JOIN dbo.camiones c ON c.id = i.camion_id
WHERE c.patente = 'PLND45';






select *from fotos_inspeccion 
select * from detalle_inspeccion