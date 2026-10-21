import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { get, post, storage, TOKEN_KEY } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  const logout = useCallback(() => {
    storage.set(TOKEN_KEY, null);
    setUser(null);
  }, []);

  useEffect(() => {
    if (!storage.get(TOKEN_KEY)) {
      setReady(true);
      return;
    }
    get('/auth/me')
      .then(setUser)
      .catch(() => storage.set(TOKEN_KEY, null))
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    window.addEventListener('cleancity:logout', logout);
    return () => window.removeEventListener('cleancity:logout', logout);
  }, [logout]);

  const login = useCallback(async (email, password) => {
    const { token, user } = await post('/auth/login', { email, password });
    storage.set(TOKEN_KEY, token);
    setUser(user);
    return user;
  }, []);

  const register = useCallback(async (data) => {
    const { token, user } = await post('/auth/register', data);
    storage.set(TOKEN_KEY, token);
    setUser(user);
    return user;
  }, []);

  const value = useMemo(() => {
    const role = user?.role;
    return {
      user,
      ready,
      login,
      register,
      logout,
      setUser,
      // Master data (wards, plants, landfills, fleet) is managed by admins & supervisors.
      canManage: role === 'admin' || role === 'supervisor',
      // Operational records can be entered by every staff role.
      canRecord: !!role && role !== 'citizen',
      canDeleteRecords: role === 'admin' || role === 'supervisor',
      isAdmin: role === 'admin',
    };
  }, [user, ready, login, register, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
