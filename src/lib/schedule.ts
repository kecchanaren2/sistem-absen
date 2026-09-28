export interface SessionConfig {
  id: 1 | 2;
  name: string;
  label: string;
  startTime: string; // "HH:mm" (24h format)
  endTime: string;   // "HH:mm" (24h format)
}

export const SESSION_SCHEDULES: Record<1 | 2, SessionConfig> = {
  1: {
    id: 1,
    name: 'Pagi',
    label: 'Sesi Pagi',
    startTime: process.env.NEXT_PUBLIC_SESSION_1_START || '06:00',
    endTime: process.env.NEXT_PUBLIC_SESSION_1_END || '10:00',
  },
  2: {
    id: 2,
    name: 'Siang',
    label: 'Sesi Siang',
    startTime: process.env.NEXT_PUBLIC_SESSION_2_START || '10:00',
    endTime: process.env.NEXT_PUBLIC_SESSION_2_END || '13:00',
  },
};

export const BYPASS_SCHEDULE = process.env.NEXT_PUBLIC_BYPASS_SCHEDULE === 'true';

export type SessionStatus = {
  isOpen: boolean;
  status: 'not_started' | 'open' | 'closed';
  message: string;
};

/**
 * Checks if a specific session is currently open based on local system time.
 */
export function getSessionStatus(sessionId: 1 | 2, customDate?: Date): SessionStatus {
  if (BYPASS_SCHEDULE) {
    return { isOpen: true, status: 'open', message: 'Buka (Bypass)' };
  }

  const config = SESSION_SCHEDULES[sessionId];
  if (!config) {
    return { isOpen: false, status: 'closed', message: 'Sesi tidak valid' };
  }

  const now = customDate || new Date();
  
  // Konversi waktu saat ini ke zona waktu WITA (Bali - Asia/Makassar)
  // Ini memastikan server (UTC) dan client (zona waktu sembarangan) selalu memiliki pemahaman jam yang persis sama.
  const witaString = now.toLocaleString('en-US', { timeZone: 'Asia/Makassar' });
  const baliTime = new Date(witaString);
  
  const currentMinutes = baliTime.getHours() * 60 + baliTime.getMinutes();

  const [startH, startM] = config.startTime.split(':').map(Number);
  const [endH, endM] = config.endTime.split(':').map(Number);

  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  if (currentMinutes < startMinutes) {
    return {
      isOpen: false,
      status: 'not_started',
      message: `Buka jam ${config.startTime}`,
    };
  }

  if (currentMinutes > endMinutes) {
    return {
      isOpen: false,
      status: 'closed',
      message: `Tutup jam ${config.endTime}`,
    };
  }

  return {
    isOpen: true,
    status: 'open',
    message: `Buka (${config.startTime} - ${config.endTime})`,
  };
}
