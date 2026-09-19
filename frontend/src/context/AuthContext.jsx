import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../api/client';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('fpo_admin_user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState(() => localStorage.getItem('fpo_admin_token') || null);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState(null);

  const logout = () => {
    setUser(null);
    setToken(null);
    setError(null);
    localStorage.removeItem('fpo_admin_user');
    localStorage.removeItem('fpo_admin_token');
  };

  // Verify stored token & session on initial page load / refresh
  useEffect(() => {
    const verifySession = async () => {
      const storedToken = localStorage.getItem('fpo_admin_token');
      if (!storedToken) {
        setInitializing(false);
        return;
      }

      try {
        const response = await authAPI.getMe();
        const currentUser = response.data?.data?.user;

        if (currentUser && (currentUser.role === 'FPO_ADMIN' || currentUser.role === 'FARMER') && currentUser.status === 'ACTIVE') {
          setUser(currentUser);
          localStorage.setItem('fpo_admin_user', JSON.stringify(currentUser));
        } else {
          // Account status invalid or unauthorized role
          logout();
        }
      } catch (err) {
        console.warn('Session verification failed on refresh:', err.response?.data?.message || err.message);
        logout();
      } finally {
        setInitializing(false);
      }
    };

    verifySession();
  }, []);

  // Listen for global auto-logout events emitted by Axios 401 interceptor
  useEffect(() => {
    const handleAutoLogout = () => {
      logout();
    };

    window.addEventListener('fpo_auth_logout', handleAutoLogout);
    return () => window.removeEventListener('fpo_auth_logout', handleAutoLogout);
  }, []);

  const login = async (email, password) => {
    setLoading(true);
    setError(null);

    try {
      const response = await authAPI.login({ email, password });
      const { token: jwtToken, data } = response.data;
      const loggedUser = data?.user;

      if (!loggedUser) {
        const errMsg = 'Login failed. User profile data missing.';
        setError(errMsg);
        setLoading(false);
        return { success: false, message: errMsg };
      }

      // Check account status
      if (loggedUser.status !== 'ACTIVE') {
        const errMsg = 'Access Denied: Account is inactive or suspended.';
        setError(errMsg);
        setLoading(false);
        return { success: false, message: errMsg };
      }

      setToken(jwtToken);
      setUser(loggedUser);
      localStorage.setItem('fpo_admin_token', jwtToken);
      localStorage.setItem('fpo_admin_user', JSON.stringify(loggedUser));

      setLoading(false);
      return { success: true, user: loggedUser };
    } catch (err) {
      const message = err.response?.data?.message || 'Login failed. Please check your credentials and try again.';
      setError(message);
      setLoading(false);
      return { success: false, message };
    }
  };

  const loginWithGoogle = async (googleIdToken) => {
    setLoading(true);
    setError(null);

    try {
      const response = await authAPI.googleLogin(googleIdToken);
      const { token: jwtToken, data } = response.data;
      const loggedUser = data?.user;

      if (!loggedUser) {
        const errMsg = 'Google authentication failed. User profile data missing.';
        setError(errMsg);
        setLoading(false);
        return { success: false, message: errMsg };
      }

      // Check account status
      if (loggedUser.status !== 'ACTIVE') {
        const errMsg = 'Access Denied: Account is inactive or suspended.';
        setError(errMsg);
        setLoading(false);
        return { success: false, message: errMsg };
      }

      setToken(jwtToken);
      setUser(loggedUser);
      localStorage.setItem('fpo_admin_token', jwtToken);
      localStorage.setItem('fpo_admin_user', JSON.stringify(loggedUser));

      setLoading(false);
      return { success: true, user: loggedUser };
    } catch (err) {
      const message = err.response?.data?.message || 'Google authentication failed. Please try again.';
      setError(message);
      setLoading(false);
      return { success: false, message };
    }
  };

  const isAuthenticated = !!token && !!user;
  const isAdmin = isAuthenticated && user?.role === 'FPO_ADMIN';
  const isFarmer = isAuthenticated && user?.role === 'FARMER';

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        initializing,
        error,
        setError,
        login,
        loginWithGoogle,
        logout,
        isAuthenticated,
        isAdmin,
        isFarmer,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
