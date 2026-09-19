import React, { useState, useEffect, useMemo } from 'react';
import {
  AlertTriangle,
  Search,
  RefreshCw,
  Clock,
  AlertCircle,
  IndianRupee,
  User,
  CreditCard,
  BarChart2,
} from 'lucide-react';
import { repaymentAPI } from '../api/client';
import {
  PageHeader,
  StatusBadge,
  LoadingSpinner,
  ErrorState,
  EmptyState,
  useToast,
} from '../components';
import './Overdue.css';

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const daysOverdue = (dueDate) => {
  if (!dueDate) return 0;
  const diff = Math.floor((Date.now() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
};

const FILTER_TABS = [
  { key: 'ALL',     label: 'All', icon: BarChart2 },
  { key: 'OVERDUE', label: 'Overdue', icon: AlertCircle },
  { key: 'PARTIAL', label: 'Partial', icon: AlertTriangle },
  { key: 'PENDING', label: 'Pending', icon: Clock },
];

const Overdue = () => {
  const { showError } = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [repayments, setRepayments] = useState([]);
  const [statusFilter, setStatusFilter] = useState('OVERDUE'); // default to overdue
  const [searchTerm, setSearchTerm] = useState('');

  const fetchRepayments = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch all non-PAID repayments
      const responses = await Promise.all([
        repaymentAPI.getAllRepayments({ paymentStatus: 'OVERDUE', limit: 200 }),
        repaymentAPI.getAllRepayments({ paymentStatus: 'PARTIAL', limit: 200 }),
        repaymentAPI.getAllRepayments({ paymentStatus: 'PENDING', limit: 200 }),
      ]);

      const combined = responses.flatMap(
        (r) => (r.data?.status === 'success' ? r.data.data?.repayments || [] : [])
      );

      // Deduplicate by _id
      const seen = new Set();
      const unique = combined.filter((r) => {
        if (seen.has(r._id)) return false;
        seen.add(r._id);
        return true;
      });

      // Sort: OVERDUE first, then PARTIAL, then PENDING, then by dueDate
      const order = { OVERDUE: 0, PARTIAL: 1, PENDING: 2 };
      unique.sort((a, b) => {
        const statusDiff = (order[a.paymentStatus] ?? 3) - (order[b.paymentStatus] ?? 3);
        if (statusDiff !== 0) return statusDiff;
        return new Date(a.dueDate) - new Date(b.dueDate);
      });

      setRepayments(unique);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to load repayment data';
      setError(msg);
      showError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRepayments();
  }, []);

  // Summary from full dataset
  const summary = useMemo(() => ({
    overdueCount:  repayments.filter((r) => r.paymentStatus === 'OVERDUE').length,
    overdueAmount: repayments.filter((r) => r.paymentStatus === 'OVERDUE').reduce((s, r) => s + (r.amountDue - r.amountPaid), 0),
    partialCount:  repayments.filter((r) => r.paymentStatus === 'PARTIAL').length,
    pendingCount:  repayments.filter((r) => r.paymentStatus === 'PENDING').length,
  }), [repayments]);

  // Filtered + searched list
  const filtered = useMemo(() => {
    let list = repayments;
    if (statusFilter !== 'ALL') {
      list = list.filter((r) => r.paymentStatus === statusFilter);
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (r) =>
          r.borrower?.name?.toLowerCase().includes(q) ||
          r.borrower?.email?.toLowerCase().includes(q) ||
          r.loan?._id?.toLowerCase().includes(q) ||
          r.loan?.purpose?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [repayments, statusFilter, searchTerm]);

  const tabCounts = useMemo(() => ({
    ALL:     repayments.length,
    OVERDUE: summary.overdueCount,
    PARTIAL: summary.partialCount,
    PENDING: summary.pendingCount,
  }), [repayments, summary]);

  return (
    <div className="overdue-page-container">
      <PageHeader
        title="Overdue / Defaulters"
        subtitle="Monitor repayment installments that require attention"
      />

      {/* Summary Cards */}
      <div className="metrics-overview-grid">
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Overdue Installments</span>
            <div className="metric-icon-box rose"><AlertCircle size={18} /></div>
          </div>
          <div className="metric-main-value">{summary.overdueCount}</div>
          <div className="metric-footer-text">Past due with no payment</div>
        </div>
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Total Overdue Amount</span>
            <div className="metric-icon-box rose"><IndianRupee size={18} /></div>
          </div>
          <div className="metric-main-value overdue-amount-val">{fmt(summary.overdueAmount)}</div>
          <div className="metric-footer-text">Outstanding on overdue installments</div>
        </div>
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Partial Payments</span>
            <div className="metric-icon-box amber"><AlertTriangle size={18} /></div>
          </div>
          <div className="metric-main-value">{summary.partialCount}</div>
          <div className="metric-footer-text">Installments partly paid</div>
        </div>
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Pending Payments</span>
            <div className="metric-icon-box blue"><Clock size={18} /></div>
          </div>
          <div className="metric-main-value">{summary.pendingCount}</div>
          <div className="metric-footer-text">Not yet due or unpaid</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="overdue-filter-bar">
        <div className="overdue-tabs">
          {FILTER_TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              className={`docver-tab-btn ${statusFilter === key ? 'active' : ''}`}
              onClick={() => setStatusFilter(key)}
            >
              <Icon size={15} />
              <span>{label}</span>
              <span className="tab-count">{tabCounts[key]}</span>
            </button>
          ))}
        </div>
        <div className="overdue-filter-right">
          <div className="search-input-wrapper">
            <Search size={15} className="search-icon" />
            <input
              type="text"
              className="search-input"
              placeholder="Search farmer, loan, purpose..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button
            className="btn btn-secondary refresh-btn"
            onClick={fetchRepayments}
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? 'spinning' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="overdue-loader-wrap">
          <LoadingSpinner message="Loading repayment data..." />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={fetchRepayments} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<AlertTriangle size={40} />}
          title={statusFilter === 'ALL' ? 'No overdue or pending installments' : `No ${statusFilter.toLowerCase()} installments`}
          message={statusFilter === 'OVERDUE'
            ? 'All loans are being repaid on time. Great health!'
            : 'No installments match the current filter.'}
        />
      ) : (
        <div className="glass-panel overdue-table-panel">
          <div className="overdue-table-header">
            <span className="overdue-results-count">
              {filtered.length} installment{filtered.length !== 1 ? 's' : ''} found
            </span>
            {statusFilter !== 'ALL' && (
              <StatusBadge status={statusFilter} size="small" />
            )}
          </div>
          <div className="overdue-table-responsive">
            <table className="overdue-table">
              <thead>
                <tr>
                  <th>Farmer</th>
                  <th>Loan / Purpose</th>
                  <th>Installment #</th>
                  <th>Due Date</th>
                  <th>Amount Due</th>
                  <th>Amount Paid</th>
                  <th>Outstanding</th>
                  <th>Status</th>
                  <th>Days Overdue</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const outstanding = (r.amountDue || 0) - (r.amountPaid || 0);
                  const days = r.paymentStatus === 'OVERDUE' ? daysOverdue(r.dueDate) : null;
                  return (
                    <tr key={r._id} className={r.paymentStatus === 'OVERDUE' ? 'overdue-row' : ''}>
                      {/* Farmer */}
                      <td>
                        <div className="borrower-cell">
                          <div className="borrower-avatar-mini">
                            <User size={13} />
                          </div>
                          <div className="borrower-cell-info">
                            <span className="borrower-cell-name">{r.borrower?.name || '—'}</span>
                            <span className="borrower-cell-phone">{r.borrower?.email || ''}</span>
                          </div>
                        </div>
                      </td>
                      {/* Loan */}
                      <td>
                        <div className="loan-ref-cell">
                          <span className="loan-ref-id">#{r.loan?._id?.slice(-8).toUpperCase() || '—'}</span>
                          <span className="loan-ref-purpose">{r.loan?.purpose || ''}</span>
                        </div>
                      </td>
                      {/* Installment # */}
                      <td>
                        <span className="installment-tag">#{r.installmentNumber}</span>
                      </td>
                      {/* Due Date */}
                      <td>
                        <span className={`due-date-text ${r.paymentStatus === 'OVERDUE' ? 'overdue-date' : ''}`}>
                          {fmtDate(r.dueDate)}
                        </span>
                      </td>
                      {/* Amount Due */}
                      <td>
                        <span className="amount-cell due">{fmt(r.amountDue)}</span>
                      </td>
                      {/* Amount Paid */}
                      <td>
                        <span className={`amount-cell ${r.amountPaid > 0 ? 'paid' : 'zero'}`}>
                          {r.amountPaid > 0 ? fmt(r.amountPaid) : '—'}
                        </span>
                      </td>
                      {/* Outstanding */}
                      <td>
                        <span className={`amount-cell ${outstanding > 0 ? 'outstanding' : 'zero'}`}>
                          {outstanding > 0 ? fmt(outstanding) : '—'}
                        </span>
                      </td>
                      {/* Status */}
                      <td>
                        <StatusBadge status={r.paymentStatus} size="small" />
                      </td>
                      {/* Days Overdue */}
                      <td>
                        {days !== null ? (
                          <span className="days-overdue-badge">{days}d</span>
                        ) : (
                          <span className="text-dim">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Overdue;
