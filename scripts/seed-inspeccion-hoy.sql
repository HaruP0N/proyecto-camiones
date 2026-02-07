-- Script para crear una inspección de prueba para HOY
-- Ejecutar en Azure SQL Database

-- Variables
DECLARE @inspector_id INT;
DECLARE @empresa_id INT;
DECLARE @camion_id INT;
DECLARE @hoy DATE = CAST(GETDATE() AS DATE);

-- Obtener el ID del inspector de prueba
SELECT @inspector_id = id FROM usuarios WHERE email = 'juako332@gmail.com' AND rol = 'inspector';

IF @inspector_id IS NULL
BEGIN
    PRINT '❌ Error: No se encontró el inspector juako332@gmail.com';
    PRINT '   Primero ejecuta: scripts/seed-inspector.sql';
    RETURN;
END

PRINT '✅ Inspector encontrado con ID: ' + CAST(@inspector_id AS VARCHAR);

-- Verificar si existe una empresa de prueba, si no crear una
IF NOT EXISTS (SELECT 1 FROM empresas WHERE nombre = 'Transportes Test S.A.')
BEGIN
    INSERT INTO empresas (nombre, rut, direccion, activo, fecha_creacion)
    VALUES ('Transportes Test S.A.', '76.123.456-7', 'Av. Test 123, Santiago', 1, GETDATE());

    PRINT '✅ Empresa de prueba creada';
END

SELECT @empresa_id = id FROM empresas WHERE nombre = 'Transportes Test S.A.';
PRINT '✅ Empresa ID: ' + CAST(@empresa_id AS VARCHAR);

-- Verificar si existe un camión de prueba, si no crear uno
IF NOT EXISTS (SELECT 1 FROM camiones WHERE patente = 'TEST-01')
BEGIN
    INSERT INTO camiones (patente, marca, modelo, anio, tipo, empresa_id, activo, fecha_creacion)
    VALUES ('TEST-01', 'Volvo', 'FH16', 2022, 'Tracto Camión', @empresa_id, 1, GETDATE());

    PRINT '✅ Camión de prueba creado: TEST-01';
END

SELECT @camion_id = id FROM camiones WHERE patente = 'TEST-01';
PRINT '✅ Camión ID: ' + CAST(@camion_id AS VARCHAR);

-- Crear otro camión de prueba si no existe
IF NOT EXISTS (SELECT 1 FROM camiones WHERE patente = 'TEST-02')
BEGIN
    INSERT INTO camiones (patente, marca, modelo, anio, tipo, empresa_id, activo, fecha_creacion)
    VALUES ('TEST-02', 'Mercedes-Benz', 'Actros', 2023, 'Semirremolque', @empresa_id, 1, GETDATE());

    PRINT '✅ Camión de prueba 2 creado: TEST-02';
END

-- Eliminar inspecciones anteriores de prueba para hoy (si existen)
DELETE FROM inspecciones
WHERE camion_id IN (SELECT id FROM camiones WHERE patente IN ('TEST-01', 'TEST-02'))
AND CAST(fecha_programada AS DATE) = @hoy;

PRINT '🗑️  Inspecciones anteriores de prueba eliminadas';

-- Crear inspecciones para hoy
INSERT INTO inspecciones (camion_id, inspector_id, fecha_programada, estado, tipo_inspeccion, fecha_creacion)
VALUES
    (@camion_id, @inspector_id, GETDATE(), 'PROGRAMADA', 'COMPLETA', GETDATE()),
    ((SELECT id FROM camiones WHERE patente = 'TEST-02'), @inspector_id, GETDATE(), 'PROGRAMADA', 'COMPLETA', GETDATE());

PRINT '✅ Inspecciones creadas para hoy:';
PRINT '   - TEST-01 (Volvo FH16)';
PRINT '   - TEST-02 (Mercedes-Benz Actros)';

-- Mostrar resumen
SELECT
    i.id as inspeccion_id,
    c.patente,
    c.marca,
    c.modelo,
    e.nombre as empresa,
    u.nombre as inspector,
    i.estado,
    i.fecha_programada
FROM inspecciones i
JOIN camiones c ON i.camion_id = c.id
JOIN empresas e ON c.empresa_id = e.id
JOIN usuarios u ON i.inspector_id = u.id
WHERE i.inspector_id = @inspector_id
AND CAST(i.fecha_programada AS DATE) = @hoy;

PRINT '';
PRINT '🎉 ¡Listo! Ahora puedes probar las inspecciones en:';
PRINT '   http://localhost:3000/inspector';
PRINT '   Login: juako332@gmail.com / 123456';
