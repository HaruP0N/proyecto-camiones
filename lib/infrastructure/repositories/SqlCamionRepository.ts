import sql from 'mssql';
import { getPool } from '../database/sql/connection';
import { ICamionRepository } from '../../../domain/repositories/ICamionRepository';
import { Camion } from '../../../domain/entities/Camion';

export class SqlCamionRepository implements ICamionRepository {
  
  async findAll(empresaId?: number): Promise<Camion[]> {
    const pool = await getPool();
    let query = 'SELECT * FROM Camiones';
    
    if (empresaId) {
      query += ' WHERE empresa_id = @empresaId';
      const request = pool.request();
      request.input('empresaId', sql.Int, empresaId);
      const result = await request.query(query);
      return result.recordset as Camion[];
    }
    
    const result = await pool.request().query(query);
    return result.recordset as Camion[];
  }

  async findById(id: number): Promise<Camion | null> {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT * FROM Camiones WHERE id = @id');
    
    return result.recordset[0] || null;
  }

  async create(camion: Omit<Camion, 'id'>): Promise<Camion> {
    const pool = await getPool();
    const result = await pool.request()
      .input('patente', sql.NVarChar, camion.patente)
      .input('marca', sql.NVarChar, camion.marca)
      .input('modelo', sql.NVarChar, camion.modelo)
      .input('anio', sql.Int, camion.anio)
      .input('empresa_id', sql.Int, camion.empresaId)
      .query(`
        INSERT INTO Camiones (patente, marca, modelo, anio, empresa_id)
        OUTPUT INSERTED.*
        VALUES (@patente, @marca, @modelo, @anio, @empresa_id)
      `);
      
    return result.recordset[0];
  }
}