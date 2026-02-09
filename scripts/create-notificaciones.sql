-- Crear tabla de notificaciones para inspectores
IF OBJECT_ID('dbo.notificaciones', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.notificaciones (
    id INT IDENTITY(1,1) PRIMARY KEY,
    usuario_id INT NOT NULL,
    inspeccion_id INT NULL,
    tipo VARCHAR(50) NOT NULL,
    titulo VARCHAR(200) NOT NULL,
    mensaje NVARCHAR(MAX) NULL,
    leida BIT NOT NULL DEFAULT 0,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
  );

  ALTER TABLE dbo.notificaciones
    ADD CONSTRAINT FK_notificaciones_usuario
    FOREIGN KEY (usuario_id) REFERENCES dbo.usuarios(id);

  ALTER TABLE dbo.notificaciones
    ADD CONSTRAINT FK_notificaciones_inspeccion
    FOREIGN KEY (inspeccion_id) REFERENCES dbo.inspecciones(id);

  CREATE INDEX idx_notificaciones_usuario
    ON dbo.notificaciones(usuario_id, leida, created_at);
END
