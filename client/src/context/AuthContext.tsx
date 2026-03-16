'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { fetchAPI, clearToken, setToken } from '@/lib/api';

interface User {
  id: number;
  email: string;
  full_name: string | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (token: string, userId: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    setLoading(true);
    console.log("AUTH_CONTEXT_FETCH_USER");
    try {
      const res = await fetchAPI('/api/users/me');
      console.log("AUTH_USER_RESPONSE_STATUS", res.status);
      if (res.ok) {
        const data = await res.json();
        console.log("AUTH_USER_RESPONSE_DATA", data);
        setUser(data);
      } else {
        console.warn("AUTH_USER_RESPONSE_NOT_OK");
        setUser(null);
      }
    } catch (error) {
      console.error('Failed to fetch user:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (token: string, userId: string) => {
    setToken(token);
    if (typeof window !== 'undefined') {
      localStorage.setItem('user_id', userId);
    }
    await refreshUser();
  };

  const logout = () => {
    clearToken();
    if (typeof window !== 'undefined') {
      localStorage.removeItem('user_id');
    }
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
