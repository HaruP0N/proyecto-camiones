import { ICamionRepository } from '../../domain/repositories/ICamionRepository';

export class ObtenerCamionesUseCase {
  constructor(private camionRepo: ICamionRepository) {}

  async execute(empresaId?: number) {
    return await this.camionRepo.findAll(empresaId);
  }
}