import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './routes/ProtectedRoute';
import AdminLayout from './layouts/AdminLayout';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Farmers from './pages/Farmers';
import Loans from './pages/Loans';
import LoanDetail from './pages/LoanDetail';
import Repayments from './pages/Repayments';
import Reports from './pages/Reports';
import Notifications from './pages/Notifications';
import FarmerDashboard from './pages/FarmerDashboard';
import DocumentVerification from './pages/DocumentVerification';
import LoanDisbursement from './pages/LoanDisbursement';
import Overdue from './pages/Overdue';
import AuditLog from './pages/AuditLog';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Route */}
          <Route path="/login" element={<Login />} />

          {/* Protected Farmer Route */}
          <Route
            path="/farmer/dashboard"
            element={
              <ProtectedRoute requiredRole="FARMER">
                <FarmerDashboard />
              </ProtectedRoute>
            }
          />

          {/* Protected Admin Routes */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute requiredRole="FPO_ADMIN">
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="farmers" element={<Farmers />} />
            <Route path="loans" element={<Loans />} />
            <Route path="loans/:id" element={<LoanDetail />} />
            <Route path="repayments" element={<Repayments />} />
            <Route path="reports" element={<Reports />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="documents" element={<DocumentVerification />} />
            <Route path="disbursements" element={<LoanDisbursement />} />
            <Route path="overdue" element={<Overdue />} />
            <Route path="audit-log" element={<AuditLog />} />
          </Route>

          {/* Root fallback */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
