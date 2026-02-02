-- Variables
DECLARE @inspector_id INT;
DECLARE @empresa_id INT;
DECLARE @proveedor_id INT;
DECLARE @camion_id INT;
DECLARE @hoy DATE = CAST(GETDATE() AS DATE);
DECLARE @rut_user VARCHAR(20) = '200707532';

-- 1. Obtener el ID del inspector
SELECT @inspector_id = id FROM usuarios WHERE email = 'juako332@gmail.com';

-- 2. Manejo de EMPRESA (Matriz)
SELECT @empresa_id = id FROM empresas WHERE rut = @rut_user;
IF @empresa_id IS NULL
BEGIN
    INSERT INTO empresas (nombre, rut, direccion, created_at)
    VALUES ('Empresa Matriz Test', @rut_user, 'Dirección Empresa', GETDATE());
    SET @empresa_id = SCOPE_IDENTITY();
END

-- 3. Manejo de PROVEEDOR (Con los valores exactos de los CHECKs)
SELECT @proveedor_id = id FROM proveedores WHERE rut = @rut_user;
IF @proveedor_id IS NULL
BEGIN
    INSERT INTO proveedores (
        nombre, rut, direccion, empresa_id, 
        tipo_transportista, 
        tipo_entidad, 
        created_at
    ) 
    VALUES (
        'Proveedor de Prueba', @rut_user, 'Dirección Proveedor', @empresa_id, 
        'no_licitado', -- Validado por CK_proveedores_tipo
        'empresa',     -- Validado por CK_proveedores_entidad
        GETDATE()
    );
    SET @proveedor_id = SCOPE_IDENTITY();
END
ELSE 
BEGIN
    SET @proveedor_id = (SELECT id FROM proveedores WHERE rut = @rut_user);
END

-- 4. Crear Camión TEST-010
IF @proveedor_id IS NOT NULL
BEGIN
    SELECT @camion_id = id FROM camiones WHERE patente = 'TEST-010';
    IF @camion_id IS NULL
    BEGIN
        INSERT INTO camiones (patente, marca, modelo, anio, tipo, proveedor_id, created_at, carroceria)
        VALUES ('TEST-010', 'Scania', 'R500', 2023, 'camion', @proveedor_id, GETDATE(), 'CAMARA_DE_FRIO');
        SET @camion_id = SCOPE_IDENTITY();
        PRINT '✅ Camión TEST-010 creado con carroceria CAMARA_DE_FRIO';
    END
    ELSE
    BEGIN
        UPDATE camiones SET carroceria = 'CAMARA_DE_FRIO' WHERE patente = 'TEST-010';
        PRINT 'ℹ️ Camión TEST-010 actualizado a carroceria CAMARA_DE_FRIO';
    END
    -- Guardar el id de TEST-010
    DECLARE @camion_id_test010 INT = @camion_id;
END

-- 5. Crear Inspección SOLO para TEST-010
IF @camion_id_test010 IS NOT NULL
BEGIN
    -- Limpiar inspecciones de prueba previas para hoy
    DELETE FROM inspecciones WHERE camion_id = @camion_id_test010 AND CAST(fecha_programada AS DATE) = @hoy;

    INSERT INTO inspecciones (
        camion_id, inspector_id, fecha_programada, estado, created_at, fecha_inspeccion, resultado_general
    )
    VALUES (
        @camion_id_test010, @inspector_id, GETDATE(), 'PROGRAMADA', GETDATE(), @hoy, 'APROBADO' 
    );
    PRINT '✅ ¡Inspección creada exitosamente para TEST-010 hoy!';
END

-- Verificación final de la relación
SELECT i.id as folio, c.patente, p.nombre as proveedor, i.estado, i.fecha_programada
FROM inspecciones i 
JOIN camiones c ON i.camion_id = c.id 
JOIN proveedores p ON c.proveedor_id = p.id
WHERE c.patente = 'TEST-01';

select * from camiones where patente = 'TEST-010';



 UPDATE camiones SET carroceria = 'CAMARA_DE_FRIO' WHERE patente = 'TEST-010';