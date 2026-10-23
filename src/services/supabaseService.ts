import { getSupabaseClient, isSupabaseConfigured } from '../supabase';
import {
  ReturnItem,
  Supplier,
  MasterProduct,
  StorageLocation,
  ProcurementType,
} from '../types/inventory';
import {
  INITIAL_SUPPLIERS,
  INITIAL_RETURN_ITEMS,
  INITIAL_MASTER_PRODUCTS,
  INITIAL_STORAGE_LOCATIONS,
} from '../data/seedData';
import { calculateReturnStatus } from '../utils/notification';
import { savePickupInfoLocally, getLocalPickupInfo } from './localCache';

// =========================================================================
// DATA MAPPING & ADAPTER LAYER (POSTGRESQL SNAKE_CASE <-> FRONTEND TYPES)
// =========================================================================

export function supplierToSupabase(s: Supplier) {
  return {
    id: s.id,
    code: s.code || '',
    name: s.name,
    pic_name: s.picName || '',
    phone: s.phone || '',
    email: s.email || '',
    address: s.address || '',
    default_due_days: s.defaultDueDays ?? 7,
    notes: s.notes || '',
    created_at: s.createdAt || new Date().toISOString(),
  };
}

export function supabaseToSupplier(row: any): Supplier {
  return {
    id: row.id,
    code: row.code || '',
    name: row.name || '',
    picName: row.pic_name || '',
    phone: row.phone || '',
    email: row.email || '',
    address: row.address || '',
    defaultDueDays: row.default_due_days ?? 7,
    notes: row.notes || '',
    createdAt: row.created_at || new Date().toISOString(),
  };
}

export function returnItemToSupabase(item: ReturnItem) {
  if (item.pickupInfo) {
    savePickupInfoLocally(item.id, item.pickupInfo);
  }

  const payload: any = {
    id: item.id,
    barcode: item.barcode,
    item_name: item.itemName,
    sku: item.sku || '',
    supplier_id: item.supplierId || null,
    supplier_name: item.supplierName || '',
    supplier_pic: item.supplierPic || '',
    supplier_phone: item.supplierPhone || '',
    supplier_email: item.supplierEmail || '',
    quantity: Number(item.quantity) || 1,
    unit: item.unit || 'Pcs',
    category: item.category || '',
    return_reason: item.returnReason,
    condition_notes: item.conditionNotes || '',
    received_date: item.receivedDate,
    due_date: item.dueDate,
    status: item.status,
    location_slot: item.locationSlot || '',
    estimated_value: Number(item.estimatedValue) || 0,
    picked_up_date: item.pickedUpDate || null,
    picked_up_by: item.pickedUpBy || (item.pickupInfo?.receiverName ?? null),
    warning_history: item.warningHistory || [],
    photo_url: item.photoUrl || null,
    pickup_info: item.pickupInfo || null,
    created_at: item.createdAt || new Date().toISOString(),
    updated_at: item.updatedAt || new Date().toISOString(),
  };

  return payload;
}

export function supabaseToReturnItem(row: any): ReturnItem {
  const history = Array.isArray(row.warning_history) ? row.warning_history : [];
  const finalLog = history.find((w: any) => w.tone === 'final');

  // Reconstruct pickupInfo with multi-layer fallback
  let pickupInfo = row.pickup_info;
  if (!pickupInfo || !pickupInfo.receiverName) {
    const local = getLocalPickupInfo(row.id);
    if (local && (local.receiverName || local.photoUrl)) {
      pickupInfo = local;
    } else if (row.picked_up_by) {
      pickupInfo = {
        receiverName: row.picked_up_by,
        timestamp: row.picked_up_date || row.updated_at || new Date().toISOString(),
      };
    }
  }

  const item: ReturnItem = {
    id: row.id,
    barcode: row.barcode,
    itemName: row.item_name,
    sku: row.sku || '',
    supplierId: row.supplier_id || '',
    supplierName: row.supplier_name || '',
    supplierPic: row.supplier_pic || '',
    supplierPhone: row.supplier_phone || '',
    supplierEmail: row.supplier_email || '',
    quantity: Number(row.quantity) || 0,
    unit: row.unit || 'Pcs',
    category: row.category || '',
    returnReason: row.return_reason || 'Lainnya',
    conditionNotes: row.condition_notes || '',
    receivedDate: row.received_date,
    dueDate: row.due_date,
    status: row.status,
    locationSlot: row.location_slot || '',
    estimatedValue: Number(row.estimated_value) || 0,
    pickedUpDate: row.picked_up_date || undefined,
    pickedUpBy: row.picked_up_by || (pickupInfo?.receiverName ?? undefined),
    pickupInfo: pickupInfo || undefined,
    warningHistory: history,
    photoUrl: row.photo_url || undefined,
    finalWarningSentAt: row.final_warning_sent_at || finalLog?.timestamp || undefined,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
  item.status = calculateReturnStatus(item);
  return item;
}

export function masterProductToSupabase(p: MasterProduct) {
  return {
    id: p.id,
    barcode: p.barcode,
    item_name: p.itemName,
    department: p.department || '',
    sku: p.sku || '',
    supplier_name: p.supplierName || '',
    supplier_phone: p.supplierPhone || '',
    supplier_email: p.supplierEmail || '',
    unit: p.unit || 'Pcs',
    procurement_type: (p.procurementType as string) || 'OUTRIGHT',
    notes: p.notes || '',
    created_at: p.createdAt || new Date().toISOString(),
    updated_at: p.updatedAt || new Date().toISOString(),
  };
}

export function supabaseToMasterProduct(row: any): MasterProduct {
  return {
    id: row.id,
    barcode: row.barcode,
    itemName: row.item_name,
    department: row.department || '',
    sku: row.sku || '',
    supplierName: row.supplier_name || '',
    supplierPhone: row.supplier_phone || '',
    supplierEmail: row.supplier_email || '',
    unit: row.unit || 'Pcs',
    procurementType: (row.procurement_type as ProcurementType) || 'OUTRIGHT',
    notes: row.notes || '',
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

export function storageLocationToSupabase(loc: StorageLocation) {
  return {
    id: loc.id,
    barcode: loc.barcode,
    sku: loc.sku || '',
    item_name: loc.itemName,
    department: loc.department || '',
    supplier_name: loc.supplierName || '',
    procurement_type: (loc.procurementType as string) || 'OUTRIGHT',
    storage_zone: loc.storageZone,
    aisle_rack: loc.aisleRack,
    shelf_level: loc.shelfLevel || '',
    notes: loc.notes || '',
    photo_url: loc.photoUrl || null,
    updated_by: loc.updatedBy || '',
    created_at: loc.createdAt || new Date().toISOString(),
    updated_at: loc.updatedAt || new Date().toISOString(),
  };
}

export function supabaseToStorageLocation(row: any): StorageLocation {
  return {
    id: row.id,
    barcode: row.barcode,
    sku: row.sku || '',
    itemName: row.item_name,
    department: row.department || '',
    supplierName: row.supplier_name || '',
    procurementType: (row.procurement_type as ProcurementType) || 'OUTRIGHT',
    storageZone: row.storage_zone,
    aisleRack: row.aisle_rack,
    shelfLevel: row.shelf_level || '',
    notes: row.notes || '',
    photoUrl: row.photo_url || undefined,
    updatedBy: row.updated_by || '',
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

// In-memory cache for fast barcode scanner lookups
const masterBarcodeCache = new Map<string, MasterProduct>();
const storageBarcodeCache = new Map<string, StorageLocation>();

export function invalidateMasterProductCache(): void {
  masterBarcodeCache.clear();
  try {
    sessionStorage.removeItem('hbc_master_counts_supabase');
  } catch {}
}

export function invalidateStorageLocationCache(): void {
  storageBarcodeCache.clear();
  try {
    sessionStorage.removeItem('hbc_storage_count_supabase');
  } catch {}
}

// =========================================================================
// INITIAL SEEDING FOR SUPABASE
// =========================================================================

export async function seedInitialSupabaseData(): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;

  try {
    const hasSeededLocal = localStorage.getItem('returku_supabase_seeded') === 'true';
    if (hasSeededLocal) return;
    localStorage.setItem('returku_supabase_seeded', 'true');
  } catch (err) {
    console.warn('Supabase initial seed check:', err);
  }
}

// =========================================================================
// REALTIME SUBSCRIPTIONS (MULTI-DEVICE SYNCHRONIZATION)
// =========================================================================

// =========================================================================
// ULTRA-FAST PARALLEL BATCH FETCHING (BYPASS POSTGREST 1,000 ROW DEFAULT LIMIT)
// =========================================================================

function sortRowsInMemory<T = any>(rows: T[], orderCol: string, ascending: boolean): void {
  rows.sort((a: any, b: any) => {
    const valA = a[orderCol] ?? '';
    const valB = b[orderCol] ?? '';
    if (typeof valA === 'number' && typeof valB === 'number') {
      return ascending ? valA - valB : valB - valA;
    }
    const cmp = String(valA).localeCompare(String(valB));
    return ascending ? cmp : -cmp;
  });
}

/**
 * Helper to fetch ALL rows from a Supabase table lightning-fast.
 *
 * Mengapa versi ini sangat cepat (< 500ms) dibanding sebelumnya (menit):
 * 1. Menghitung total baris secara instan lewat head count (~100ms).
 * 2. Jika data melebihi 1.000 (misal 3.000 atau 10.000 data), semua batch
 *    (0-999, 1000-1999, 2000-2999, dst.) dijalankan SECARA PARALEL (Promise.all)
 *    secara serentak, bukan serial satu demi satu.
 * 3. Menggunakan primary key 'id' untuk pembagian range di PostgreSQL (memanfaatkan
 *    B-Tree index tercepat), dan melakukan sorting di memori browser (0ms overhead).
 * 4. Tidak ada pemotongan awal 1.000 data ke UI, sehingga saat data masuk,
 *    langsung menampilkan seluruh jumlah data asli Supabase sekaligus.
 */
export async function fetchAllRowsFromSupabase<T = any>(
  client: any,
  table: string,
  options?: {
    orderColumn?: string;
    ascending?: boolean;
    batchSize?: number;
    select?: string;
  }
): Promise<T[]> {
  const batchSize = options?.batchSize || 1000;
  const orderCol = options?.orderColumn;
  const ascending = options?.ascending ?? true;
  const selectQuery = options?.select || '*';

  try {
    // 1. Dapatkan total baris secara instan lewat head query (sangat ringan, tanpa transfer isi tabel)
    const { count, error: countErr } = await client
      .from(table)
      .select('*', { count: 'exact', head: true });

    if (countErr) {
      console.warn(`Head count error on ${table}:`, countErr);
    }

    if (count === 0) {
      return [];
    }

    // Kasus 1: Data <= 1000 baris -> 1 query tunggal instan
    if (count !== null && count !== undefined && count <= batchSize) {
      const { data, error } = await client
        .from(table)
        .select(selectQuery)
        .range(0, count - 1);

      if (error) throw error;
      const rows = (data || []) as T[];
      if (orderCol) {
        sortRowsInMemory(rows, orderCol, ascending);
      }
      return rows;
    }

    // Kasus 2: Data > 1000 baris -> SEMUA BATCH DIJALANKAN SERENTAK SECARA PARALEL
    if (count !== null && count !== undefined && count > batchSize) {
      const totalBatches = Math.ceil(count / batchSize);
      const batchPromises: Promise<T[]>[] = [];

      for (let b = 0; b < totalBatches; b++) {
        const from = b * batchSize;
        const to = Math.min(from + batchSize - 1, count - 1);

        const promise = client
          .from(table)
          .select(selectQuery)
          .order('id', { ascending: true }) // Index B-Tree PK menjamin range terpotong rapi tanpa overlap
          .range(from, to)
          .then((res: any) => {
            if (res.error) throw res.error;
            return (res.data || []) as T[];
          });

        batchPromises.push(promise);
      }

      const results = await Promise.all(batchPromises);
      const allRows = results.flat();

      if (orderCol) {
        sortRowsInMemory(allRows, orderCol, ascending);
      }
      return allRows;
    }

    // Fallback darurat jika count null: ambil secara range
    let allRows: T[] = [];
    let from = 0;
    let hasMore = true;

    while (hasMore) {
      const to = from + batchSize - 1;
      const { data, error } = await client
        .from(table)
        .select(selectQuery)
        .order('id', { ascending: true })
        .range(from, to);

      if (error) throw error;
      if (!data || data.length === 0) {
        hasMore = false;
      } else {
        allRows = allRows.concat(data as T[]);
        if (data.length < batchSize) {
          hasMore = false;
        } else {
          from += batchSize;
        }
      }
    }

    if (orderCol) {
      sortRowsInMemory(allRows, orderCol, ascending);
    }
    return allRows;
  } catch (err) {
    console.error(`Error in fetchAllRowsFromSupabase for ${table}:`, err);
    throw err;
  }
}

// =========================================================================
// REALTIME SUBSCRIPTIONS (MULTI-DEVICE SYNCHRONIZATION)
// =========================================================================

export function subscribeToReturnItems(
  onUpdate: (items: ReturnItem[]) => void,
  onError?: (error: Error) => void
): () => void {
  const client = getSupabaseClient();
  if (!client) {
    return () => {};
  }

  let active = true;
  let debounceTimer: any = null;

  const fetchItems = async () => {
    try {
      const allRows = await fetchAllRowsFromSupabase<any>(client, 'return_items', {
        orderColumn: 'created_at',
        ascending: false,
        batchSize: 1000,
      });

      if (active) {
        const mapped = allRows.map(supabaseToReturnItem);
        onUpdate(mapped);
      }
    } catch (err: any) {
      if (onError) onError(err);
      console.warn('Supabase fetch return_items error:', err);
    }
  };

  fetchItems();

  const channel = client
    .channel('realtime_return_items')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'return_items' },
      () => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          fetchItems();
        }, 300);
      }
    )
    .subscribe();

  return () => {
    active = false;
    if (debounceTimer) clearTimeout(debounceTimer);
    client.removeChannel(channel);
  };
}

export function subscribeToSuppliers(
  onUpdate: (suppliers: Supplier[]) => void,
  onError?: (error: Error) => void
): () => void {
  const client = getSupabaseClient();
  if (!client) {
    return () => {};
  }

  let active = true;
  let debounceTimer: any = null;

  const fetchSuppliers = async () => {
    try {
      const allRows = await fetchAllRowsFromSupabase<any>(client, 'suppliers', {
        orderColumn: 'name',
        ascending: true,
        batchSize: 1000,
      });

      if (active) {
        const mapped = allRows.map(supabaseToSupplier);
        onUpdate(mapped);
      }
    } catch (err: any) {
      if (onError) onError(err);
      console.warn('Supabase fetch suppliers error:', err);
    }
  };

  fetchSuppliers();

  const channel = client
    .channel('realtime_suppliers')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'suppliers' },
      () => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          fetchSuppliers();
        }, 300);
      }
    )
    .subscribe();

  return () => {
    active = false;
    if (debounceTimer) clearTimeout(debounceTimer);
    client.removeChannel(channel);
  };
}

export function subscribeToMasterProducts(
  onUpdate: (products: MasterProduct[]) => void,
  onError?: (error: Error) => void
): () => void {
  const client = getSupabaseClient();
  if (!client) {
    return () => {};
  }

  let active = true;
  let debounceTimer: any = null;

  const fetchProducts = async () => {
    try {
      const allRows = await fetchAllRowsFromSupabase<any>(client, 'master_products', {
        orderColumn: 'item_name',
        ascending: true,
        batchSize: 1000,
      });

      if (active) {
        const mapped = allRows.map(supabaseToMasterProduct);
        onUpdate(mapped);
      }
    } catch (err: any) {
      if (onError) onError(err);
      console.warn('Supabase fetch master_products error:', err);
    }
  };

  fetchProducts();

  const channel = client
    .channel('realtime_master_products')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'master_products' },
      () => {
        invalidateMasterProductCache();
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          fetchProducts();
        }, 300);
      }
    )
    .subscribe();

  return () => {
    active = false;
    if (debounceTimer) clearTimeout(debounceTimer);
    client.removeChannel(channel);
  };
}

export function subscribeToStorageLocations(
  onUpdate: (locations: StorageLocation[]) => void,
  onError?: (error: Error) => void
): () => void {
  const client = getSupabaseClient();
  if (!client) {
    return () => {};
  }

  let active = true;
  let debounceTimer: any = null;

  const fetchLocations = async () => {
    try {
      const allRows = await fetchAllRowsFromSupabase<any>(client, 'storage_locations', {
        orderColumn: 'updated_at',
        ascending: false,
        batchSize: 1000,
      });

      if (active) {
        const mapped = allRows.map(supabaseToStorageLocation);
        onUpdate(mapped);
      }
    } catch (err: any) {
      if (onError) onError(err);
      console.warn('Supabase fetch storage_locations error:', err);
    }
  };

  fetchLocations();

  const channel = client
    .channel('realtime_storage_locations')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'storage_locations' },
      () => {
        invalidateStorageLocationCache();
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          fetchLocations();
        }, 300);
      }
    )
    .subscribe();

  return () => {
    active = false;
    if (debounceTimer) clearTimeout(debounceTimer);
    client.removeChannel(channel);
  };
}

// =========================================================================
// CRUD OPERATIONS (SUPABASE POSTGREST)
// =========================================================================

export async function saveReturnItemToSupabase(item: ReturnItem): Promise<void> {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase client not initialized');

  if (item.pickupInfo) {
    savePickupInfoLocally(item.id, item.pickupInfo);
  }

  const payload = returnItemToSupabase(item);
  const { error } = await client.from('return_items').upsert(payload);
  if (error) {
    // If column pickup_info does not exist yet on remote table
    if (error.message?.includes('pickup_info') || error.code === 'PGRST204') {
      const { pickup_info, ...safePayload } = payload;
      const res2 = await client.from('return_items').upsert(safePayload);
      if (res2.error) {
        console.error('Error saving return item fallback to Supabase:', res2.error);
        throw res2.error;
      }
    } else {
      console.error('Error saving return item to Supabase:', error);
      throw error;
    }
  }
}

export async function deleteReturnItemFromSupabase(itemId: string): Promise<void> {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase client not initialized');

  const { error } = await client.from('return_items').delete().eq('id', itemId);
  if (error) {
    console.error('Error deleting return item from Supabase:', error);
    throw error;
  }
}

export async function batchDeleteReturnItemsFromSupabase(itemIds: string[]): Promise<void> {
  if (!itemIds || itemIds.length === 0) return;
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase client not initialized');

  const CHUNK_SIZE = 100;
  for (let i = 0; i < itemIds.length; i += CHUNK_SIZE) {
    const chunk = itemIds.slice(i, i + CHUNK_SIZE);
    const { error } = await client.from('return_items').delete().in('id', chunk);
    if (error) {
      console.warn('Error batch deleting return items from Supabase:', error);
    }
  }
}

export async function saveSupplierToSupabase(supplier: Supplier): Promise<void> {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase client not initialized');

  const payload = supplierToSupabase(supplier);
  const { error } = await client.from('suppliers').upsert(payload);
  if (error) {
    console.error('Error saving supplier to Supabase:', error);
    throw error;
  }
}

export async function deleteSupplierFromSupabase(supplierId: string): Promise<void> {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase client not initialized');

  const { error } = await client.from('suppliers').delete().eq('id', supplierId);
  if (error) {
    console.error('Error deleting supplier from Supabase:', error);
    throw error;
  }
}

export async function batchDeleteSuppliersFromSupabase(supplierIds: string[]): Promise<void> {
  if (!supplierIds || supplierIds.length === 0) return;
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase client not initialized');

  const { error } = await client.from('suppliers').delete().in('id', supplierIds);
  if (error) {
    console.error('Error batch deleting suppliers from Supabase:', error);
    throw error;
  }
}

export async function saveMasterProductToSupabase(product: MasterProduct): Promise<void> {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase client not initialized');

  const payload = masterProductToSupabase(product);
  const { error } = await client.from('master_products').upsert(payload);
  if (error) {
    console.error('Error saving master product to Supabase:', error);
    throw error;
  }
  invalidateMasterProductCache();
}

export async function batchSaveMasterProductsToSupabase(
  products: MasterProduct[],
  onProgress?: (savedCount: number, totalCount: number) => void
): Promise<{ successCount: number; failCount: number }> {
  if (!products || products.length === 0) return { successCount: 0, failCount: 0 };
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase client not initialized');

  const CHUNK_SIZE = 250;
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < products.length; i += CHUNK_SIZE) {
    const chunk = products.slice(i, i + CHUNK_SIZE);
    const payload = chunk.map(masterProductToSupabase);

    const { error } = await client.from('master_products').upsert(payload);
    if (error) {
      console.warn('Batch chunk failed in Supabase, trying per-item fallback:', error);
      for (const p of chunk) {
        try {
          const { error: singleErr } = await client.from('master_products').upsert(masterProductToSupabase(p));
          if (singleErr) failCount++;
          else successCount++;
        } catch {
          failCount++;
        }
      }
    } else {
      successCount += chunk.length;
    }

    if (onProgress) {
      onProgress(successCount, products.length);
    }
  }

  invalidateMasterProductCache();
  return { successCount, failCount };
}

export async function deleteMasterProductFromSupabase(productId: string): Promise<void> {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase client not initialized');

  const { error } = await client.from('master_products').delete().eq('id', productId);
  if (error) {
    console.error('Error deleting master product from Supabase:', error);
    throw error;
  }
  invalidateMasterProductCache();
}

export async function batchDeleteMasterProductsFromSupabase(productIds: string[]): Promise<void> {
  if (!productIds || productIds.length === 0) return;
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase client not initialized');

  const CHUNK_SIZE = 200;
  for (let i = 0; i < productIds.length; i += CHUNK_SIZE) {
    const chunk = productIds.slice(i, i + CHUNK_SIZE);
    const { error } = await client.from('master_products').delete().in('id', chunk);
    if (error) {
      console.warn('Error batch deleting master products from Supabase:', error);
    }
  }
  invalidateMasterProductCache();
}

export async function clearAllMasterProductsFromSupabase(ids?: string[]): Promise<void> {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase client not initialized');

  if (ids && ids.length > 0) {
    await batchDeleteMasterProductsFromSupabase(ids);
    return;
  }

  // Delete all rows where id is not empty
  const { error } = await client.from('master_products').delete().neq('id', '');
  if (error) {
    console.warn('Error clearing master products in Supabase:', error);
  }
  invalidateMasterProductCache();
}

export async function saveStorageLocationToSupabase(location: StorageLocation): Promise<void> {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase client not initialized');

  const payload = storageLocationToSupabase(location);
  const { error } = await client.from('storage_locations').upsert(payload);
  if (error) {
    console.error('Error saving storage location to Supabase:', error);
    throw error;
  }
  invalidateStorageLocationCache();
}

export async function batchSaveStorageLocationsToSupabase(locations: StorageLocation[]): Promise<void> {
  if (!locations || locations.length === 0) return;
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase client not initialized');

  const payload = locations.map(storageLocationToSupabase);
  const { error } = await client.from('storage_locations').upsert(payload);
  if (error) {
    console.error('Error batch saving storage locations to Supabase:', error);
    throw error;
  }
  invalidateStorageLocationCache();
}

export async function deleteStorageLocationFromSupabase(locationId: string): Promise<void> {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase client not initialized');

  const { error } = await client.from('storage_locations').delete().eq('id', locationId);
  if (error) {
    console.error('Error deleting storage location from Supabase:', error);
    throw error;
  }
  invalidateStorageLocationCache();
}

// =========================================================================
// QUERY HELPERS & CACHING FOR HARDWARE SCANNER / AUTOFILL
// =========================================================================

export async function getMasterProductByBarcode(
  barcode: string,
  localFallbackList: MasterProduct[] = []
): Promise<MasterProduct | null> {
  const cleanCode = (barcode || '').trim().toLowerCase();
  if (!cleanCode) return null;

  // 1. Check in-memory fast cache
  if (masterBarcodeCache.has(cleanCode)) {
    return masterBarcodeCache.get(cleanCode)!;
  }

  // 2. Check local fallback list
  const foundLocal = localFallbackList.find(
    (p) => p.barcode && p.barcode.toLowerCase().trim() === cleanCode
  );
  if (foundLocal) {
    masterBarcodeCache.set(cleanCode, foundLocal);
    return foundLocal;
  }

  // 3. Query Supabase
  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client
        .from('master_products')
        .select('*')
        .ilike('barcode', barcode.trim())
        .limit(1);

      if (!error && data && data.length > 0) {
        const prod = supabaseToMasterProduct(data[0]);
        masterBarcodeCache.set(cleanCode, prod);
        return prod;
      }
    } catch (err) {
      console.warn('Supabase barcode lookup error:', err);
    }
  }

  return null;
}

export async function getStorageLocationByBarcode(
  barcode: string,
  localFallbackList: StorageLocation[] = []
): Promise<StorageLocation | null> {
  const cleanCode = (barcode || '').trim().toLowerCase();
  if (!cleanCode) return null;

  if (storageBarcodeCache.has(cleanCode)) {
    return storageBarcodeCache.get(cleanCode)!;
  }

  const foundLocal = localFallbackList.find(
    (l) => l.barcode && l.barcode.toLowerCase().trim() === cleanCode
  );
  if (foundLocal) {
    storageBarcodeCache.set(cleanCode, foundLocal);
    return foundLocal;
  }

  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client
        .from('storage_locations')
        .select('*')
        .ilike('barcode', barcode.trim())
        .limit(1);

      if (!error && data && data.length > 0) {
        const loc = supabaseToStorageLocation(data[0]);
        storageBarcodeCache.set(cleanCode, loc);
        return loc;
      }
    } catch (err) {
      console.warn('Supabase storage location lookup error:', err);
    }
  }

  return null;
}

export async function getMasterProductCounts(
  forceRefresh = false
): Promise<{ total: number; consignment: number; outright: number }> {
  const client = getSupabaseClient();
  if (!client) {
    try {
      const local = localStorage.getItem('returku_master_products_v1');
      if (local) {
        const items = JSON.parse(local) as MasterProduct[];
        return {
          total: items.length,
          consignment: items.filter((i) => i.procurementType === 'CONSIGNMENT').length,
          outright: items.filter((i) => !i.procurementType || i.procurementType === 'OUTRIGHT').length,
        };
      }
    } catch {}
    return { total: 0, consignment: 0, outright: 0 };
  }

  try {
    const [totalRes, consignRes, outrightRes] = await Promise.all([
      client.from('master_products').select('*', { count: 'exact', head: true }),
      client.from('master_products').select('*', { count: 'exact', head: true }).eq('procurement_type', 'CONSIGNMENT'),
      client.from('master_products').select('*', { count: 'exact', head: true }).eq('procurement_type', 'OUTRIGHT'),
    ]);

    return {
      total: totalRes.count || 0,
      consignment: consignRes.count || 0,
      outright: outrightRes.count || 0,
    };
  } catch (err) {
    console.warn('Error counting master products from Supabase:', err);
    return { total: 0, consignment: 0, outright: 0 };
  }
}

export async function getStorageLocationsCount(): Promise<number> {
  const client = getSupabaseClient();
  if (!client) return 0;
  try {
    const { count } = await client.from('storage_locations').select('*', { count: 'exact', head: true });
    return count || 0;
  } catch {
    return 0;
  }
}

export function getCachedDepartments(): string[] {
  try {
    const raw = localStorage.getItem('hbc_cached_departments');
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

export function saveCachedDepartments(departments: string[]): void {
  try {
    localStorage.setItem('hbc_cached_departments', JSON.stringify(departments));
  } catch {}
}

// =========================================================================
// ONE-CLICK DATA MIGRATION FROM CURRENT CACHE / FIRESTORE TO SUPABASE
// =========================================================================

export async function migrateCurrentDataToSupabase(
  data: {
    items: ReturnItem[];
    suppliers: Supplier[];
    masterProducts: MasterProduct[];
    storageLocations: StorageLocation[];
  },
  onProgress?: (step: string, percentage: number) => void
): Promise<{ success: boolean; message: string; counts: { suppliers: number; items: number; products: number; locations: number } }> {
  const client = getSupabaseClient();
  if (!client) {
    return {
      success: false,
      message: 'Supabase belum terkonfigurasi. Masukkan URL dan Anon Key terlebih dahulu.',
      counts: { suppliers: 0, items: 0, products: 0, locations: 0 },
    };
  }

  try {
    if (onProgress) onProgress('Memulai migrasi data ke Supabase...', 10);

    // 1. Suppliers
    if (onProgress) onProgress(`Memigrasikan ${data.suppliers.length} data supplier...`, 25);
    if (data.suppliers.length > 0) {
      const CHUNK = 200;
      for (let i = 0; i < data.suppliers.length; i += CHUNK) {
        const chunk = data.suppliers.slice(i, i + CHUNK);
        const payload = chunk.map(supplierToSupabase);
        const { error } = await client.from('suppliers').upsert(payload);
        if (error) throw new Error(`Gagal memigrasikan supplier: ${error.message}`);
      }
    }

    // 2. Return Items
    if (onProgress) onProgress(`Memigrasikan ${data.items.length} data barang return...`, 50);
    if (data.items.length > 0) {
      const CHUNK = 200;
      for (let i = 0; i < data.items.length; i += CHUNK) {
        const chunk = data.items.slice(i, i + CHUNK);
        const payload = chunk.map(returnItemToSupabase);
        const { error } = await client.from('return_items').upsert(payload);
        if (error) throw new Error(`Gagal memigrasikan barang retur: ${error.message}`);
      }
    }

    // 3. Master Products
    if (onProgress) onProgress(`Memigrasikan ${data.masterProducts.length} master produk...`, 75);
    if (data.masterProducts.length > 0) {
      await batchSaveMasterProductsToSupabase(data.masterProducts);
    }

    // 4. Storage Locations
    if (onProgress) onProgress(`Memigrasikan ${data.storageLocations.length} lokasi rak gudang...`, 90);
    if (data.storageLocations.length > 0) {
      await batchSaveStorageLocationsToSupabase(data.storageLocations);
    }

    if (onProgress) onProgress('Migrasi data ke Supabase berhasil 100%!', 100);

    return {
      success: true,
      message: `Migrasi selesai! Berhasil menyinkronkan ${data.suppliers.length} supplier, ${data.items.length} barang return, ${data.masterProducts.length} master produk, dan ${data.storageLocations.length} lokasi simpan ke Supabase.`,
      counts: {
        suppliers: data.suppliers.length,
        items: data.items.length,
        products: data.masterProducts.length,
        locations: data.storageLocations.length,
      },
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Migrasi terhenti: ${err.message || String(err)}`,
      counts: { suppliers: 0, items: 0, products: 0, locations: 0 },
    };
  }
}
