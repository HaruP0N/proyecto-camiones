/*
 Seed de demo CORREGIDO para Petran Inspect:
 - 3 empresas
 - 1 proveedor por empresa (tipo_transportista = 'licitado')
 - 3 camiones por proveedor con tipos y carrocerías VÁLIDOS
*/

BEGIN TRY
    BEGIN TRAN;

    -- 1. Empresas demo
    DECLARE @empresas TABLE (id INT, nombre NVARCHAR(200), rut NVARCHAR(20));
    
    INSERT INTO dbo.empresas (nombre, rut, direccion, rubro)
    OUTPUT INSERTED.id, INSERTED.nombre, INSERTED.rut INTO @empresas
    VALUES
        (N'Transporte Andino SpA',   N'76.123.456-7', 'Av. Andes 123', 'Logística'),
        (N'Logística Mar del Sur',   N'77.987.654-3', 'Puerto Montt 456', 'Transporte'),
        (N'Frío Austral Servicios',  N'78.456.789-5', 'Ruta 5 Sur Km 200', 'Refrigerados');

    -- 2. Proveedores 
    -- CORRECCIÓN: Usamos valores válidos 'licitado' y 'empresa' directamente
    DECLARE @prov TABLE (id INT, empresa_id INT);

    INSERT INTO dbo.proveedores (
        empresa_id, nombre, rut, direccion,
        nombre_contacto, telefono_contacto, email_contacto,
        tipo_transportista, tipo_entidad
    )
    OUTPUT INSERTED.id, INSERTED.empresa_id INTO @prov
    SELECT 
        id, 
        nombre + N' - Prov', 
        STUFF(rut, LEN(rut), 1, CAST(id AS VARCHAR)), -- Genera RUT único ficticio
        'Dirección Comercial ' + CAST(id AS VARCHAR),
        'Jefe de Flota',
        '+56912345678',
        'contacto@proveedor.cl',
        'licitado', -- ✅ VALOR VÁLIDO
        'empresa'   -- ✅ VALOR VÁLIDO
    FROM @empresas;

    /*
      3. Camiones: 3 por proveedor
      CORRECCIÓN: Usamos 'camion'/'acople' y carrocerías válidas según constraints
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
        -- Camión 1: Tracto (Simulado como 'camion_con_carro')
        (CONCAT('KX', RIGHT('00' + CAST(p.id AS VARCHAR(3)), 3), '1'), N'Scania',   N'R450',      2021, N'camion', N'camion_con_carro'),
        
        -- Camión 2: Rígido Paquetero
        (CONCAT('LL', RIGHT('00' + CAST(p.id AS VARCHAR(3)), 3), '2'), N'Mercedes', N'Axor 2636', 2019, N'camion', N'camion_carro_paquetero'),
        
        -- Camión 3: Acople Reefer (En lugar de Pickup que no existe en tus constraints)
        (CONCAT('JP', RIGHT('00' + CAST(p.id AS VARCHAR(3)), 3), '3'), N'Ram',      N'Reefer',    2022, N'acople', N'carro_reefer')
    ) v(patente, marca, modelo, anio, tipo, carroceria);

    COMMIT;
    PRINT '✅ Seed demo cargado EXITOSAMENTE.';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK;
    PRINT '❌ Error: ' + ERROR_MESSAGE();
END CATCH;