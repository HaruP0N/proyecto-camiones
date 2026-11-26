-- Read-only PostgreSQL inspection, before reconciling an existing Supabase database.
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position;
SELECT conrelid::regclass AS table_name, conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint WHERE connamespace = 'public'::regnamespace;
SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname = 'public';
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
SELECT schemaname, tablename, policyname, roles, cmd FROM pg_policies WHERE schemaname = 'public';
