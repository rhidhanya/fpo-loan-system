import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Banknote,
  Search,
  RefreshCw,
  CheckCircle2,
  IndianRupee,
  User,
  Calendar,
  CreditCard,
  TrendingUp,
  Clock,
} from 'lucide-react';
import { loanAPI } from '../api/client';
import {
  PageHeader,
  StatusBadge,
  LoadingSpinner,
  ErrorState,
  EmptyState,
  ConfirmDialog,
  useToast,
} from '../components';
import './LoanDisbursement.css';

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const LoanDisbursement = () => {
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [loans, setLoans] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Disburse dialog state
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [disbursedAmount, setDisbursedAmount] = useState(0);
  const [disburseLoading, setDisburseLoading] = useState(false);

  const fetchLoans = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await loanAPI.getAllLoans({ status: 'APPROVED', limit: 100 });
      if (response.data?.status === 'success') {
        setLoans(response.data.data?.loans || []);
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to load approved loans';
      setError(msg);
      showError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLoans();
  }, []);

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return loans;
    const q = searchTerm.toLowerCase();
    return loans.filter(
      (l) =>
        l.farmer?.name?.toLowerCase().includes(q) ||
        l.farmer?.email?.toLowerCase().includes(q) ||
        l.purpose?.toLowerCase().includes(q) ||
        l._id?.toLowerCase().includes(q)
    );
  }, [loans, searchTerm]);

  const summary = useMemo(() => ({
    count: loans.length,
    totalAmount: loans.reduce((sum, l) => sum + (l.loanAmount || 0), 0),
  }), [loans]);

  const openDisburseDialog = (loan) => {
    setSelectedLoan(loan);
    setDisbursedAmount(loan.loanAmount || 0);
  };

  const handleDisburse = async () => {
    if (!selectedLoan || disburseLoading) return;
    setDisburseLoading(true);
    try {
      const response = await loanAPI.disburseLoan(selectedLoan._id, {
        disbursedAmount: Number(disbursedAmount),
      });
      if (response.data?.status === 'success') {
        showSuccess(`Loan disbursed successfully. Repayment schedule generated.`);
        setSelectedLoan(null);
        await fetchLoans();
      }
    } catch (err) {
      showError(err.response?.data?.message || 'Disbursement failed. Please try again.');
    } finally {
      setDisburseLoading(false);
    }
  };

  return (
    <div className="disbursement-page-container">
      <PageHeader
        title="Loan Disbursement"
        subtitle="Disburse approved loans and generate repayment schedules"
      />

      {/* Summary Cards */}
      <div className="metrics-overview-grid">
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Loans Ready</span>
            <div className="metric-icon-box emerald"><CheckCircle2 size={18} /></div>
          </div>
          <div className="metric-main-value">{summary.count}</div>
          <div className="metric-footer-text">Approved, pending disbursement</div>
        </div>
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Total Approved Amount</span>
            <div className="metric-icon-box blue"><IndianRupee size={18} /></div>
          </div>
          <div className="metric-main-value disburse-amount">{fmt(summary.totalAmount)}</div>
          <div className="metric-footer-text">Across all approved loans</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="disbursement-filter-bar">
        <div className="search-input-wrapper">
          <Search size={15} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search farmer, purpose, loan ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button
          className="btn btn-secondary refresh-btn"
          onClick={fetchLoans}
          disabled={loading}
        >
          <RefreshCw size={15} className={loading ? 'spinning' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="disbursement-loader-wrap">
          <LoadingSpinner message="Loading approved loans..." />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={fetchLoans} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Banknote size={40} />}
          title={searchTerm ? 'No loans match your search' : 'No approved loans pending disbursement'}
          message="Loans approved by admin will appear here ready for disbursement."
        />
      ) : (
        <div className="glass-panel disbursement-table-panel">
          <div className="disbursement-table-header">
            <span className="disbursement-results-count">
              {filtered.length} loan{filtered.length !== 1 ? 's' : ''} ready for disbursement
            </span>
          </div>
          <div className="disbursement-table-responsive">
            <table className="disbursement-table">
              <thead>
                <tr>
                  <th>Farmer</th>
                  <th>Loan ID</th>
                  <th>Purpose</th>
                  <th>Approved Amount</th>
                  <th>Rate / Tenure</th>
                  <th>Approved By</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((loan) => (
                  <tr key={loan._id}>
                    {/* Farmer */}
                    <td>
                      <div className="farmer-cell">
                        <div className="farmer-avatar-mini">
                          <User size={14} />
                        </div>
                        <div className="farmer-cell-info">
                          <span className="farmer-cell-name">{loan.farmer?.name || '—'}</span>
                          <span className="farmer-cell-phone">{loan.farmer?.email || ''}</span>
                        </div>
                      </div>
                    </td>
                    {/* Loan ID */}
                    <td>
                      <button
                        className="loan-id-link"
                        onClick={() => navigate(`/admin/loans/${loan._id}`)}
                        title="View loan details"
                      >
                        #{loan._id.slice(-8).toUpperCase()}
                      </button>
                    </td>
                    {/* Purpose */}
                    <td>
                      <span className="purpose-text">{loan.purpose}</span>
                    </td>
                    {/* Amount */}
                    <td>
                      <div className="amount-cell">
                        <span className="amount-value">{fmt(loan.loanAmount)}</span>
                      </div>
                    </td>
                    {/* Rate / Tenure */}
                    <td>
                      <div className="rate-tenure-cell">
                        <span className="rate-val">{loan.interestRate}% p.a.</span>
                        <span className="tenure-val">{loan.tenureMonths} months</span>
                      </div>
                    </td>
                    {/* Approved By */}
                    <td>
                      <span className="approved-by-text">
                        {loan.approvedBy?.name || '—'}
                      </span>
                    </td>
                    {/* Status */}
                    <td>
                      <StatusBadge status={loan.status} size="small" />
                    </td>
                    {/* Action */}
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn disburse-action-btn"
                        onClick={() => openDisburseDialog(loan)}
                      >
                        <Banknote size={14} />
                        <span>Disburse</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Disburse Confirmation Dialog */}
      {selectedLoan && (
        <div className="disburse-modal-overlay" onClick={() => !disburseLoading && setSelectedLoan(null)}>
          <div
            className="disburse-modal-card glass-panel"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="disburse-modal-header">
              <div className="disburse-modal-icon-wrap">
                <Banknote size={24} />
              </div>
              <div>
                <h3 className="disburse-modal-title">Confirm Disbursement</h3>
                <p className="disburse-modal-sub">
                  Loan for <strong>{selectedLoan.farmer?.name}</strong>
                </p>
              </div>
            </div>

            <div className="disburse-modal-body">
              <div className="disburse-info-grid">
                <div className="disburse-info-item">
                  <span className="disburse-info-label"><User size={13} /> Farmer</span>
                  <span className="disburse-info-val">{selectedLoan.farmer?.name}</span>
                </div>
                <div className="disburse-info-item">
                  <span className="disburse-info-label"><IndianRupee size={13} /> Approved Amount</span>
                  <span className="disburse-info-val text-emerald">{fmt(selectedLoan.loanAmount)}</span>
                </div>
                <div className="disburse-info-item">
                  <span className="disburse-info-label"><TrendingUp size={13} /> Interest Rate</span>
                  <span className="disburse-info-val">{selectedLoan.interestRate}% p.a.</span>
                </div>
                <div className="disburse-info-item">
                  <span className="disburse-info-label"><Clock size={13} /> Tenure</span>
                  <span className="disburse-info-val">{selectedLoan.tenureMonths} months</span>
                </div>
              </div>

              <div className="form-group" style={{ marginTop: '1rem' }}>
                <label className="form-label" htmlFor="disburse-amount">
                  Disbursement Amount <span style={{ color: '#f87171' }}>*</span>
                </label>
                <div className="disburse-amount-input-wrap">
                  <IndianRupee size={15} className="disburse-amount-icon" />
                  <input
                    id="disburse-amount"
                    type="number"
                    className="form-input disburse-amount-input"
                    value={disbursedAmount}
                    min={1}
                    max={selectedLoan.loanAmount}
                    onChange={(e) => setDisbursedAmount(e.target.value)}
                    disabled={disburseLoading}
                  />
                </div>
                <span className="input-hint">
                  Default: approved loan amount. Adjust if actual disbursement differs.
                </span>
              </div>

              <p className="disburse-note">
                After disbursement, the repayment schedule will be automatically generated
                and the farmer will be able to view their EMI installments.
              </p>
            </div>

            <div className="disburse-modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setSelectedLoan(null)}
                disabled={disburseLoading}
              >
                Cancel
              </button>
              <button
                className="btn disburse-confirm-btn"
                onClick={handleDisburse}
                disabled={disburseLoading || !disbursedAmount || Number(disbursedAmount) <= 0}
              >
                <Banknote size={15} />
                <span>{disburseLoading ? 'Processing...' : 'Confirm Disbursement'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoanDisbursement;
