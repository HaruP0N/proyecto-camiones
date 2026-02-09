/*
 Seed de demo:
 - 3 empresas reales
 - 1 proveedor por empresa (tipo_transportista obligatorio)
 - 3 camiones por proveedor con patentes únicas por proveedor

 Ejecuta después de reset-cascade.sql
*/

BEGIN TRY
    BEGIN TRAN;

    -- Empresas demo
    DECLARE @empresas TABLE (id INT, nombre NVARCHAR(200));
    INSERT INTO dbo.empresas (nombre, rut)
        OUTPUT INSERTED.id, INSERTED.nombre INTO @empresas
    VALUES
        (N'Transporte Andino SpA',   N'76.123.456-7'),
        (N'Logística Mar del Sur',   N'77.987.654-3'),
        (N'Frío Austral Servicios',  N'78.456.789-5');

    -- Proveedores (maneja columnas obligatorias: tipo_transportista y tipo_entidad)
    DECLARE @prov TABLE (id INT, empresa_id INT);
    DECLARE @hasTipoTrans BIT = CASE WHEN COL_LENGTH('dbo.proveedores','tipo_transportista') IS NULL THEN 0 ELSE 1 END;
    DECLARE @hasTipoEnt  BIT = CASE WHEN COL_LENGTH('dbo.proveedores','tipo_entidad') IS NULL THEN 0 ELSE 1 END;

    DECLARE @tipoEnt  NVARCHAR(50) = N'EMPRESA';     -- valor seguro para tipo_entidad
    DECLARE @tipoTrans NVARCHAR(50) = N'no_licitado'; -- cumple CK_proveedores_tipo

    IF @hasTipoTrans = 1 AND @hasTipoEnt = 1
    BEGIN
        INSERT INTO dbo.proveedores (empresa_id, nombre, tipo_transportista, tipo_entidad)
            OUTPUT INSERTED.id, INSERTED.empresa_id INTO @prov
        SELECT id, nombre + N' - Proveedor', @tipoTrans, @tipoEnt
        FROM @empresas;
    END
    ELSE IF @hasTipoTrans = 1
    BEGIN
        INSERT INTO dbo.proveedores (empresa_id, nombre, tipo_transportista)
            OUTPUT INSERTED.id, INSERTED.empresa_id INTO @prov
        SELECT id, nombre + N' - Proveedor', @tipoTrans
        FROM @empresas;
    END
    ELSE
    BEGIN
        INSERT INTO dbo.proveedores (empresa_id, nombre)
            OUTPUT INSERTED.id, INSERTED.empresa_id INTO @prov
        SELECT id, nombre + N' - Proveedor'
        FROM @empresas;
    END

    /*
      Camiones: 3 por proveedor, patentes únicas por proveedor
        - Tractor
        - Camión rígido 6x2
        - Pickup 4x4
    */
    INSERT INTO dbo.camiones (proveedor_id, patente, marca, modelo, anio, tipo, carroceria)
    SELECT p.id,
           v.patente,
           v.marca,
           v.modelo,
           v.anio,
           v.tipo,
           v.carroceria
    FROM @prov p
    CROSS APPLY (VALUES
        (CONCAT('KX', RIGHT('00' + CAST(p.id AS VARCHAR(3)), 3), '1'), N'Scania',   N'R450',      2021, N'Tractor',       N'Sleeper Highline'),
        (CONCAT('LL', RIGHT('00' + CAST(p.id AS VARCHAR(3)), 3), '2'), N'Mercedes', N'Axor 2636', 2019, N'Camión Rígido', N'Pluma 6x2'),
        (CONCAT('JP', RIGHT('00' + CAST(p.id AS VARCHAR(3)), 3), '3'), N'Toyota',   N'Hilux',     2022, N'Pickup 4x4',    N'Reparto Frío')
    ) v(patente, marca, modelo, anio, tipo, carroceria);

    COMMIT;
    PRINT 'Seed demo cargado OK';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK;
    THROW;
END CATCH;
