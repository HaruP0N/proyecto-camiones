# Formulario de Registro de Clientes - Azure SQL

Este proyecto proporciona un formulario para registrar empresas clientes en Azure SQL Database.

## Configuración

1. **Variables de Entorno**: Crea un archivo `.env.local` basado en `.env.example`:

```env
AZURE_SQL_SERVER=tu-servidor.database.windows.net
AZURE_SQL_DATABASE=nombre-de-tu-base-de-datos
AZURE_SQL_USER=tu-usuario
AZURE_SQL_PASSWORD=tu-contraseña
```

2. **Base de Datos**: Asegúrate de que las tablas estén creadas en tu Azure SQL Database usando el script SQL proporcionado.

3. **Firewall de Azure**: Configura las reglas de firewall en Azure para permitir conexiones desde tu IP o desde los servicios de Azure.

## Instalación y Ejecución

```bash
# Instalar dependencias
npm install

# Ejecutar en desarrollo
npm run dev

# Compilar para producción
npm run build
npm start
```

## Características

- Formulario completo para registro de empresas
- Validación de campos obligatorios
- Manejo de prioridades de inspección (checkboxes)
- Conexión segura a Azure SQL Database
- Manejo de errores (RUT duplicado, etc.)
- API REST para crear y listar empresas

## Endpoints API

- `POST /api/empresas` - Crear nueva empresa
- `GET /api/empresas` - Listar todas las empresas

## Próximos Pasos

Puedes extender esta aplicación agregando:
- Formularios para proveedores, camiones e inspecciones
- Sistema de autenticación (usuarios)
- Dashboard para visualizar datos
- Filtros y búsqueda de registros
