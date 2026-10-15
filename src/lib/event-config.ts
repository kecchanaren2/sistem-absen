import { supabase } from './supabase';

export type FormFieldId = 'nama' | 'email' | 'nim_nip' | 'instansi' | 'whatsapp';

export interface FormFieldItem {
  id: FormFieldId;
  label: string;
  enabled: boolean;
  required: boolean;
  placeholder?: string;
}

export interface DynamicRole {
  id: string;
  label: string;
  category: 'Peserta' | 'Panitia' | 'Lainnya';
  fields: FormFieldItem[];
}

export interface EventFormConfig {
  id?: string;
  portal_title: string;
  event_name: string;
  event_description?: string;
  footer_text: string;
  roles: DynamicRole[];
  is_attendance_open?: boolean;
  closed_message?: string;
}

export const DEFAULT_FORM_FIELDS: FormFieldItem[] = [
  {
    id: 'nama',
    label: 'Nama Lengkap',
    enabled: true,
    required: true,
    placeholder: 'Masukkan nama sesuai identitas',
  },
  {
    id: 'email',
    label: 'Email',
    enabled: true,
    required: true,
    placeholder: 'email@contoh.com',
  },
  {
    id: 'nim_nip',
    label: 'NIP / NIM',
    enabled: true,
    required: true,
    placeholder: 'Masukkan nomor identitas',
  },
  {
    id: 'instansi',
    label: 'Asal Instansi / Unit Kerja',
    enabled: false,
    required: false,
    placeholder: 'Contoh: Fakultas Teknik / Biro Umum',
  },
  {
    id: 'whatsapp',
    label: 'Nomor WhatsApp / HP',
    enabled: false,
    required: false,
    placeholder: 'Contoh: 081234567890',
  },
];

export const DEFAULT_EVENT_CONFIG: EventFormConfig = {
  portal_title: 'PORTAL ABSENSI',
  event_name: 'Workshop Penyusunan Standar Pelayanan',
  event_description: 'Silakan isi data kehadiran Anda di bawah ini.',
  footer_text: 'Ac 2026 Workshop Penyusunan Standar Pelayanan. All rights reserved.',
  is_attendance_open: true,
  closed_message: 'Absensi telah ditutup oleh Administrator.',
  roles: [
    {
      id: 'peserta_dosen',
      label: 'Peserta Dosen',
      category: 'Peserta',
      fields: [
        { id: 'nama', label: 'Nama Lengkap', enabled: true, required: true, placeholder: 'Masukkan nama sesuai identitas' },
        { id: 'email', label: 'Email', enabled: true, required: true, placeholder: 'email@contoh.com' },
        { id: 'nim_nip', label: 'NIP', enabled: true, required: true, placeholder: 'Misal: 1981100720081210001' },
        { id: 'instansi', label: 'Asal Instansi / Unit', enabled: false, required: false, placeholder: 'Fakultas / Unit Kerja' },
        { id: 'whatsapp', label: 'Nomor WhatsApp', enabled: false, required: false, placeholder: '08123456789' },
      ],
    },
    {
      id: 'peserta_tendik',
      label: 'Peserta Tendik',
      category: 'Peserta',
      fields: [
        { id: 'nama', label: 'Nama Lengkap', enabled: true, required: true, placeholder: 'Masukkan nama sesuai identitas' },
        { id: 'email', label: 'Email', enabled: true, required: true, placeholder: 'email@contoh.com' },
        { id: 'nim_nip', label: 'NIP / NIK', enabled: true, required: true, placeholder: 'Misal: 1981100720081210001' },
        { id: 'instansi', label: 'Asal Instansi / Unit', enabled: false, required: false, placeholder: 'Fakultas / Unit Kerja' },
        { id: 'whatsapp', label: 'Nomor WhatsApp', enabled: false, required: false, placeholder: '08123456789' },
      ],
    },
  ],
};

const LOCAL_STORAGE_KEY = 'custom_event_form_config';

export function getLocalEventConfig(): EventFormConfig {
  if (typeof window === 'undefined') return DEFAULT_EVENT_CONFIG;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_EVENT_CONFIG,
        ...parsed,
        is_attendance_open: parsed.is_attendance_open !== undefined ? Boolean(parsed.is_attendance_open) : true,
        closed_message: parsed.closed_message || DEFAULT_EVENT_CONFIG.closed_message,
        roles: Array.isArray(parsed.roles) && parsed.roles.length > 0 ? parsed.roles : DEFAULT_EVENT_CONFIG.roles,
      };
    }
  } catch (err) {
    console.warn('Error reading local event config:', err);
  }
  return DEFAULT_EVENT_CONFIG;
}

export function saveLocalEventConfig(config: EventFormConfig) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(config));
    // Trigger storage event so other open tabs/windows can refresh immediately
    window.dispatchEvent(new Event('event_config_updated'));
  } catch (err) {
    console.warn('Error saving local event config:', err);
  }
}

export async function fetchEventConfig(): Promise<EventFormConfig> {
  const local = getLocalEventConfig();
  try {
    const { data, error } = await supabase
      .from('event_settings')
      .select('*')
      .eq('id', 'default')
      .maybeSingle();

    if (!error && data) {
      const remoteConfig: EventFormConfig = {
        id: data.id,
        portal_title: data.portal_title || DEFAULT_EVENT_CONFIG.portal_title,
        event_name: data.event_name || DEFAULT_EVENT_CONFIG.event_name,
        event_description: data.event_description || DEFAULT_EVENT_CONFIG.event_description,
        footer_text: data.footer_text || DEFAULT_EVENT_CONFIG.footer_text,
        is_attendance_open: data.is_attendance_open !== undefined ? Boolean(data.is_attendance_open) : (local.is_attendance_open !== undefined ? local.is_attendance_open : true),
        closed_message: data.closed_message || local.closed_message || DEFAULT_EVENT_CONFIG.closed_message,
        roles: Array.isArray(data.roles) && data.roles.length > 0 ? data.roles : DEFAULT_EVENT_CONFIG.roles,
      };
      saveLocalEventConfig(remoteConfig);
      return remoteConfig;
    }
  } catch (err) {
    console.warn('Supabase event_settings fetch error (falling back to local):', err);
  }
  return local;
}

export async function saveEventConfig(config: EventFormConfig): Promise<{ success: boolean; message: string }> {
  // 1. Simpan ke local storage selalu
  saveLocalEventConfig(config);

  // 2. Coba simpan ke Supabase jika tabel tersedia
  try {
    const payload: Record<string, any> = {
      id: 'default',
      portal_title: config.portal_title,
      event_name: config.event_name,
      event_description: config.event_description,
      footer_text: config.footer_text,
      roles: config.roles,
      is_attendance_open: config.is_attendance_open !== undefined ? config.is_attendance_open : true,
      closed_message: config.closed_message || DEFAULT_EVENT_CONFIG.closed_message,
      updated_at: new Date().toISOString(),
    };

    let { error } = await supabase.from('event_settings').upsert(payload);

    // Fallback: Jika tabel di Supabase belum memiliki kolom is_attendance_open atau closed_message
    if (error && (error.message?.includes('column') || error.code === '42703')) {
      delete payload.is_attendance_open;
      delete payload.closed_message;
      const retry = await supabase.from('event_settings').upsert(payload);
      error = retry.error;
    }

    if (error) {
      console.warn('Note on Supabase event_settings:', error.message);
      return { success: true, message: 'Pengaturan berhasil disimpan di penyimpanan lokal browser.' };
    }

    return { success: true, message: 'Pengaturan acara & form berhasil disimpan secara terpusat di Supabase!' };
  } catch (err) {
    console.warn('Supabase save error:', err);
    return { success: true, message: 'Pengaturan berhasil disimpan di browser lokal.' };
  }
}

export async function toggleAttendanceStatus(
  isOpen: boolean,
  closedMessage?: string
): Promise<{ success: boolean; config: EventFormConfig; message: string }> {
  const current = getLocalEventConfig();
  const updated: EventFormConfig = {
    ...current,
    is_attendance_open: isOpen,
    ...(closedMessage ? { closed_message: closedMessage } : {}),
  };
  const res = await saveEventConfig(updated);
  return { success: res.success, config: updated, message: res.message };
}
