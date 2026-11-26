import bcrypt from 'bcryptjs';
import { getPool } from '../lib/database';

async function main() {
  const email = process.env.SETUP_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SETUP_ADMIN_PASSWORD;
  if (!email || !password || password.length < 12) throw new Error('Configura SETUP_ADMIN_EMAIL y SETUP_ADMIN_PASSWORD (mínimo 12 caracteres) solo en tu entorno local.');
  const db = await getPool();
  try {
    const hash = await bcrypt.hash(password, 12);
    await db.request().input('email', email).input('hash', hash).query(`
      INSERT INTO public.usuarios (nombre, email, password_hash, rol, activo)
      VALUES ('Administrador', @email, @hash, 'admin', TRUE)
    `);
    console.log('Administrador creado. Elimina las variables SETUP_ADMIN_* de tu entorno.');
  } finally { await db.pool.end(); }
}
main().catch(() => { console.error('No se creó el administrador. Verifica la configuración, la contraseña (mínimo 12 caracteres) y que el correo no exista.'); process.exitCode = 1; });
