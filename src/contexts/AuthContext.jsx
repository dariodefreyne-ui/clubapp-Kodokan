import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const PINS_STORAGE_KEY = 'kodokan_pins';
const ROLE_STORAGE_KEY = 'kodokan_role';

const DEFAULT_PINS = {
  beheerder: '1234',
  trainer: '5678',
};

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [role, setRole] = useState(() => {
    try {
      return localStorage.getItem(ROLE_STORAGE_KEY) || null;
    } catch {
      return null;
    }
  });

  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    try {
      return Boolean(localStorage.getItem(ROLE_STORAGE_KEY));
    } catch {
      return false;
    }
  });

  // Ensure default pins exist in localStorage on first load
  useEffect(() => {
    try {
      const stored = localStorage.getItem(PINS_STORAGE_KEY);
      if (!stored) {
        localStorage.setItem(PINS_STORAGE_KEY, JSON.stringify(DEFAULT_PINS));
      }
    } catch (err) {
      console.warn('localStorage not available:', err);
    }
  }, []);

  const getPins = useCallback(() => {
    try {
      const stored = localStorage.getItem(PINS_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // ignore parse errors
    }
    return DEFAULT_PINS;
  }, []);

  const login = useCallback((pin) => {
    const pins = getPins();
    for (const [roleKey, rolePin] of Object.entries(pins)) {
      if (pin === rolePin) {
        setRole(roleKey);
        setIsAuthenticated(true);
        try {
          localStorage.setItem(ROLE_STORAGE_KEY, roleKey);
        } catch {
          // ignore
        }
        return { success: true, role: roleKey };
      }
    }
    return { success: false, error: 'Ongeldige PIN' };
  }, [getPins]);

  const logout = useCallback(() => {
    setRole(null);
    setIsAuthenticated(false);
    try {
      localStorage.removeItem(ROLE_STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  const updatePin = useCallback((roleKey, newPin) => {
    const pins = getPins();
    pins[roleKey] = newPin;
    try {
      localStorage.setItem(PINS_STORAGE_KEY, JSON.stringify(pins));
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, [getPins]);

  const addRole = useCallback((roleKey, pin) => {
    const pins = getPins();
    pins[roleKey] = pin;
    try {
      localStorage.setItem(PINS_STORAGE_KEY, JSON.stringify(pins));
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, [getPins]);

  const removeRole = useCallback((roleKey) => {
    const pins = getPins();
    delete pins[roleKey];
    try {
      localStorage.setItem(PINS_STORAGE_KEY, JSON.stringify(pins));
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, [getPins]);

  const value = {
    role,
    isAuthenticated,
    login,
    logout,
    updatePin,
    addRole,
    removeRole,
    getPins,
    isBeheerder: role === 'beheerder',
    isTrainer: role === 'trainer' || role === 'beheerder',
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
