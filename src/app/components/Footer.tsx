'use client';

import { useState, useEffect } from 'react';
import { getLocalEventConfig, fetchEventConfig } from '@/lib/event-config';

export default function Footer() {
  const [footerText, setFooterText] = useState(() => {
    return getLocalEventConfig().footer_text || '© 2026 Workshop Penyusunan Standar Pelayanan. All rights reserved.';
  });

  useEffect(() => {
    async function load() {
      const cfg = await fetchEventConfig();
      if (cfg?.footer_text) {
        setFooterText(cfg.footer_text);
      }
    }
    load();

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'app_event_config' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed.footer_text) setFooterText(parsed.footer_text);
        } catch {
          // ignore
        }
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  return (
    <footer className="relative z-10 py-5 text-center text-xs font-medium text-[#75778f] dark:text-[#7f88a3] tracking-wide">
      {footerText}
    </footer>
  );
}
