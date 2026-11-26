import { getPool, Transaction } from '../../database';
import type { ICamionRepository } from '../../domain/repositories/ICamionRepository';
import type { Camion } from '../../domain/entities/Camion';

const projection = `c.id, c.patente, c.marca, c.modelo, c.anio, c.estado,
  p.empresa_id AS "empresaId", c.created_at AS "createdAt"`;

export class SqlCamionRepository implements ICamionRepository {
  async findAll(empresaId?: number): Promise<Camion[]> {
    const pool = await getPool();
    const result = await pool.request().input('empresaId', empresaId ?? null).query<Camion>(`
      SELECT ${projection} FROM public.camiones c JOIN public.proveedores p ON p.id = c.proveedor_id
      WHERE (@empresaId::integer IS NULL OR p.empresa_id = @empresaId)
    `);
    return result.recordset;
  }

  async findById(id: number): Promise<Camion | null> {
    const result = await (await getPool()).request().input('id', id).query<Camion>(`
      SELECT ${projection} FROM public.camiones c JOIN public.proveedores p ON p.id = c.proveedor_id WHERE c.id = @id
    `);
    return result.recordset[0] ?? null;
  }

  async create(camion: Omit<Camion, 'id'>): Promise<Camion> {
    const tx = new Transaction(await getPool());
    await tx.begin();
    let id: number;
    try {
      const empresa = await tx.request().input('empresaId', camion.empresaId)
        .query('SELECT id FROM public.empresas WHERE id = @empresaId FOR UPDATE');
      if (!empresa.recordset.length) throw new Error('Empresa no encontrada');
      const providers = await tx.request().input('empresaId', camion.empresaId)
        .query('SELECT id FROM public.proveedores WHERE empresa_id = @empresaId ORDER BY id DESC LIMIT 1');
      const provider = providers.recordset[0] ?? (await tx.request().input('empresaId', camion.empresaId)
        .query(`INSERT INTO public.proveedores (empresa_id, nombre) VALUES (@empresaId, 'Proveedor (auto)') RETURNING id`)).recordset[0];
      const result = await tx.request().input('patente', camion.patente.trim().toUpperCase().replace(/\s+/g, ''))
        .input('marca', camion.marca).input('modelo', camion.modelo).input('anio', camion.anio)
        .input('proveedorId', provider.id).input('estado', camion.estado ?? 'ACTIVO').query(`
          INSERT INTO public.camiones (patente, marca, modelo, anio, proveedor_id, estado)
          VALUES (@patente, @marca, @modelo, @anio, @proveedorId, @estado) RETURNING id
        `);
      id = result.recordset[0].id;
      await tx.commit();
    } catch (error) { await tx.rollback(); throw error; }
    return (await this.findById(id))!;
  }
}
