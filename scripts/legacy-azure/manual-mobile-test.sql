DECLARE @inspector_id INT = 7;

-- 2. Buscar o crear Empresa de prueba
DECLARE @empresa_id INT;
SELECT TOP 1 @empresa_id = id FROM dbo.empresas WHERE nombre LIKE '%TEST%';

IF @empresa_id IS NULL
BEGIN
  INSERT INTO dbo.empresas (nombre, rut)
  VALUES ('EMPRESA TEST', '99999999-9');
  SET @empresa_id = SCOPE_IDENTITY();
END

-- 3. Buscar o crear Proveedor de prueba
DECLARE @proveedor_id INT;
SELECT TOP 1 @proveedor_id = id FROM dbo.proveedores WHERE empresa_id = @empresa_id;

IF @proveedor_id IS NULL
BEGIN
  INSERT INTO dbo.proveedores (empresa_id, nombre, tipo_transportista)
  VALUES (@empresa_id, 'PROVEEDOR TEST', 'PROPIO');
  SET @proveedor_id = SCOPE_IDENTITY();
END

-- 4. Crear Camión de prueba
DECLARE @camion_id INT;
SELECT TOP 1 @camion_id = id FROM dbo.camiones WHERE patente = 'MOVIL-TEST';

IF @camion_id IS NULL
BEGIN
  INSERT INTO dbo.camiones (patente, marca, modelo, proveedor_id, tipo)
  VALUES ('MOVIL-TEST', 'TEST', 'TEST', @proveedor_id, 'CAMION');
  SET @camion_id = SCOPE_IDENTITY();
END

-- 5. Crear Inspección para hoy
DECLARE @inspeccion_id INT;
INSERT INTO dbo.inspecciones (
  camion_id, inspector_id, estado, fecha_programada, fecha_inspeccion, resultado_general
)
VALUES (
  @camion_id, @inspector_id, 'REALIZADA', CAST(GETDATE() AS DATE), CAST(GETDATE() AS DATE), 'APROBADO'
);
SET @inspeccion_id = SCOPE_IDENTITY();

-- 6. Mostrar el ID de la inspección
PRINT 'Inspeccion creada con ID: ' + CAST(@inspeccion_id AS VARCHAR);

-- Puedes navegar a /admin/inspecciones/@inspeccion_id/review
