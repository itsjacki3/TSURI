import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const DEFAULTS = {
  hotel_name: 'Tsuri Gardens',
  booking_email: 'reservations@tsurigardens.example',
  checkin_time: '14:00',
  checkout_time: '11:00',
  currency: 'KES',
  timezone: 'Africa/Nairobi',
};

let cache = null;
let inflight = null;
const listeners = new Set();

async function loadSettings() {
  if (cache) return cache;
  if (!inflight) {
    inflight = supabase
      .from('settings')
      .select('setting_key, setting_value')
      .then(({ data, error }) => {
        const map = { ...DEFAULTS };
        if (!error && data) {
          data.forEach((row) => {
            if (row.setting_value) map[row.setting_key] = row.setting_value;
          });
        }
        cache = map;
        listeners.forEach((fn) => fn(cache));
        return cache;
      });
  }
  return inflight;
}

export function invalidateSettingsCache() {
  cache = null;
  inflight = null;
}

/** Reads the `settings` key/value table (see hotel_manager_supabase.sql), cached across the app. */
export function useSettings() {
  const [settings, setSettings] = useState(cache || DEFAULTS);

  useEffect(() => {
    let mounted = true;
    listeners.add(setSettings);
    loadSettings().then((s) => {
      if (mounted) setSettings(s);
    });
    return () => {
      mounted = false;
      listeners.delete(setSettings);
    };
  }, []);

  return settings;
}
