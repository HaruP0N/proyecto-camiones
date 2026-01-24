export interface Camion {
  id: number;
  patente: string;
  marca: string;
  modelo: string;
  anio: number;
  empresaId: number;
  estado: 'ACTIVO' | 'MANTENCION' | 'INACTIVO';
  createdAt?: Date;
}