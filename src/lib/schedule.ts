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
    startTime: process.env.NEXT_PUBLIC_SESSION_1_START || '08:00',
    endTime: process.env.NEXT_PUBLIC_SESSION_1_END || '10:00',
  },
  2: {
    id: 2,
    name: 'Siang',
    label: 'Sesi Siang',
    startTime: process.env.NEXT_PUBLIC_SESSION_2_START || '12:00',
    endTime: process.env.NEXT_PUBLIC_SESSION_2_END || '14:00',
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
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

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
