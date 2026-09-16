import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  FileText,
  CreditCard,
  BarChart3,
  Bell,
  LogOut,
  Building2,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './Sidebar.css';

const Sidebar = ({ isCollapsed, onToggleCollapse, isMobileOpen, onCloseMobile }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { label: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
    { label: 'Farmers', path: '/admin/farmers', icon: Users },
    { label: 'Loan Applications', path: '/admin/loans', icon: FileText },
    { label: 'Repayments', path: '/admin/repayments', icon: CreditCard },
    { label: 'Reports', path: '/admin/reports', icon: BarChart3 },
    { label: 'Notifications', path: '/admin/notifications', icon: Bell },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          className="sidebar-mobile-backdrop"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={`sidebar-root ${isCollapsed ? 'collapsed' : ''} ${
          isMobileOpen ? 'mobile-open' : ''
        }`}
      >
        {/* Brand Header */}
        <div className="sidebar-brand">
          <div className="brand-logo-icon">
            <Building2 size={24} />
          </div>
          {!isCollapsed && (
            <div className="brand-titles">
              <h2 className="brand-name">FPO Credit</h2>
              <span className="brand-sub">Management System</span>
            </div>
          )}
          <button
            type="button"
            className="mobile-close-btn"
            onClick={onCloseMobile}
            aria-label="Close sidebar menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* FPO Info Panel */}
        {!isCollapsed && (
          <div className="sidebar-fpo-card">
            <ShieldCheck size={16} className="fpo-card-icon" />
            <div className="fpo-card-info">
              <span className="fpo-card-name">{user?.fpoName || 'Green Valley FPO'}</span>
              <span className="fpo-card-reg">{user?.fpoRegistrationNo || 'FPO-MH-2024'}</span>
            </div>
          </div>
        )}

        {/* Main Nav Items */}
        <nav className="sidebar-navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onCloseMobile}
                className={({ isActive }) =>
                  `sidebar-nav-item ${isActive ? 'active' : ''}`
                }
                title={isCollapsed ? item.label : undefined}
              >
                <Icon size={20} className="nav-item-icon" />
                {!isCollapsed && <span className="nav-item-label">{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>

        {/* Desktop Collapse Toggle & Logout Footer */}
        <div className="sidebar-footer">
          <button
            type="button"
            className="sidebar-collapse-toggle-btn"
            onClick={onToggleCollapse}
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            {!isCollapsed && <span>Collapse Menu</span>}
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="sidebar-logout-btn"
            title={isCollapsed ? 'Sign Out' : undefined}
          >
            <LogOut size={18} />
            {!isCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
