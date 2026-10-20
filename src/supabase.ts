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
export async function testSupabaseConnection(): Promise<{ success: boolean; message: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return {
      success: false,
      message: 'Supabase URL atau Anon Key belum dikonfigurasi di Environment atau Pengaturan.',
    };
  }

  try {
    const { error } = await client.from('suppliers').select('id').limit(1);
    if (error) {
      // If table doesn't exist yet, but credentials are valid:
      if (error.code === '42P01') {
        return {
          success: true,
          message: 'Terkoneksi ke Supabase! Namun tabel database belum dibuat. Silakan jalankan file SQL skema.',
        };
      }
      return {
        success: false,
        message: `Koneksi Supabase error: ${error.message} (Kode: ${error.code})`,
      };
    }
    return {
      success: true,
      message: 'Koneksi ke Supabase berhasil dan tabel siap digunakan!',
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Gagal menghubungi server Supabase: ${err.message || String(err)}`,
    };
  }
}
