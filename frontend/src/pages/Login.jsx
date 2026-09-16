import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Building2, Lock, Mail, ShieldAlert, ArrowRight, Eye, EyeOff, Loader2 } from 'lucide-react';
import './Login.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState('');

  const { login, loading, error: authError, setError, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/admin/dashboard';

  // If already authenticated as FPO_ADMIN, redirect to dashboard
  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

  const validateForm = () => {
    if (!email.trim()) {
      setFormError('Please enter your email address.');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setFormError('Please enter a valid email address format.');
      return false;
    }
    if (!password) {
      setFormError('Please enter your password.');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (setError) setError(null);

    if (!validateForm()) {
      return;
    }

    const result = await login(email.trim(), password);
    if (result.success) {
      navigate(from, { replace: true });
    }
  };

  const displayError = formError || authError;

  return (
    <div className="login-container">
      <div className="login-card glass-panel">
        <div className="login-header">
          <div className="login-brand-icon">
            <Building2 size={28} />
          </div>
          <h1>FPO Admin Portal</h1>
          <p>Farmer Producer Organization Credit Management</p>
        </div>

        {displayError && (
          <div className="login-error-alert">
            <ShieldAlert size={18} className="alert-icon" />
            <div className="alert-content">
              <span>{displayError}</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form" noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="admin-email">
              Admin Email Address
            </label>
            <div className="input-wrapper">
              <Mail size={18} className="input-icon" />
              <input
                id="admin-email"
                type="email"
                className="form-input with-icon"
                placeholder="admin@fpo.org"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (formError) setFormError('');
                }}
                disabled={loading}
                autoComplete="email"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="admin-password">
              Password
            </label>
            <div className="input-wrapper">
              <Lock size={18} className="input-icon" />
              <input
                id="admin-password"
                type={showPassword ? 'text' : 'password'}
                className="form-input with-icon with-eye"
                placeholder="••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (formError) setFormError('');
                }}
                disabled={loading}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex="-1"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button type="submit" className="btn btn-primary login-btn" disabled={loading}>
            {loading ? (
              <>
                <Loader2 size={18} className="spinner-icon" />
                <span>Authenticating Admin...</span>
              </>
            ) : (
              <>
                <span>Sign In to Admin Portal</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <div className="login-footer">
          <p>Strictly restricted to FPO_ADMIN accounts.</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
