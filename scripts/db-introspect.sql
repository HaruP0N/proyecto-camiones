/* 
  DB Introspect (Azure SQL)
  Ejecuta esto en tu editor SQL (SSMS/Azure Data Studio).
  Luego comparte los resultados de las secciones clave.
*/

-- 0) Info general
SELECT DB_NAME() AS database_name, @@SERVERNAME AS server_name;

-- 1) Tablas
SELECT 
  t.TABLE_SCHEMA, 
  t.TABLE_NAME
FROM INFORMATION_SCHEMA.TABLES t
WHERE t.TABLE_TYPE = 'BASE TABLE'
ORDER BY t.TABLE_SCHEMA, t.TABLE_NAME;

-- 2) Columnas (con tipos y nullabilidad)
SELECT 
  c.TABLE_SCHEMA,
  c.TABLE_NAME,
  c.COLUMN_NAME,
  c.DATA_TYPE,
  c.CHARACTER_MAXIMUM_LENGTH,
  c.NUMERIC_PRECISION,
  c.NUMERIC_SCALE,
  c.IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS c
ORDER BY c.TABLE_SCHEMA, c.TABLE_NAME, c.ORDINAL_POSITION;

-- 3) CHECK constraints (definiciones)
SELECT 
  OBJECT_SCHEMA_NAME(cc.parent_object_id) AS table_schema,
  OBJECT_NAME(cc.parent_object_id) AS table_name,
  cc.name AS constraint_name,
  cc.definition
FROM sys.check_constraints cc
ORDER BY table_schema, table_name, constraint_name;

-- 4) Foreign keys
SELECT 
  fk.name AS fk_name,
  OBJECT_SCHEMA_NAME(fk.parent_object_id) AS table_schema,
  OBJECT_NAME(fk.parent_object_id) AS table_name,
  OBJECT_SCHEMA_NAME(fk.referenced_object_id) AS ref_schema,
  OBJECT_NAME(fk.referenced_object_id) AS ref_table
FROM sys.foreign_keys fk
ORDER BY table_schema, table_name, fk.name;

-- 5) PKs / Unique / Indexes
SELECT 
  s.name AS schema_name,
  t.name AS table_name,
  i.name AS index_name,
  i.is_primary_key,
  i.is_unique,
  i.type_desc
FROM sys.indexes i
JOIN sys.tables t ON t.object_id = i.object_id
JOIN sys.schemas s ON s.schema_id = t.schema_id
WHERE i.type > 0
ORDER BY schema_name, table_name, i.is_primary_key DESC, i.is_unique DESC, index_name;

-- 6) Vistas (lista)
SELECT 
  s.name AS schema_name,
  v.name AS view_name
FROM sys.views v
JOIN sys.schemas s ON s.schema_id = v.schema_id
ORDER BY schema_name, view_name;

-- 7) Vistas (definición)
SELECT 
  s.name AS schema_name,
  v.name AS view_name,
  OBJECT_DEFINITION(v.object_id) AS view_definition
FROM sys.views v
JOIN sys.schemas s ON s.schema_id = v.schema_id
ORDER BY schema_name, view_name;

-- 8) Procedimientos almacenados
SELECT 
  s.name AS schema_name,
  p.name AS proc_name,
  OBJECT_DEFINITION(p.object_id) AS proc_definition
FROM sys.procedures p
JOIN sys.schemas s ON s.schema_id = p.schema_id
ORDER BY schema_name, proc_name;

-- 9) Funciones
SELECT 
  s.name AS schema_name,
  o.name AS func_name,
  o.type_desc,
  OBJECT_DEFINITION(o.object_id) AS func_definition
FROM sys.objects o
JOIN sys.schemas s ON s.schema_id = o.schema_id
WHERE o.type IN ('FN','IF','TF')
ORDER BY schema_name, func_name;

-- 10) Triggers
SELECT 
  OBJECT_SCHEMA_NAME(t.object_id) AS schema_name,
  t.name AS trigger_name,
  OBJECT_NAME(t.parent_id) AS table_name,
  OBJECT_DEFINITION(t.object_id) AS trigger_definition
FROM sys.triggers t
ORDER BY schema_name, table_name, trigger_name;

/* 
  Secciones clave (si prefieres compartir solo lo esencial):
  - CHECK constraints de estas tablas:
    detalle_inspeccion, inspecciones, fotos_inspeccion, camiones, empresas, proveedores
  - Columnas de detalle_inspeccion y fotos_inspeccion
  - Procedimientos/funciones relacionados a inspecciones
*/

-- CHECKs solo de tablas clave
SELECT 
  OBJECT_SCHEMA_NAME(cc.parent_object_id) AS table_schema,
  OBJECT_NAME(cc.parent_object_id) AS table_name,
  cc.name AS constraint_name,
  cc.definition
FROM sys.check_constraints cc
WHERE OBJECT_NAME(cc.parent_object_id) IN (
  'detalle_inspeccion','inspecciones','fotos_inspeccion','camiones','empresas','proveedores'
)
ORDER BY table_name, constraint_name;

-- Columnas de detalle_inspeccion
SELECT 
  c.COLUMN_NAME,
  c.DATA_TYPE,
  c.IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS c
WHERE c.TABLE_NAME = 'detalle_inspeccion'
ORDER BY c.ORDINAL_POSITION;

-- Columnas de fotos_inspeccion
SELECT 
  c.COLUMN_NAME,
  c.DATA_TYPE,
  c.IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS c
WHERE c.TABLE_NAME = 'fotos_inspeccion'
ORDER BY c.ORDINAL_POSITION;






SELECT camion_id, COUNT(*) AS n
FROM dbo.inspecciones
WHERE estado = 'PROGRAMADA'
GROUP BY camion_id
HAVING COUNT(*) > 1;
