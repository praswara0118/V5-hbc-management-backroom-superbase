-- =============================================================================
-- HBC BACKROOM MANAGEMENT © 2026 - SUPABASE (POSTGRESQL) SCHEMA MIGRATION
-- Jalankan seluruh script SQL ini di Supabase Dashboard -> SQL Editor
-- Script ini 100% IDEMPOTENT (aman dijalankan berulang kali tanpa error)
-- =============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABEL SUPPLIERS (Daftar Pemasok / Distributor)
CREATE TABLE IF NOT EXISTS suppliers (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL DEFAULT '',
    name TEXT NOT NULL,
    pic_name TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    address TEXT DEFAULT '',
    default_due_days INTEGER NOT NULL DEFAULT 7,
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexing untuk pencarian cepat
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);
CREATE INDEX IF NOT EXISTS idx_suppliers_code ON suppliers(code);

-- 3. TABEL MASTER PRODUCTS (Database Master Barang Consignment & Outright)
CREATE TABLE IF NOT EXISTS master_products (
    id TEXT PRIMARY KEY,
    barcode TEXT NOT NULL,
    item_name TEXT NOT NULL,
    department TEXT NOT NULL DEFAULT '',
    sku TEXT DEFAULT '',
    supplier_name TEXT NOT NULL DEFAULT '',
    supplier_phone TEXT DEFAULT '',
    supplier_email TEXT DEFAULT '',
    unit TEXT DEFAULT 'Pcs',
    procurement_type TEXT NOT NULL DEFAULT 'OUTRIGHT', -- 'OUTRIGHT' | 'CONSIGNMENT'
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexing barcode untuk pencarian instan hardware scanner (<1ms)
CREATE INDEX IF NOT EXISTS idx_master_products_barcode ON master_products(barcode);
CREATE INDEX IF NOT EXISTS idx_master_products_item_name ON master_products(item_name);
CREATE INDEX IF NOT EXISTS idx_master_products_department ON master_products(department);
CREATE INDEX IF NOT EXISTS idx_master_products_procurement ON master_products(procurement_type);

-- 4. TABEL RETURN ITEMS (Barang Retur Masuk & Status Tenggat)
CREATE TABLE IF NOT EXISTS return_items (
    id TEXT PRIMARY KEY,
    barcode TEXT NOT NULL,
    item_name TEXT NOT NULL,
    sku TEXT DEFAULT '',
    supplier_id TEXT DEFAULT NULL,
    supplier_name TEXT NOT NULL,
    supplier_pic TEXT DEFAULT '',
    supplier_phone TEXT DEFAULT '',
    supplier_email TEXT DEFAULT '',
    quantity NUMERIC NOT NULL DEFAULT 1,
    unit TEXT NOT NULL DEFAULT 'Pcs',
    category TEXT NOT NULL DEFAULT '',
    return_reason TEXT NOT NULL,
    condition_notes TEXT DEFAULT '',
    received_date TEXT NOT NULL DEFAULT '',
    due_date TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'Menunggu Pengambilan',
    location_slot TEXT NOT NULL DEFAULT '',
    estimated_value NUMERIC DEFAULT 0,
    picked_up_date TEXT DEFAULT NULL,
    picked_up_by TEXT DEFAULT NULL,
    warning_history JSONB NOT NULL DEFAULT '[]'::jsonb,
    photo_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexing return_items
CREATE INDEX IF NOT EXISTS idx_return_items_barcode ON return_items(barcode);
CREATE INDEX IF NOT EXISTS idx_return_items_status ON return_items(status);
CREATE INDEX IF NOT EXISTS idx_return_items_due_date ON return_items(due_date);
CREATE INDEX IF NOT EXISTS idx_return_items_supplier_id ON return_items(supplier_id);
CREATE INDEX IF NOT EXISTS idx_return_items_created_at ON return_items(created_at DESC);

-- 5. TABEL STORAGE LOCATIONS (Pemetaan Rak & Lokasi Penyimpanan HBC)
CREATE TABLE IF NOT EXISTS storage_locations (
    id TEXT PRIMARY KEY,
    barcode TEXT NOT NULL,
    sku TEXT DEFAULT '',
    item_name TEXT NOT NULL,
    department TEXT DEFAULT '',
    supplier_name TEXT DEFAULT '',
    procurement_type TEXT DEFAULT 'OUTRIGHT',
    storage_zone TEXT NOT NULL,
    aisle_rack TEXT NOT NULL,
    shelf_level TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    photo_url TEXT,
    updated_by TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexing storage_locations
CREATE INDEX IF NOT EXISTS idx_storage_locations_barcode ON storage_locations(barcode);
CREATE INDEX IF NOT EXISTS idx_storage_locations_zone ON storage_locations(storage_zone);
CREATE INDEX IF NOT EXISTS idx_storage_locations_aisle ON storage_locations(aisle_rack);

-- 6. TABEL SYSTEM METADATA (Pelacakan Inisialisasi & Migrasi)
CREATE TABLE IF NOT EXISTS system_metadata (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 7. ENABLE ROW LEVEL SECURITY (RLS)
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_metadata ENABLE ROW LEVEL SECURITY;

-- 8. RLS POLICIES (Akses Terbuka untuk Operasional Tim Gudang/Backroom dengan Anon & Authenticated Key)
DROP POLICY IF EXISTS "Allow all access to suppliers" ON suppliers;
CREATE POLICY "Allow all access to suppliers" ON suppliers
    FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to master_products" ON master_products;
CREATE POLICY "Allow all access to master_products" ON master_products
    FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to return_items" ON return_items;
CREATE POLICY "Allow all access to return_items" ON return_items
    FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to storage_locations" ON storage_locations;
CREATE POLICY "Allow all access to storage_locations" ON storage_locations
    FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to system_metadata" ON system_metadata;
CREATE POLICY "Allow all access to system_metadata" ON system_metadata
    FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- 9. SUPABASE REALTIME CONFIGURATION (Idempotent: aman dijalankan berulang kali)
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

-- REPLICA IDENTITY FULL agar payload event UPDATE dan DELETE menyertakan data lengkap
ALTER TABLE suppliers REPLICA IDENTITY FULL;
ALTER TABLE master_products REPLICA IDENTITY FULL;
ALTER TABLE return_items REPLICA IDENTITY FULL;
ALTER TABLE storage_locations REPLICA IDENTITY FULL;
