-- Hosted Supabase provisioning: create a limited login with a generated credential.
-- No credential is embedded in this migration or in source control.
-- Vault must be available. Existing credentials are never replaced.
BEGIN;
DO $$
DECLARE runtime_password text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'petran_app') THEN
    RAISE EXCEPTION 'petran_app already exists; inspect its grants before provisioning';
  END IF;
  IF EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'petran_app_database_password') THEN
    RAISE EXCEPTION 'Application secret already exists; refusing to overwrite it';
  END IF;
  runtime_password := encode(extensions.gen_random_bytes(32), 'hex');
  EXECUTE format('CREATE ROLE petran_app LOGIN INHERIT NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD %L', runtime_password);
  GRANT petran_backend TO petran_app;
  GRANT CONNECT ON DATABASE postgres TO petran_app;
  PERFORM vault.create_secret(runtime_password, 'petran_app_database_password', 'Limited PostgreSQL login for proyecto-camiones. Copy only to protected server environment variables.');
END $$;
COMMIT;
