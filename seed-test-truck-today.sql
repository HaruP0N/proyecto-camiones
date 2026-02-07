-- 1. Buscar Inspector por email
DECLARE @inspector_id INT;
SELECT TOP 1 @inspector_id = id FROM dbo.usuarios WHERE email = 'juako332@gmail.com';

IF @inspector_id IS NULL
BEGIN
  PRINT 'Inspector no encontrado';
  RETURN;
END

-- 2. Buscar o crear Empresa de prueba
DECLARE @empresa_id INT;
SELECT TOP 1 @empresa_id = id FROM dbo.empresas WHERE nombre LIKE '%TEST%';

IF @empresa_id IS NULL
BEGIN
  INSERT INTO dbo.empresas (nombre) VALUES ('EMPRESA TEST');
  SET @empresa_id = SCOPE_IDENTITY();
END

-- 3. Buscar o crear Proveedor de prueba
DECLARE @proveedor_id INT;
SELECT TOP 1 @proveedor_id = id FROM dbo.proveedores WHERE empresa_id = @empresa_id;

IF @proveedor_id IS NULL
BEGIN
  INSERT INTO dbo.proveedores (empresa_id, nombre) VALUES (@empresa_id, 'PROVEEDOR TEST');
  SET @proveedor_id = SCOPE_IDENTITY();
END

-- 4. Crear Camión de prueba
DECLARE @camion_id INT;
SELECT TOP 1 @camion_id = id FROM dbo.camiones WHERE patente = 'MOVIL-TEST';

IF @camion_id IS NULL
BEGIN
  INSERT INTO dbo.camiones (patente, marca, modelo, proveedor_id)
  VALUES ('MOVIL-TEST', 'TEST', 'TEST', @proveedor_id);
  SET @camion_id = SCOPE_IDENTITY();
END

-- 5. Crear Inspección para hoy
DECLARE @inspeccion_id INT;
INSERT INTO dbo.inspecciones (
  camion_id, inspector_id, estado, fecha_programada, fecha_inspeccion
)
VALUES (
  @camion_id, @inspector_id, 'REALIZADA', CAST(GETDATE() AS DATE), CAST(GETDATE() AS DATE)
);
SET @inspeccion_id = SCOPE_IDENTITY();

-- 6. Mostrar el ID de la inspección
PRINT 'Inspeccion creada con ID: ' + CAST(@inspeccion_id AS VARCHAR);

-- Puedes navegar a /admin/inspecciones/@inspeccion_id/review
