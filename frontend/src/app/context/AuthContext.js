"use client";
import { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const AuthContext = createContext();

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const parseJwt = (token) => {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch (e) {
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchMe = async (token) => {
    try {
      const response = await fetch(`${API_URL}/users/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        return await response.json();
      }
    } catch (e) {
      console.error(e);
    }
    return null;
  };

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem("token");
      if (token) {
        const decoded = parseJwt(token);
        if (decoded && decoded.exp * 1000 > Date.now()) {
          const userData = await fetchMe(token);
          if (userData) {
            setUser(userData);
          } else {
            localStorage.removeItem("token");
          }
        } else {
          localStorage.removeItem("token");
        }
      }
      setLoading(false);
    };
    initAuth();
  }, []);

  const login = async (token) => {
    localStorage.setItem("token", token);
    const decoded = parseJwt(token);
    if (decoded) {
      const userData = await fetchMe(token);
      if (userData) {
        setUser(userData);
        if (userData.role === 'ADMIN') router.push('/admin');
        else if (userData.role === 'PROVIDER') router.push('/provider');
        else router.push('/dashboard');
      } else {
        localStorage.removeItem("token");
      }
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
    router.push('/');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
