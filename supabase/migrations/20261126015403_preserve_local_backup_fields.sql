-- Preserve additional fields from the user's PostgreSQL backup without replacing tables.
BEGIN;
ALTER TABLE public.empresas ADD COLUMN activo boolean NOT NULL DEFAULT true;
ALTER TABLE public.empresas ADD COLUMN fecha_creacion timestamp NOT NULL DEFAULT localtimestamp;
ALTER TABLE public.proveedores ADD COLUMN activo boolean NOT NULL DEFAULT true;
ALTER TABLE public.proveedores ADD COLUMN fecha_creacion timestamp NOT NULL DEFAULT localtimestamp;
ALTER TABLE public.camiones ADD COLUMN empresa_id integer REFERENCES public.empresas(id);
ALTER TABLE public.camiones ADD COLUMN activo boolean NOT NULL DEFAULT true;
ALTER TABLE public.camiones ADD COLUMN fecha_creacion timestamp NOT NULL DEFAULT localtimestamp;
CREATE INDEX camiones_empresa_idx ON public.camiones(empresa_id);
-- The source database has globally unique license plates.
ALTER TABLE public.camiones ADD CONSTRAINT camiones_patente_unique UNIQUE (patente);
ALTER TABLE public.inspecciones ADD COLUMN tipo_inspeccion text;
ALTER TABLE public.inspecciones ADD COLUMN fecha_creacion timestamp NOT NULL DEFAULT localtimestamp;
ALTER TABLE public.usuarios ADD COLUMN fecha_creacion timestamp NOT NULL DEFAULT localtimestamp;
ALTER TABLE public.fotos_inspeccion ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
COMMIT;
