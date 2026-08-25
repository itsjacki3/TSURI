import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

const STORAGE_KEY = 'tsuri_staff_session';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setUser(JSON.parse(raw));
    } catch {
      // ignore malformed/blocked storage
    }
    setInitializing(false);
  }, []);

  const login = useCallback(async (email, password) => {
    // staff_login is a SECURITY DEFINER Postgres function (see
    // supabase/migration_react_client.sql) that checks the bcrypt hash with
    // pgcrypto and returns the staff row *without* password_hash on success,
    // or no rows on failure. Passwords are never compared in the browser.
    const { data, error } = await supabase.rpc('staff_login', {
      p_email: email,
      p_password: password,
    });

    if (error) {
      throw new Error(error.message || 'Could not reach the database.');
    }
    const staff = Array.isArray(data) ? data[0] : data;
    if (!staff) {
      throw new Error('Invalid email address or password.');
    }

    const sessionUser = {
      id: staff.id,
      name: staff.full_name,
      email: staff.email,
      role: staff.role_name || 'Staff',
      roleId: staff.role_id,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionUser));
    setUser(sessionUser);
    return sessionUser;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, initializing, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
