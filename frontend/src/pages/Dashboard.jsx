import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  Banknote,
  ShieldCheck,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  Eye,
  RefreshCw,
  Calendar,
  Building2,
  PieChart,
  BarChart3,
  SearchCheck,
  CreditCard,
  DollarSign,
  AlertCircle,
} from 'lucide-react';
import { loanAPI, repaymentAPI, documentAPI } from '../api/client';
import {
  PageHeader,
  DataTable,
  StatusBadge,
  LoadingSpinner,
  ErrorState,
  EmptyState,
} from '../components';
import './Dashboard.css';

const Dashboard = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Raw Datasets from Real Backend Endpoints
  const [loans, setLoans] = useState([]);
  const [repayments, setRepayments] = useState([]);
  const [documents, setDocuments] = useState([]);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [loansRes, repayRes, docsRes] = await Promise.allSettled([
        loanAPI.getAllLoans({ limit: 1000 }),
        repaymentAPI.getAllRepayments({ limit: 1000 }),
        documentAPI.getAllDocuments({ limit: 1000 }),
      ]);

      if (loansRes.status === 'fulfilled' && loansRes.value.data?.status === 'success') {
        setLoans(loansRes.value.data.data.loans || []);
      }
      if (repayRes.status === 'fulfilled' && repayRes.value.data?.status === 'success') {
        setRepayments(repayRes.value.data.data.repayments || []);
      }
      if (docsRes.status === 'fulfilled' && docsRes.value.data?.status === 'success') {
        setDocuments(docsRes.value.data.data.documents || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to load administrative dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Compute Real Backend Metrics & Summary Statistics
  const metrics = useMemo(() => {
    let totalApplications = loans.length;
    let countSubmitted = 0;
    let countUnderReview = 0;
    let countApproved = 0;
    let countRejected = 0;
    let countDisbursed = 0;
    let countClosed = 0;

    let totalRequestedCapital = 0;
    let totalDisbursedAmount = 0;

    // Set of unique farmers
    const farmerSet = new Set();

    loans.forEach((loan) => {
      const st = (loan.status || '').toUpperCase();
      totalRequestedCapital += loan.loanAmount || 0;

      if (loan.farmer?._id) {
        farmerSet.add(loan.farmer._id.toString());
      }

      if (st === 'SUBMITTED') countSubmitted++;
      else if (st === 'UNDER_REVIEW') countUnderReview++;
      else if (st === 'APPROVED') countApproved++;
      else if (st === 'REJECTED') countRejected++;
      else if (st === 'DISBURSED') {
        countDisbursed++;
        totalDisbursedAmount += loan.disbursedAmount || loan.loanAmount || 0;
      } else if (st === 'CLOSED') {
        countClosed++;
        totalDisbursedAmount += loan.disbursedAmount || loan.loanAmount || 0;
      }
    });

    let totalRepaid = 0;
    let overdueCount = 0;
    let overdueAmount = 0;

    repayments.forEach((r) => {
      totalRepaid += r.amountPaid || 0;
      const due = r.amountDue || 0;
      const paid = r.amountPaid || 0;
      if (r.paymentStatus === 'OVERDUE') {
        overdueCount++;
        overdueAmount += Math.max(0, due - paid);
      }
    });

    const outstandingAmount = Math.max(0, totalDisbursedAmount - totalRepaid);

    return {
      totalFarmers: farmerSet.size,
      totalApplications,
      countSubmitted,
      countUnderReview,
      countApproved,
      countRejected,
      countDisbursed,
      countClosed,
      totalRequestedCapital,
      totalDisbursedAmount,
      totalRepaid,
      outstandingAmount,
      overdueCount,
      overdueAmount,
    };
  }, [loans, repayments]);

  // Operational Action Queues
  const applicationsRequiringAttention = useMemo(() => {
    return loans
      .filter((l) => ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED'].includes((l.status || '').toUpperCase()))
      .slice(0, 5);
  }, [loans]);

  const recentApplications = useMemo(() => {
    return [...loans]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5);
  }, [loans]);

  const recentRepayments = useMemo(() => {
    return [...repayments]
      .sort((a, b) => new Date(b.updatedAt || b.dueDate) - new Date(a.updatedAt || a.dueDate))
      .slice(0, 5);
  }, [repayments]);

  // Applications grouped by month (YYYY-MM)
  const applicationsByMonth = useMemo(() => {
    const map = new Map();
    loans.forEach((loan) => {
      const date = new Date(loan.createdAt);
      const key = `${date.toLocaleString('default', { month: 'short' })} ${date.getFullYear()}`;
      map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries()).map(([month, count]) => ({ month, count }));
  }, [loans]);

  return (
    <div className="dashboard-page-container">
      <PageHeader
        title="Admin Overview Dashboard"
        subtitle="Real-time FPO agricultural credit operations, portfolio metrics, and action items"
        actions={
          <button onClick={fetchDashboardData} className="btn btn-secondary refresh-btn" disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spinning' : ''} />
            <span>Refresh Metrics</span>
          </button>
        }
      />

      {loading ? (
        <div className="dashboard-loading-card glass-panel">
          <LoadingSpinner message="Aggregating portfolio metrics and active loan queues from backend..." />
        </div>
      ) : error ? (
        <ErrorState title="Failed to Load Dashboard" message={error} onRetry={fetchDashboardData} />
      ) : (
        <div className="dashboard-body">
          {/* Top Operational Metrics Summary Grid */}
          <div className="metrics-grid">
            {/* Total Farmers */}
            <div className="summary-card glass-panel" onClick={() => navigate('/admin/farmers')}>
              <div className="card-top">
                <span className="card-title">Registered Farmers</span>
                <div className="icon-box blue">
                  <Users size={18} />
                </div>
              </div>
              <div className="card-value">{metrics.totalFarmers}</div>
              <div className="card-footer">
                <span>View Farmer Registry</span>
                <ArrowRight size={13} />
              </div>
            </div>

            {/* Total Applications */}
            <div className="summary-card glass-panel" onClick={() => navigate('/admin/loans')}>
              <div className="card-top">
                <span className="card-title">Total Applications</span>
                <div className="icon-box indigo">
                  <FileText size={18} />
                </div>
              </div>
              <div className="card-value">{metrics.totalApplications}</div>
              <div className="card-footer">
                <span>Requested: ₹{metrics.totalRequestedCapital.toLocaleString('en-IN')}</span>
                <ArrowRight size={13} />
              </div>
            </div>

            {/* Submitted & Under Review (Action Pending) */}
            <div className="summary-card glass-panel highlight-action" onClick={() => navigate('/admin/loans?status=UNDER_REVIEW')}>
              <div className="card-top">
                <span className="card-title">Pending Decision</span>
                <div className="icon-box amber">
                  <Clock size={18} />
                </div>
              </div>
              <div className="card-value text-amber">
                {metrics.countSubmitted + metrics.countUnderReview}
              </div>
              <div className="card-footer">
                <span>{metrics.countSubmitted} Submitted | {metrics.countUnderReview} Under Review</span>
                <ArrowRight size={13} />
              </div>
            </div>

            {/* Approved (Awaiting Disbursement) */}
            <div className="summary-card glass-panel" onClick={() => navigate('/admin/loans?status=APPROVED')}>
              <div className="card-top">
                <span className="card-title">Approved (Ready)</span>
                <div className="icon-box emerald">
                  <CheckCircle2 size={18} />
                </div>
              </div>
              <div className="card-value text-emerald">{metrics.countApproved}</div>
              <div className="card-footer">
                <span>Awaiting Capital Disbursement</span>
                <ArrowRight size={13} />
              </div>
            </div>

            {/* Disbursed Portfolio Capital */}
            <div className="summary-card glass-panel" onClick={() => navigate('/admin/loans?status=DISBURSED')}>
              <div className="card-top">
                <span className="card-title">Disbursed Portfolio</span>
                <div className="icon-box cyan">
                  <Banknote size={18} />
                </div>
              </div>
              <div className="card-value">₹{metrics.totalDisbursedAmount.toLocaleString('en-IN')}</div>
              <div className="card-footer">
                <span>{metrics.countDisbursed} Active | {metrics.countClosed} Closed</span>
                <ArrowRight size={13} />
              </div>
            </div>

            {/* Total Repaid Collections */}
            <div className="summary-card glass-panel" onClick={() => navigate('/admin/repayments')}>
              <div className="card-top">
                <span className="card-title">Total Collections Repaid</span>
                <div className="icon-box emerald">
                  <TrendingUp size={18} />
                </div>
              </div>
              <div className="card-value text-emerald">₹{metrics.totalRepaid.toLocaleString('en-IN')}</div>
              <div className="card-footer">
                <span>View Repayments Schedule</span>
                <ArrowRight size={13} />
              </div>
            </div>

            {/* Outstanding Balance */}
            <div className="summary-card glass-panel" onClick={() => navigate('/admin/repayments')}>
              <div className="card-top">
                <span className="card-title">Outstanding Balance</span>
                <div className="icon-box purple">
                  <CreditCard size={18} />
                </div>
              </div>
              <div className="card-value text-purple">₹{metrics.outstandingAmount.toLocaleString('en-IN')}</div>
              <div className="card-footer">
                <span>Principal Pending Collection</span>
                <ArrowRight size={13} />
              </div>
            </div>

            {/* Overdue Risk */}
            <div className="summary-card glass-panel highlight-danger" onClick={() => navigate('/admin/repayments?status=OVERDUE')}>
              <div className="card-top">
                <span className="card-title">Overdue Installments</span>
                <div className="icon-box rose">
                  <AlertTriangle size={18} />
                </div>
              </div>
              <div className="card-value text-rose">{metrics.overdueCount}</div>
              <div className="card-footer">
                <span>Risk Exposure: ₹{metrics.overdueAmount.toLocaleString('en-IN')}</span>
                <ArrowRight size={13} />
              </div>
            </div>
          </div>

          {/* Visual Analytics Charts Row */}
          <div className="charts-grid-row">
            {/* Chart 1: Application Pipeline Breakdown */}
            <div className="dashboard-chart-card glass-panel">
              <div className="chart-header">
                <BarChart3 size={18} className="text-primary" />
                <h3>Loan Application Pipeline</h3>
              </div>
              <div className="status-bars-container">
                <div className="status-bar-row">
                  <div className="bar-label-group">
                    <span>Submitted ({metrics.countSubmitted})</span>
                    <span>{metrics.totalApplications > 0 ? Math.round((metrics.countSubmitted / metrics.totalApplications) * 100) : 0}%</span>
                  </div>
                  <div className="bar-track">
                    <div
                      className="bar-fill blue"
                      style={{ width: `${metrics.totalApplications > 0 ? (metrics.countSubmitted / metrics.totalApplications) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                <div className="status-bar-row">
                  <div className="bar-label-group">
                    <span>Under Review ({metrics.countUnderReview})</span>
                    <span>{metrics.totalApplications > 0 ? Math.round((metrics.countUnderReview / metrics.totalApplications) * 100) : 0}%</span>
                  </div>
                  <div className="bar-track">
                    <div
                      className="bar-fill amber"
                      style={{ width: `${metrics.totalApplications > 0 ? (metrics.countUnderReview / metrics.totalApplications) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                <div className="status-bar-row">
                  <div className="bar-label-group">
                    <span>Approved ({metrics.countApproved})</span>
                    <span>{metrics.totalApplications > 0 ? Math.round((metrics.countApproved / metrics.totalApplications) * 100) : 0}%</span>
                  </div>
                  <div className="bar-track">
                    <div
                      className="bar-fill emerald"
                      style={{ width: `${metrics.totalApplications > 0 ? (metrics.countApproved / metrics.totalApplications) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                <div className="status-bar-row">
                  <div className="bar-label-group">
                    <span>Disbursed ({metrics.countDisbursed})</span>
                    <span>{metrics.totalApplications > 0 ? Math.round((metrics.countDisbursed / metrics.totalApplications) * 100) : 0}%</span>
                  </div>
                  <div className="bar-track">
                    <div
                      className="bar-fill cyan"
                      style={{ width: `${metrics.totalApplications > 0 ? (metrics.countDisbursed / metrics.totalApplications) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                <div className="status-bar-row">
                  <div className="bar-label-group">
                    <span>Closed / Paid ({metrics.countClosed})</span>
                    <span>{metrics.totalApplications > 0 ? Math.round((metrics.countClosed / metrics.totalApplications) * 100) : 0}%</span>
                  </div>
                  <div className="bar-track">
                    <div
                      className="bar-fill slate"
                      style={{ width: `${metrics.totalApplications > 0 ? (metrics.countClosed / metrics.totalApplications) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                <div className="status-bar-row">
                  <div className="bar-label-group">
                    <span>Rejected ({metrics.countRejected})</span>
                    <span>{metrics.totalApplications > 0 ? Math.round((metrics.countRejected / metrics.totalApplications) * 100) : 0}%</span>
                  </div>
                  <div className="bar-track">
                    <div
                      className="bar-fill rose"
                      style={{ width: `${metrics.totalApplications > 0 ? (metrics.countRejected / metrics.totalApplications) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Chart 2: Capital Deployment & Recovery Gauge */}
            <div className="dashboard-chart-card glass-panel">
              <div className="chart-header">
                <PieChart size={18} className="text-emerald" />
                <h3>Capital Recovery Ratio</h3>
              </div>
              <div className="capital-meter-wrapper">
                <div className="meter-ring">
                  <span className="meter-val">
                    {metrics.totalDisbursedAmount > 0
                      ? `${Math.min(100, Math.round((metrics.totalRepaid / metrics.totalDisbursedAmount) * 100))}%`
                      : '100%'}
                  </span>
                  <span className="meter-lbl">Recovered</span>
                </div>
                <div className="meter-breakdown">
                  <div className="breakdown-item">
                    <span className="dot emerald" />
                    <span>Repaid Collections: <strong>₹{metrics.totalRepaid.toLocaleString('en-IN')}</strong></span>
                  </div>
                  <div className="breakdown-item">
                    <span className="dot purple" />
                    <span>Outstanding Balance: <strong>₹{metrics.outstandingAmount.toLocaleString('en-IN')}</strong></span>
                  </div>
                  <div className="breakdown-item">
                    <span className="dot rose" />
                    <span>Overdue Exposure: <strong>₹{metrics.overdueAmount.toLocaleString('en-IN')}</strong></span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Actionable Queues & Lists */}
          <div className="tables-grid-row">
            {/* Queue 1: Applications Requiring Immediate Action */}
            <div className="queue-card glass-panel">
              <div className="queue-header">
                <div className="queue-title-group">
                  <Clock size={18} className="text-amber" />
                  <h3>Applications Requiring Attention ({applicationsRequiringAttention.length})</h3>
                </div>
                <button
                  className="queue-view-all"
                  onClick={() => navigate('/admin/loans?status=UNDER_REVIEW')}
                >
                  <span>View All</span>
                  <ArrowRight size={13} />
                </button>
              </div>

              {applicationsRequiringAttention.length === 0 ? (
                <EmptyState title="No Action Items Pending" description="All submitted loan applications have been evaluated." />
              ) : (
                <div className="queue-list">
                  {applicationsRequiringAttention.map((loan) => (
                    <div
                      key={loan._id}
                      className="queue-item"
                      onClick={() => navigate(`/admin/loans/${loan._id}`)}
                    >
                      <div className="queue-item-left">
                        <span className="queue-id">#{loan._id.substring(0, 8)}...</span>
                        <div className="queue-farmer">{loan.farmer?.name || 'Farmer'}</div>
                        <div className="queue-subtext">₹{loan.loanAmount?.toLocaleString('en-IN')} • {loan.purpose}</div>
                      </div>

                      <div className="queue-item-right">
                        <StatusBadge status={loan.status} size="small" />
                        <button className="btn btn-secondary action-icon-btn" title="View Application">
                          <Eye size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Queue 2: Recent Repayment Activity */}
            <div className="queue-card glass-panel">
              <div className="queue-header">
                <div className="queue-title-group">
                  <CreditCard size={18} className="text-emerald" />
                  <h3>Recent Repayment Activity</h3>
                </div>
                <button className="queue-view-all" onClick={() => navigate('/admin/repayments')}>
                  <span>View All</span>
                  <ArrowRight size={13} />
                </button>
              </div>

              {recentRepayments.length === 0 ? (
                <EmptyState title="No Repayment Activity" description="No repayment installments recorded yet." />
              ) : (
                <div className="queue-list">
                  {recentRepayments.map((repay) => (
                    <div
                      key={repay._id}
                      className="queue-item"
                      onClick={() => navigate('/admin/repayments')}
                    >
                      <div className="queue-item-left">
                        <span className="queue-id">Installment #{repay.installmentNumber}</span>
                        <div className="queue-farmer">{repay.borrower?.name || 'Borrower'}</div>
                        <div className="queue-subtext">
                          Paid: ₹{repay.amountPaid?.toLocaleString('en-IN')} / Due: ₹{repay.amountDue?.toLocaleString('en-IN')}
                        </div>
                      </div>

                      <div className="queue-item-right">
                        <StatusBadge status={repay.paymentStatus} size="small" />
                        <span className="queue-date">{new Date(repay.dueDate).toLocaleDateString('en-IN')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
