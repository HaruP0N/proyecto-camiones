/*
 Limpia todos los datos de la plataforma (empresas, camiones, inspecciones, fotos, etc.)
 Mantiene a los usuarios con rol = 'admin' para no perder el acceso.
 Ejecuta en Azure SQL con un usuario con permisos de escritura.
*/

BEGIN TRY
    BEGIN TRAN;

    -- 1) Fotos de inspección
    IF OBJECT_ID('dbo.fotos_inspeccion', 'U') IS NOT NULL
        DELETE FROM dbo.fotos_inspeccion;

    -- 2) Detalle de inspecciones
    IF OBJECT_ID('dbo.detalle_inspeccion', 'U') IS NOT NULL
        DELETE FROM dbo.detalle_inspeccion;

    -- 3) Inspecciones (programadas/realizadas)
    IF OBJECT_ID('dbo.inspecciones', 'U') IS NOT NULL
        DELETE FROM dbo.inspecciones;

    -- 4) Camiones
    IF OBJECT_ID('dbo.camiones', 'U') IS NOT NULL
        DELETE FROM dbo.camiones;

    -- 5) Proveedores (en este esquema representan la relación empresa-camión)
    IF OBJECT_ID('dbo.proveedores', 'U') IS NOT NULL
        DELETE FROM dbo.proveedores;

    -- 6) Empresas
    IF OBJECT_ID('dbo.empresas', 'U') IS NOT NULL
        DELETE FROM dbo.empresas;

    -- 7) Usuarios (deja administradores)
    IF OBJECT_ID('dbo.usuarios', 'U') IS NOT NULL
        DELETE FROM dbo.usuarios WHERE LOWER(LTRIM(RTRIM(rol))) <> 'admin';

    -- 8) Opcional: reinicia identities para que empiecen en 1
    DECLARE @tables TABLE (name sysname);
    INSERT INTO @tables(name)
    VALUES ('fotos_inspeccion'), ('detalle_inspeccion'), ('inspecciones'), ('camiones'), ('proveedores'), ('empresas'), ('usuarios');

    DECLARE @t sysname, @sql nvarchar(200);
    DECLARE c CURSOR FOR SELECT name FROM @tables;
    OPEN c;
    FETCH NEXT FROM c INTO @t;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        IF OBJECT_ID(QUOTENAME('dbo') + '.' + QUOTENAME(@t), 'U') IS NOT NULL
        BEGIN TRY
            SET @sql = N'DBCC CHECKIDENT (' + QUOTENAME(@t,'''') + N', RESEED, 0) WITH NO_INFOMSGS;';
            EXEC (@sql);
        END TRY
        BEGIN CATCH
            -- Ignora si la tabla no tiene identity
        END CATCH;
        FETCH NEXT FROM c INTO @t;
    END
    CLOSE c; DEALLOCATE c;

    COMMIT TRAN;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRAN;
    THROW;
END CATCH;
