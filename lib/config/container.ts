import { SqlCamionRepository } from '../infrastructure/repositories/SqlCamionRepository';
import { ObtenerCamionesUseCase } from '../application/camiones/ObtenerCamiones';

// 1. Instanciar Repositorios (Capa de Infraestructura)
const camionRepository = new SqlCamionRepository();

// 2. Instanciar Casos de Uso (Capa de Aplicación)
export const obtenerCamionesUseCase = new ObtenerCamionesUseCase(camionRepository);