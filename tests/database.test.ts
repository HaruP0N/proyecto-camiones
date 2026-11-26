import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import type { Pool } from 'pg';
import { bindParameters } from '../lib/database/parameters';
import { connectionConfig } from '../lib/database';
import { normalizeSchedule } from '../lib/inspection/schedule';
import { SqlCamionRepository } from '../lib/infrastructure/repositories/SqlCamionRepository';

test('named values stay parameterized and never change strings/comments', () => {
  const payload = "x'); DROP TABLE usuarios; --";
  const bound = bindParameters(`SELECT @id, @id, '@id', "@id", $$@id$$ -- @ignored\n/* @ignored */ WHERE x = @value`, new Map<string, unknown>([['id', 7], ['value', payload]]));
  assert.equal(bound.text, `SELECT $1, $1, '@id', "@id", $$@id$$ -- @ignored\n/* @ignored */ WHERE x = $2`);
  assert.deepEqual(bound.values, [7, payload]);
  assert.throws(() => bindParameters('SELECT @missing', new Map()), /missing/);
});

test('remote database connections always verify TLS certificates', () => {
  process.env.DATABASE_URL = 'postgresql://postgres:fake@db.example.com/postgres?sslmode=no-verify';
  const config = connectionConfig();
  assert.equal(config.ssl && config.ssl.rejectUnauthorized, true);
  assert.ok(!config.connectionString.includes('sslmode'));
  delete process.env.DATABASE_URL;
});

test('schedule accepts date-only, minute and second precision and rejects impossible calendar dates', () => {
  for (const value of ['2026-11-26', '2026-11-26T09:00', '2026-11-26T09:00:00']) assert.equal(normalizeSchedule(value), '2026-11-26T09:00:00');
  for (const value of ['2026-02-30', '2026-11-26T25:00', '26/11/2026', '2026-11-26T12:60', '']) assert.equal(normalizeSchedule(value), null);
});

test('PostgreSQL schema and complete API workflow', async t => {
  const db = new PGlite();
  const query = async (text: string, values?: unknown[]) => {
    const result = await db.query<Record<string, any>>(text, values);
    return { ...result, rowCount: result.affectedRows ?? result.rows.length };
  };
  // Only the transport is replaced: every query runs in a real embedded PostgreSQL engine.
  global.__postgresPool = { query, connect: async () => ({ query, release() {} }) } as unknown as Pool;
  process.env.ADMIN_JWT_SECRET = 'test-only-staff-secret-with-enough-entropy';
  process.env.CLIENTE_JWT_SECRET = 'test-only-client-secret-with-enough-entropy';
  try {
    await db.exec('CREATE ROLE anon; CREATE ROLE authenticated;');
    await db.exec(await readFile('supabase/migrations/20261126014852_initial_schema.sql', 'utf8'));
    await db.exec(await readFile('supabase/migrations/20261126015403_preserve_local_backup_fields.sql', 'utf8'));
    const hash = await bcrypt.hash('test-password', 4);
    const users = await query(`INSERT INTO usuarios (nombre,email,password_hash,rol) VALUES ('Admin','admin@example.test',$1,'admin'),('Inspector','inspector@example.test',$1,'inspector'),('Otro','other@example.test',$1,'inspector') RETURNING id`, [hash]);
    const [adminId, inspectorId, otherId] = users.rows.map((r: any) => r.id);
    const staffCookie = (id: number, rol: string) => 'petran_staff=' + jwt.sign({ sub: id, rol }, process.env.ADMIN_JWT_SECRET!);
    const admin = staffCookie(adminId, 'admin');
    const inspector = staffCookie(inspectorId, 'inspector');
    const other = staffCookie(otherId, 'inspector');
    async function invoke(route: string, method: string, cookie = '', body?: unknown, id?: number, queryString = '', expected = 200) {
      const url = `http://localhost/api/${route.replace('[id]', String(id))}${queryString}`;
      const req = new NextRequest(url, { method, headers: { cookie, 'content-type': 'application/json' }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
      const handlers = await import(`../app/api/${route}/route.ts`);
      const response = await handlers[method](req, { params: Promise.resolve({ id: String(id) }) });
      const json = await response.json();
      assert.equal(response.status, expected, `${method} ${url}: ${JSON.stringify(json)}`);
      return { json, response };
    }
    let empresaId: number, truckId: number, inspectionId: number, cliente: string;
    const chileToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

    await t.test('login, company/PIN, fleet, atomic photo upsert and tenant isolation', async () => {
      await invoke('staff/login', 'POST', '', { email: 'inspector@example.test', password: 'wrong' }, undefined, '', 401);
      const login = await invoke('staff/login', 'POST', '', { email: 'inspector@example.test', password: 'test-password' });
      assert.match(login.response.headers.get('set-cookie')!, /petran_staff=/);
      await invoke('admin/login', 'POST', '', { email: 'admin@example.test', password: 'test-password' });
      const company = await invoke('empresas', 'POST', '', { nombre: 'Prueba', rut: '76.000.000-1', pin: '9482', prioridad_frio: true });
      empresaId = company.json.id;
      const loginCliente = await invoke('cliente/login', 'POST', '', { rut: '76.000.000-1', pin: '9482' });
      cliente = loginCliente.response.headers.get('set-cookie')!.split(';')[0];
      const fleet = await invoke('fleet', 'POST', cliente, { camiones: [{ patente: 'ab cd12', carroceria: 'camion_con_carro', anio: 2023 }] });
      truckId = fleet.json.insertedTrucks[0].id;
      assert.equal(fleet.json.insertedTrucks[0].patente, 'ABCD12');
      await invoke('fleet', 'PUT', cliente, { truckId, marca: 'Volvo', modelo: 'FH', anio: 2023 });
      for (const url of ['https://example.test/one.jpg','https://example.test/two.jpg']) await invoke('truck-photo', 'POST', cliente, { camionId: truckId, url });
      const trucks = await invoke('fleet', 'GET', cliente);
      assert.equal(trucks.json.trucks[0].foto_url, 'https://example.test/two.jpg');
      await invoke('truck', 'GET', cliente, undefined, undefined, `?empresaId=${empresaId}`);
      await invoke('truck', 'GET', '', undefined, undefined, `?empresaId=${empresaId}`, 403);
      const foreign = 'petran_cliente=' + jwt.sign({ empresaId: empresaId + 100 }, process.env.CLIENTE_JWT_SECRET!);
      await invoke('truck-photo', 'POST', foreign, { camionId: truckId, url: 'https://example.test/x.jpg' }, undefined, '', 403);
      const dup = await invoke('fleet', 'POST', cliente, { camiones: [{ patente: 'ABCD12', carroceria: 'camion_con_carro' }] });
      assert.deepEqual(dup.json.duplicates, ['ABCD12']);
      await invoke('empresas', 'GET', '', undefined, undefined, '', 401);
      await invoke('empresas', 'GET', admin);
      await invoke('empresas', 'GET', admin, undefined, undefined, '?rut=76.000.000-1');
    });
    await t.test('agenda filters, Chile dates, duplicate constraint and inspector reads', async () => {
      await invoke('admin/inspecciones', 'POST', admin, { camionId: truckId, inspectorId, fechaProgramada: `${chileToday}T10:00` });
      inspectionId = (await query('SELECT id FROM inspecciones WHERE camion_id=$1', [truckId])).rows[0].id as number;
      for (const fechaProgramada of [chileToday, `${chileToday}T00:00`, `${chileToday}T09:00:00`]) {
        await invoke('admin/inspecciones/[id]', 'PATCH', admin, { action: 'REAGENDAR', fechaProgramada, inspectorId }, inspectionId);
        assert.equal((await invoke('inspector/inspecciones/hoy', 'GET', inspector)).json.data.length, 1);
      }
      await invoke('admin/inspecciones/[id]', 'PATCH', admin, { action: 'REAGENDAR', fechaProgramada: '2026-02-30', inspectorId }, inspectionId, '', 400);
      for (const estado of ['PROGRAMADA','VENCIDA','SIN_AGENDA']) {
        await invoke('admin/inspecciones', 'GET', admin, undefined, undefined, `?estado=${estado}&patente=ABC`);
        await invoke('admin/camiones', 'GET', admin, undefined, undefined, `?estado=${estado}&patente=ABCD12`);
      }
      await invoke('admin/inspecciones', 'POST', admin, { camionId: truckId, inspectorId, fechaProgramada: `${chileToday}T11:00` }, undefined, '', 400);
      await invoke('inspector/me', 'GET', inspector);
      const today = await invoke('inspector/inspecciones/hoy', 'GET', inspector);
      assert.equal(today.json.data.length, 1);
      assert.equal((await invoke('inspector/inspecciones/hoy', 'GET', other)).json.data.length, 0);
      await invoke('inspector/inspecciones', 'GET', inspector);
      await invoke('inspector/inspecciones/camion/[id]', 'GET', inspector, undefined, truckId);
      await invoke('admin/inspecciones/[id]', 'PATCH', admin, { action: 'REAGENDAR', fechaProgramada: '2000-01-01T10:00', inspectorId }, inspectionId, '', 400);
    });
    await t.test('inspection saves atomically, retries without duplicate evidence, and rejects other inspectors', async () => {
      const body = { respuestas: [{ itemId: 'N1-01', estado: 'no_cumple', descripcionFalla: 'Falla', nivel: 1, seccion: 'Frenos' }], notaFinal: 70, fotos_evidencia: [{ url: 'https://example.test/evidence.jpg', itemId: 'N1-01' }] };
      await invoke('inspector/inspecciones/[id]/completar', 'POST', other, body, truckId, '', 404);
      for (let i=0;i<2;i++) await invoke('inspector/inspecciones/[id]/completar', 'POST', inspector, body, truckId);
      assert.equal((await query('SELECT count(*)::int AS n FROM detalle_inspeccion')).rows[0].n, 1);
      assert.equal((await query('SELECT count(*)::int AS n FROM fotos_inspeccion')).rows[0].n, 1);
      const fail = { ...body, respuestas: [{ itemId: 'N1-02', estado: 'cumple' }], fotos_evidencia: [{ url: 'https://example.test/bad.jpg', itemId: 'not-an-item' }] };
      await invoke('inspector/inspecciones/[id]/completar', 'POST', inspector, fail, truckId, '', 400);
      assert.equal((await query('SELECT count(*)::int AS n FROM detalle_inspeccion')).rows[0].n, 1, 'rollback removes partial details');
      const review = await invoke('admin/inspecciones/[id]/review', 'GET', admin, undefined, inspectionId);
      assert.equal(review.json.data.detalles[0].itemId, 'N1-01');
      const detailId = review.json.data.detalles[0].id;
      await invoke('admin/inspecciones/[id]/review', 'POST', admin, { action: 'ACEPTAR_OK', items: [{ id: detailId, estadoAdmin: 'aprobado', comentarioAdmin: 'Revisado' }], edits: { nota: 100 } }, inspectionId);
      await invoke('inspector/inspecciones/[id]/completar', 'POST', inspector, body, truckId, '', 404);
      const stats = await invoke('admin/dashboard-stats', 'GET', admin);
      assert.equal(stats.json.resultados.aprobado, 1);
      const done = await invoke('admin/inspecciones/realizadas', 'GET', admin, undefined, undefined, `?from=${chileToday}&to=${chileToday}&patente=abc&empresa=Prueba`);
      assert.equal(done.json.rows[0].empresaNombre, 'Prueba');
      await invoke('inspector/inspecciones/camion/[id]', 'GET', inspector, undefined, truckId);
    });
    await t.test('reagenda, notifications, KPI counts, user/company updates and password/PIN resets', async () => {
      await invoke('admin/inspecciones/[id]/review', 'POST', admin, { action: 'REAGENDAR', reagenda: { fechaProgramada: '2099-01-01T09:00', inspectorId, observaciones: 'Volver' } }, inspectionId);
      const notifications = await invoke('inspector/notificaciones', 'GET', inspector, undefined, undefined, '?limit=10&unread=1');
      assert.equal(notifications.json.unread, 1);
      await invoke('inspector/notificaciones', 'PATCH', inspector, { ids: notifications.json.data.map((n: any)=>n.id) });
      assert.equal((await invoke('inspector/notificaciones', 'GET', inspector)).json.unread, 0);
      await invoke('inspector/notificaciones', 'PATCH', inspector, { all: true });
      const pending = (await query("SELECT id FROM inspecciones WHERE estado='PROGRAMADA'")).rows[0].id as number;
      await invoke('admin/inspecciones/[id]', 'PATCH', admin, { action: 'REAGENDAR', fechaProgramada: '2099-01-02T10:30', inspectorId }, pending);
      const params = new URLSearchParams({ todayStart: `${chileToday}T00:00`, todayEnd: `${chileToday}T23:59`, weekStart: `${chileToday}T00:00`, weekEnd: '2099-12-31T23:59', nowLocal: `${chileToday}T12:00` });
      const kpis = await invoke('admin/kpis', 'GET', admin, undefined, undefined, `?${params}`);
      assert.equal(kpis.json.data.camionesTotal, 1);
      await invoke('admin/inspectores', 'GET', admin);
      const created = await invoke('admin/inspectores', 'POST', admin, { nombre: 'Nuevo', email: 'nuevo@example.test', passwordInicial: 'other-password' }, undefined, '', 201);
      await invoke('admin/inspectores/[id]', 'PATCH', admin, { nombre: 'Actualizado', email: 'updated@example.test', activo: false }, created.json.id);
      await invoke('admin/inspectores/[id]/reset-password', 'POST', admin, { newPassword: 'changed-test-password' }, created.json.id);
      await invoke('admin/empresas', 'GET', admin);
      await invoke('admin/empresas/[id]', 'PATCH', admin, { nombre: 'Actualizada', rut: '76.000.000-1', email_contacto: 'contact@example.test' }, empresaId);
      await invoke('admin/empresas/[id]/reset-pin', 'POST', admin, {}, empresaId);
      await invoke('admin/inspecciones/[id]', 'PATCH', admin, { action: 'CANCELAR' }, pending);
    });
    await t.test('legacy form writes the canonical schema and repository follows suppliers', async () => {
      await invoke('admin/inspecciones', 'POST', admin, { camionId: truckId, inspectorId, fechaProgramada: `${chileToday}T10:00` });
      const id = (await query("SELECT id FROM inspecciones WHERE estado='PROGRAMADA'")).rows[0].id;
      await invoke('inspector/inspecciones', 'POST', inspector, { camionId: truckId, inspeccionProgramadaId: id, nota: 100, detalles: [{ itemId: 'LEGACY', estado: 'cumple', fotos: [{ base64: Buffer.from('image').toString('base64'), nombreArchivo: 'legacy.jpg' }] }] }, undefined, '', 201);
      const repo = new SqlCamionRepository();
      assert.equal((await repo.findById(truckId))!.empresaId, empresaId);
      assert.equal((await repo.findAll(empresaId)).length, 1);
      const created = await repo.create({ patente: 'NEW123', marca: 'Volvo', modelo: 'FH', anio: 2024, empresaId, estado: 'ACTIVO' });
      assert.equal(created.empresaId, empresaId);
    });
    await t.test('admin company and fleet management stays scoped and validates real form values', async () => {
      await invoke('admin/empresas', 'POST', inspector, { nombre: 'Denied', rut: 'denied', pin: '1234' }, undefined, '', 401);
      const company = await invoke('admin/empresas', 'POST', admin, { nombre: 'Admin company', rut: '77.123.456-0', pin: '1234', direccion: 'Santiago' });
      const eid = company.json.id;
      await invoke('admin/empresas/[id]', 'PATCH', admin, { nombre: '' }, eid, '', 400);
      await invoke('admin/empresas/[id]', 'PATCH', admin, { direccion: 'Nueva dirección', productos_transportados: 'Carga', prioridad_frio: true }, eid);
      assert.equal((await query('SELECT prioridad_frio FROM empresas WHERE id=$1', [eid])).rows[0].prioridad_frio, true);
      await invoke('admin/empresas/[id]/flota', 'GET', cliente, undefined, eid, '', 401);
      await invoke('admin/empresas/[id]/flota', 'GET', inspector, undefined, eid, '', 401);
      const added = await invoke('admin/empresas/[id]/flota', 'POST', admin, { camiones: [{ patente: 'ADMN12', carroceria: 'CAMION_PAQUETERO', anio: 2024 }] }, eid);
      const tid = added.json.insertedTrucks[0].id;
      assert.equal((await invoke('admin/empresas/[id]/flota', 'GET', admin, undefined, eid)).json.trucks[0].carroceria, 'camion_paquetero');
      await invoke('admin/empresas/[id]/flota', 'PUT', admin, { truckId: tid, marca: 'Volvo', modelo: 'FH', anio: 2022, carroceria: 'CAMARA_DE_FRIO' }, eid);
      await invoke('admin/empresas/[id]/flota', 'PUT', admin, { truckId, marca: 'Cross company' }, eid, '', 403);
      await invoke('fleet', 'PUT', cliente, { truckId: tid, marca: 'Cross company' }, undefined, '', 403);
      await invoke('fleet', 'PUT', cliente, { truckId, anio: 'invalid' }, undefined, '', 400);
      await invoke('fleet', 'POST', cliente, { camiones: [{ patente: 'BAD123', carroceria: 'CAMARA_DE_FRIO', anio: 'invalid' }] }, undefined, '', 400);
      await invoke('admin/inspecciones', 'POST', admin, { camionId: tid, fechaProgramada: '2000-01-01' }, undefined, '', 400);
      await invoke('admin/inspecciones', 'POST', admin, { camionId: tid, fechaProgramada: chileToday });
    });
    await t.test('private photo uploads store actual bytes and deny cross-company reads', async () => {
      const { POST } = await import('../app/api/truck-photo/route');
      const { readPhoto } = await import('../lib/storage');
      const nativeFetch = global.fetch;
      process.env.SUPABASE_URL = 'https://storage.example.test';
      process.env.SUPABASE_SECRET_KEY = 'test-private-key';
      const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64');
      const calls: string[] = [];
      global.fetch = async (input, options) => {
        calls.push(String(input));
        if (options?.method === 'POST') {
          assert.deepEqual(Buffer.from(options.body as Uint8Array), png);
          return Response.json({ Key: 'stored' });
        }
        return new Response(png, { headers: { 'Content-Type': 'image/png' } });
      };
      try {
        const form = new FormData(); form.append('camionId', String(truckId)); form.append('file', new File([png], 'qa.png', { type: 'image/png' }));
        const result = await POST(new NextRequest('http://localhost/api/truck-photo', { method: 'POST', headers: { cookie: cliente }, body: form }));
        assert.equal(result.status, 200);
        const photo = await result.json();
        assert.match(photo.data.url, /^\/api\/media\/empresas\//);
        const path = photo.data.url.replace('/api/media/', '').split('/');
        const media = await readPhoto(new NextRequest('http://localhost'+photo.data.url, { headers: { cookie: cliente } }), path);
        assert.equal(media.status, 200);
        assert.deepEqual(Buffer.from(await media.arrayBuffer()), png);
        assert.equal(media.headers.get('cache-control'), 'private, no-store');
        const denied = await readPhoto(new NextRequest('http://localhost'+photo.data.url), path);
        assert.equal(denied.status, 403);
        assert.equal(calls.length, 2);
      } finally { global.fetch = nativeFetch; }
    });
    await t.test('RLS and privileges deny browser roles access to sensitive tables', async () => {
      const tables = await query("SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public'");
      assert.equal(tables.rows.length, 9);
      assert.ok(tables.rows.every((r: any)=>r.rowsecurity));
      await db.exec('SET ROLE petran_backend');
      assert.equal((await query('SELECT count(*)::int AS n FROM empresas')).rows[0].n, 2);
      await assert.rejects(() => query('DELETE FROM usuarios'), /permission denied/);
      await db.exec('RESET ROLE');
      for (const role of ['anon','authenticated']) {
        await db.exec(`SET ROLE ${role}`);
        await assert.rejects(()=>query('SELECT password_hash FROM usuarios'), /permission denied/);
        await db.exec('RESET ROLE');
      }
    });
  } finally { global.__postgresPool = undefined; await db.close(); }
});
