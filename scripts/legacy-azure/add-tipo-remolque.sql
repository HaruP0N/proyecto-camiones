-- Script para agregar columna tipo_remolque a la tabla camiones
-- Ejecutar en Azure SQL Database

-- Verificar si la columna existe, si no, agregarla
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'camiones' AND COLUMN_NAME = 'tipo_remolque'
)
BEGIN
    ALTER TABLE camiones ADD tipo_remolque VARCHAR(50) NULL;
    PRINT '✅ Columna tipo_remolque agregada a la tabla camiones';
END
ELSE
BEGIN
    PRINT '⚠️ La columna tipo_remolque ya existe';
END

-- Actualizar el camión de prueba con tipo_remolque
UPDATE camiones SET tipo_remolque = 'refrigerado' WHERE id = 14;
UPDATE camiones SET tipo_remolque = 'caja_seca' WHERE patente = 'TEST-01';
UPDATE camiones SET tipo_remolque = 'plataforma' WHERE patente = 'TEST-02';

PRINT '✅ Tipos de remolque actualizados';

-- Verificar cambios
SELECT id, patente, marca, modelo, tipo, tipo_remolque
FROM camiones
WHERE tipo_remolque IS NOT NULL;
