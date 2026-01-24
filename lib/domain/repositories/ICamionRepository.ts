import { Camion } from "../entities/Camion";

export interface ICamionRepository {
  findAll(empresaId?: number): Promise<Camion[]>;
  findById(id: number): Promise<Camion | null>;
  create(camion: Omit<Camion, 'id'>): Promise<Camion>;
}