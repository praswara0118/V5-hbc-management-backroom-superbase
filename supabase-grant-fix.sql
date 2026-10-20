-- =============================================================================
-- HBC BACKROOM MANAGEMENT © 2026
-- SOLUSI RESMI: PERBAIKAN HAK AKSES POSTGRESQL (ERROR 42501 PERMISSION DENIED)
-- Jalankan seluruh script ini di Supabase Dashboard -> SQL Editor -> Run
-- =============================================================================

-- 1. Berikan izin penggunaan skema public ke role anon, authenticated, dan service_role
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- 2. Berikan izin penuh (SELECT, INSERT, UPDATE, DELETE) pada tabel-tabel utama
GRANT ALL ON TABLE public.suppliers TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.master_products TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.return_items TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.storage_locations TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.system_metadata TO anon, authenticated, service_role;

-- 3. Berikan izin menyeluruh untuk semua tabel dan sequence yang ada di skema public
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

-- 4. Tetapkan izin default agar tabel baru otomatis dapat diakses oleh anon & authenticated
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;

-- 5. Konfigurasi Row Level Security (RLS) & Kebijakan Terbuka untuk Tim Operasional Gudang/Backroom
ALTER TABLE IF EXISTS public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.master_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.storage_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.system_metadata ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to suppliers" ON public.suppliers;
CREATE POLICY "Allow all access to suppliers" ON public.suppliers
    FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to master_products" ON public.master_products;
CREATE POLICY "Allow all access to master_products" ON public.master_products
    FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to return_items" ON public.return_items;
CREATE POLICY "Allow all access to return_items" ON public.return_items
    FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to storage_locations" ON public.storage_locations;
CREATE POLICY "Allow all access to storage_locations" ON public.storage_locations
    FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to system_metadata" ON public.system_metadata;
CREATE POLICY "Allow all access to system_metadata" ON public.system_metadata
    FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 6. Konfigurasi Supabase Realtime agar sinkronisasi multi-device aktif
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'suppliers'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE suppliers;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'master_products'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE master_products;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'return_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE return_items;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'storage_locations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE storage_locations;
  END IF;
END $$;

-- 7. REPLICA IDENTITY FULL agar perubahan data realtime mengirimkan seluruh baris
ALTER TABLE IF EXISTS public.suppliers REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.master_products REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.return_items REPLICA IDENTITY FULL;
ALTER TABLE IF EXISTS public.storage_locations REPLICA IDENTITY FULL;
