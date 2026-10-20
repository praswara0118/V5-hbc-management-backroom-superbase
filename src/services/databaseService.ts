import { isSupabaseConfigured, testSupabaseConnection } from '../supabase';
import * as supabaseService from './supabaseService';
import * as firestoreService from './firestoreService';
import { ReturnItem, Supplier, MasterProduct, StorageLocation } from '../types/inventory';

export type DatabaseProvider = 'supabase' | 'firestore' | 'local';

export function getActiveProvider(): DatabaseProvider {
  if (isSupabaseConfigured()) {
    return 'supabase';
  }
  return 'firestore';
}

/**
 * Initialize real-time synchronization with active database provider
 */
export async function initializeDatabaseSync(callbacks: {
  onItems: (items: ReturnItem[]) => void;
  onSuppliers: (suppliers: Supplier[]) => void;
  onMasterProducts: (products: MasterProduct[]) => void;
  onStorageLocations: (locations: StorageLocation[]) => void;
  onConnectionChange: (connected: boolean, provider: DatabaseProvider, message: string) => void;
}): Promise<() => void> {
  const provider = getActiveProvider();

  if (provider === 'supabase') {
    try {
      const connTest = await testSupabaseConnection();
      if (!connTest.success) {
        callbacks.onConnectionChange(false, 'supabase', connTest.message);
        console.warn('Supabase not ready yet:', connTest.message);
        return () => {};
      }

      await supabaseService.seedInitialSupabaseData();
      callbacks.onConnectionChange(true, 'supabase', 'Terkoneksi ke Supabase PostgreSQL Realtime');

      const unsubItems = supabaseService.subscribeToReturnItems(callbacks.onItems);
      const unsubSuppliers = supabaseService.subscribeToSuppliers(callbacks.onSuppliers);
      const unsubProducts = supabaseService.subscribeToMasterProducts(callbacks.onMasterProducts);
      const unsubLocations = supabaseService.subscribeToStorageLocations(callbacks.onStorageLocations);

      return () => {
        unsubItems();
        unsubSuppliers();
        unsubProducts();
        unsubLocations();
      };
    } catch (err: any) {
      console.warn('Supabase initialization error, falling back:', err);
      callbacks.onConnectionChange(false, 'local', 'Gagal koneksi Supabase. Mode penyimpanan lokal aktif.');
      return () => {};
    }
  }

  // Fallback to Firestore if Supabase credentials not provided yet
  try {
    const unsubItems = firestoreService.subscribeToReturnItems(callbacks.onItems);
    const unsubSuppliers = firestoreService.subscribeToSuppliers(callbacks.onSuppliers);
    const unsubProducts = firestoreService.subscribeToMasterProducts(callbacks.onMasterProducts);
    const unsubLocations = firestoreService.subscribeToStorageLocations(callbacks.onStorageLocations);
    callbacks.onConnectionChange(true, 'firestore', 'Terkoneksi ke Firestore (Siap migrasi ke Supabase)');

    return () => {
      unsubItems();
      unsubSuppliers();
      unsubProducts();
      unsubLocations();
    };
  } catch (err) {
    callbacks.onConnectionChange(false, 'local', 'Penyimpanan lokal aktif');
    return () => {};
  }
}

// =========================================================================
// MUTATIONS ROUTER
// =========================================================================

export async function saveReturnItem(item: ReturnItem): Promise<void> {
  if (isSupabaseConfigured()) {
    return supabaseService.saveReturnItemToSupabase(item);
  }
  return firestoreService.saveReturnItemToFirestore(item);
}

export async function deleteReturnItem(itemId: string): Promise<void> {
  if (isSupabaseConfigured()) {
    return supabaseService.deleteReturnItemFromSupabase(itemId);
  }
  return firestoreService.deleteReturnItemFromFirestore(itemId);
}

export async function batchDeleteReturnItems(itemIds: string[]): Promise<void> {
  if (isSupabaseConfigured()) {
    return supabaseService.batchDeleteReturnItemsFromSupabase(itemIds);
  }
  return firestoreService.batchDeleteReturnItemsFromFirestore(itemIds);
}

export async function saveSupplier(supplier: Supplier): Promise<void> {
  if (isSupabaseConfigured()) {
    return supabaseService.saveSupplierToSupabase(supplier);
  }
  return firestoreService.saveSupplierToFirestore(supplier);
}

export async function deleteSupplier(supplierId: string): Promise<void> {
  if (isSupabaseConfigured()) {
    return supabaseService.deleteSupplierFromSupabase(supplierId);
  }
  return firestoreService.deleteSupplierFromFirestore(supplierId);
}

export async function batchDeleteSuppliers(supplierIds: string[]): Promise<void> {
  if (isSupabaseConfigured()) {
    return supabaseService.batchDeleteSuppliersFromSupabase(supplierIds);
  }
  return firestoreService.batchDeleteSuppliersFromFirestore(supplierIds);
}

export async function saveMasterProduct(product: MasterProduct): Promise<void> {
  if (isSupabaseConfigured()) {
    return supabaseService.saveMasterProductToSupabase(product);
  }
  return firestoreService.saveMasterProductToFirestore(product);
}

export async function batchSaveMasterProducts(
  products: MasterProduct[],
  onProgress?: (saved: number, total: number) => void
): Promise<{ successCount: number; failCount: number }> {
  if (isSupabaseConfigured()) {
    return supabaseService.batchSaveMasterProductsToSupabase(products, onProgress);
  }
  return firestoreService.batchSaveMasterProductsToFirestore(products, onProgress);
}

export async function deleteMasterProduct(productId: string): Promise<void> {
  if (isSupabaseConfigured()) {
    return supabaseService.deleteMasterProductFromSupabase(productId);
  }
  return firestoreService.deleteMasterProductFromFirestore(productId);
}

export async function batchDeleteMasterProducts(productIds: string[]): Promise<void> {
  if (isSupabaseConfigured()) {
    return supabaseService.batchDeleteMasterProductsFromSupabase(productIds);
  }
  return firestoreService.batchDeleteMasterProductsFromFirestore(productIds);
}

export async function clearAllMasterProducts(ids?: string[]): Promise<void> {
  if (isSupabaseConfigured()) {
    return supabaseService.clearAllMasterProductsFromSupabase(ids);
  }
  return firestoreService.clearAllMasterProductsFromFirestore(ids);
}

export async function saveStorageLocation(location: StorageLocation): Promise<void> {
  if (isSupabaseConfigured()) {
    return supabaseService.saveStorageLocationToSupabase(location);
  }
  return firestoreService.saveStorageLocationToFirestore(location);
}

export async function batchSaveStorageLocations(locations: StorageLocation[]): Promise<void> {
  if (isSupabaseConfigured()) {
    return supabaseService.batchSaveStorageLocationsToSupabase(locations);
  }
  return firestoreService.batchSaveStorageLocationsToFirestore(locations);
}

export async function deleteStorageLocation(locationId: string): Promise<void> {
  if (isSupabaseConfigured()) {
    return supabaseService.deleteStorageLocationFromSupabase(locationId);
  }
  return firestoreService.deleteStorageLocationFromFirestore(locationId);
}

// =========================================================================
// SCANNER / AUTOFILL LOOKUP
// =========================================================================

export async function getMasterProductByBarcode(
  barcode: string,
  localFallbackList: MasterProduct[] = []
): Promise<MasterProduct | null> {
  if (isSupabaseConfigured()) {
    return supabaseService.getMasterProductByBarcode(barcode, localFallbackList);
  }
  return firestoreService.getMasterProductByBarcode(barcode, localFallbackList);
}

export async function getStorageLocationByBarcode(
  barcode: string,
  localFallbackList: StorageLocation[] = []
): Promise<StorageLocation | null> {
  if (isSupabaseConfigured()) {
    return supabaseService.getStorageLocationByBarcode(barcode, localFallbackList);
  }
  return firestoreService.getStorageLocationByBarcode(barcode, localFallbackList);
}

// Re-export migration
export { migrateCurrentDataToSupabase } from './supabaseService';
