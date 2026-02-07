-- Script para crear un inspector de prueba en PETRAN
-- Ejecutar en Azure SQL Database

-- Si el inspector ya existe, no lo duplicar
IF NOT EXISTS (SELECT 1 FROM usuarios WHERE email = 'inspector@petran.cl')
BEGIN
    -- Insertar inspector de prueba
    -- Contraseña: 123456 (bcrypt hash con 10 rounds)
    -- Hash generado con: bcrypt.hashSync('123456', 10)
    INSERT INTO usuarios (email, password_hash, nombre, rol, activo, fecha_creacion)
    VALUES (
        'inspector@petran.cl',
        '$2a$10$7Px8u.Hc.WPuDtYlCjLI9.nQKBX0C.LZ3OzvMRq0AYkImKUpwF89a',  -- hash de '123456'
        'Inspector Test',
        'inspector',
        1,
        GETDATE()
    );
    
    PRINT '✅ Inspector de prueba creado: inspector@petran.cl (contraseña: 123456)';
END
ELSE
BEGIN
    PRINT '⚠️  Inspector inspector@petran.cl ya existe';
END
