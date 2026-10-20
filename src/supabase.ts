import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Environment variables or localStorage fallback for easy testing in AI Studio
const getEnvOrStorage = (envKey: string, storageKey: string): string => {
  try {
    const envVal = (import.meta as any).env?.[envKey];
    if (envVal && typeof envVal === 'string' && envVal.trim()) {
      return envVal.trim();
    }
    const stored = localStorage.getItem(storageKey);
    if (stored && typeof stored === 'string' && stored.trim()) {
      return stored.trim();
    }
  } catch {}
  return '';
};

export const getSupabaseConfig = () => {
  const url = getEnvOrStorage('VITE_SUPABASE_URL', 'returku_supabase_url');
  const anonKey = getEnvOrStorage('VITE_SUPABASE_ANON_KEY', 'returku_supabase_anon_key');
  return { url, anonKey };
};

export const isSupabaseConfigured = (): boolean => {
  const { url, anonKey } = getSupabaseConfig();
  return Boolean(url && anonKey && url.startsWith('http') && anonKey.length > 20);
};

let clientInstance: SupabaseClient | null = null;
let lastUrl = '';
let lastKey = '';

export function getSupabaseClient(): SupabaseClient | null {
  const { url, anonKey } = getSupabaseConfig();
  if (!url || !anonKey) {
    return null;
  }

  if (clientInstance && lastUrl === url && lastKey === anonKey) {
    return clientInstance;
  }

  lastUrl = url;
  lastKey = anonKey;

  clientInstance = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  });

  return clientInstance;
}

export const supabase = getSupabaseClient();

/**
 * Test connectivity with Supabase by checking table or server health
 */
export async function testSupabaseConnection(): Promise<{
  success: boolean;
  message: string;
  tableReady?: boolean;
  permissionDenied?: boolean;
}> {
  const client = getSupabaseClient();
  if (!client) {
    return {
      success: false,
      message: 'Supabase URL atau Anon Key belum diisi. Masukkan URL dan Anon Key terlebih dahulu.',
      tableReady: false,
    };
  }

  try {
    const { error } = await client.from('suppliers').select('id').limit(1);
    if (error) {
      // Kode 42501: permission denied for table suppliers
      const isPermissionDenied =
        error.code === '42501' ||
        (typeof error.message === 'string' && error.message.toLowerCase().includes('permission denied'));

      if (isPermissionDenied) {
        return {
          success: false,
          message:
            'Koneksi Supabase terkendala: permission denied for table suppliers (42501). Role "anon" belum memiliki hak akses ke tabel database. Jalankan skrip perbaikan GRANT / RLS di Supabase SQL Editor.',
          tableReady: false,
          permissionDenied: true,
        };
      }

      // Kode 42P01: Table 'suppliers' does not exist yet in PostgreSQL schema
      if (error.code === '42P01') {
        return {
          success: false,
          message:
            'Kredensial Supabase terhubung! Namun tabel "suppliers" belum dibuat di PostgreSQL. Harap jalankan skrip SQL di Supabase SQL Editor terlebih dahulu.',
          tableReady: false,
        };
      }
      if (
        error.message &&
        (error.message.includes('Failed to fetch') || error.message.includes('NetworkError'))
      ) {
        return {
          success: false,
          message:
            'Gagal menghubungi server Supabase. Pastikan URL project benar (contoh: https://xxxx.supabase.co) dan koneksi internet stabil.',
          tableReady: false,
        };
      }
      if (
        error.message &&
        (error.message.includes('Invalid API key') || error.message.includes('JWT') || error.code === 'PGRST301')
      ) {
        return {
          success: false,
          message:
            'API Key Supabase salah atau kadaluarsa. Pastikan menyalin "anon / public" key dari Project Settings → API di dashboard Supabase.',
          tableReady: false,
        };
      }
      return {
        success: false,
        message: `Koneksi Supabase terkendala: ${error.message} (${error.code || 'UNKNOWN'})`,
        tableReady: false,
      };
    }
    return {
      success: true,
      message: 'Koneksi ke Supabase berhasil! Seluruh tabel PostgreSQL dan Realtime siap digunakan.',
      tableReady: true,
    };
  } catch (err: any) {
    const msg = err?.message || String(err);
    return {
      success: false,
      message: `Gagal menghubungi Supabase: ${msg}`,
      tableReady: false,
    };
  }
}
