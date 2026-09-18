import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  Download,
  Printer,
  RefreshCw,
  FileText,
  CreditCard,
  AlertTriangle,
  Building2,
  CheckCircle2,
  XCircle,
  Banknote,
  Calendar,
  Filter,
  Users,
  ShieldAlert,
  Percent,
} from 'lucide-react';
import { loanAPI, repaymentAPI } from '../api/client';
import {
  PageHeader,
  DataTable,
  StatusBadge,
  LoadingSpinner,
  ErrorState,
  EmptyState,
  useToast,
} from '../components';
import './Reports.css';

const Reports = () => {
  const { showSuccess, showError } = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [loans, setLoans] = useState([]);
  const [repayments, setRepayments] = useState([]);

  // Active Report Tab: 'executive' | 'loans' | 'repayments' | 'fpo'
  const [activeTab, setActiveTab] = useState('executive');

  // Report Filter States
  const [dateRange, setDateRange] = useState('ALL'); // 'ALL' | '30DAYS' | 'THIS_MONTH' | 'THIS_YEAR'
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [repayStatusFilter, setRepayStatusFilter] = useState('ALL');
  const [fpoFilter, setFpoFilter] = useState('ALL');

  const fetchReportData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [loansRes, repayRes] = await Promise.allSettled([
        loanAPI.getAllLoans({ limit: 1000 }),
        repaymentAPI.getAllRepayments({ limit: 1000 }),
      ]);

      if (loansRes.status === 'fulfilled' && loansRes.value.data?.status === 'success') {
        setLoans(loansRes.value.data.data.loans || []);
      } else if (loansRes.status === 'rejected') {
        console.warn('Loan report fetch warning:', loansRes.reason?.message);
      }

      if (repayRes.status === 'fulfilled' && repayRes.value.data?.status === 'success') {
        setRepayments(repayRes.value.data.data.repayments || []);
      } else if (repayRes.status === 'rejected') {
        console.warn('Repayment report fetch warning:', repayRes.reason?.message);
      }
    } catch (err) {
      setError(err.message || 'Failed to compile report data from backend API');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, []);

  // Filter Loans by Date Range, Status & FPO
  const filteredLoans = useMemo(() => {
    return loans.filter((loan) => {
      const createdAt = new Date(loan.createdAt);
      const now = new Date();

      let matchesDate = true;
      if (dateRange === '30DAYS') {
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        matchesDate = createdAt >= thirtyDaysAgo;
      } else if (dateRange === 'THIS_MONTH') {
        matchesDate =
          createdAt.getMonth() === now.getMonth() && createdAt.getFullYear() === now.getFullYear();
      } else if (dateRange === 'THIS_YEAR') {
        matchesDate = createdAt.getFullYear() === now.getFullYear();
      }

      const matchesStatus =
        statusFilter === 'ALL' || (loan.status || '').toUpperCase() === statusFilter;

      const fpoName = loan.farmer?.fpoName || 'Green Valley FPO';
      const matchesFpo = fpoFilter === 'ALL' || fpoName === fpoFilter;

      return matchesDate && matchesStatus && matchesFpo;
    });
  }, [loans, dateRange, statusFilter, fpoFilter]);

  // Filter Repayments by Repayment Status
  const filteredRepayments = useMemo(() => {
    return repayments.filter((r) => {
      return repayStatusFilter === 'ALL' || (r.paymentStatus || '').toUpperCase() === repayStatusFilter;
    });
  }, [repayments, repayStatusFilter]);

  // Compiled Executive Metrics from real backend payload
  const analytics = useMemo(() => {
    let totalSubmittedCount = 0;
    let totalUnderReviewCount = 0;
    let totalApprovedCount = 0;
    let totalRejectedCount = 0;
    let totalDisbursedCount = 0;
    let totalClosedCount = 0;

    let totalRequestedCapital = 0;
    let totalDisbursedCapital = 0;

    filteredLoans.forEach((loan) => {
      const st = (loan.status || '').toUpperCase();
      totalRequestedCapital += loan.loanAmount || 0;

      if (st === 'SUBMITTED') totalSubmittedCount++;
      else if (st === 'UNDER_REVIEW') totalUnderReviewCount++;
      else if (st === 'APPROVED') {
        totalApprovedCount++;
      } else if (st === 'REJECTED') {
        totalRejectedCount++;
      } else if (st === 'DISBURSED') {
        totalDisbursedCount++;
        totalDisbursedCapital += loan.disbursedAmount || loan.loanAmount || 0;
      } else if (st === 'CLOSED') {
        totalClosedCount++;
        totalDisbursedCapital += loan.disbursedAmount || loan.loanAmount || 0;
      }
    });

    const evaluatedCount = totalApprovedCount + totalRejectedCount + totalDisbursedCount + totalClosedCount;
    const approvalRate = evaluatedCount > 0 ? ((totalApprovedCount + totalDisbursedCount + totalClosedCount) / evaluatedCount) * 100 : 0;
    const rejectionRate = evaluatedCount > 0 ? (totalRejectedCount / evaluatedCount) * 100 : 0;

    let totalCollectedRepaid = 0;
    let totalOverdueAmount = 0;
    let overdueInstallmentCount = 0;

    repayments.forEach((r) => {
      totalCollectedRepaid += r.amountPaid || 0;
      const due = r.amountDue || 0;
      const paid = r.amountPaid || 0;
      if (r.paymentStatus === 'OVERDUE') {
        overdueInstallmentCount++;
        totalOverdueAmount += Math.max(0, due - paid);
      }
    });

    const totalOutstandingCapital = Math.max(0, totalDisbursedCapital - totalCollectedRepaid);
    const collectionEfficiency =
      totalDisbursedCapital > 0
        ? Math.min(100, (totalCollectedRepaid / totalDisbursedCapital) * 100)
        : 0;

    return {
      totalApplications: filteredLoans.length,
      totalSubmittedCount,
      totalUnderReviewCount,
      totalApprovedCount,
      totalRejectedCount,
      totalDisbursedCount,
      totalClosedCount,
      totalRequestedCapital,
      totalDisbursedCapital,
      approvalRate: Math.round(approvalRate * 10) / 10,
      rejectionRate: Math.round(rejectionRate * 10) / 10,
      totalCollectedRepaid,
      totalOutstandingCapital,
      overdueInstallmentCount,
      totalOverdueAmount,
      collectionEfficiency: Math.round(collectionEfficiency * 10) / 10,
    };
  }, [filteredLoans, repayments]);

  // Extract unique FPOs for filter dropdown
  const fpoOptions = useMemo(() => {
    const set = new Set();
    loans.forEach((l) => {
      if (l.farmer?.fpoName) set.add(l.farmer.fpoName);
    });
    return Array.from(set);
  }, [loans]);

  // FPO Organizational Breakdown
  const fpoBreakdown = useMemo(() => {
    const map = new Map();
    loans.forEach((l) => {
      const fpo = l.farmer?.fpoName || 'Green Valley FPO';
      if (!map.has(fpo)) {
        map.set(fpo, {
          name: fpo,
          regNo: l.farmer?.fpoRegistrationNo || 'FPO-MH-2024',
          totalLoans: 0,
          disbursedCapital: 0,
          activeLoans: 0,
          closedLoans: 0,
        });
      }
      const record = map.get(fpo);
      record.totalLoans++;
      const st = (l.status || '').toUpperCase();
      if (st === 'DISBURSED') {
        record.activeLoans++;
        record.disbursedCapital += l.disbursedAmount || l.loanAmount || 0;
      } else if (st === 'CLOSED') {
        record.closedLoans++;
        record.disbursedCapital += l.disbursedAmount || l.loanAmount || 0;
      }
    });
    return Array.from(map.values());
  }, [loans]);

  // CSV Export Utility
  const handleExportCSV = () => {
    try {
      let csvContent = 'data:text/csv;charset=utf-8,';

      if (activeTab === 'loans' || activeTab === 'executive') {
        csvContent += 'Loan ID,Farmer Name,Farmer Phone,FPO Name,Purpose,Loan Amount (INR),Status,Created Date\n';
        filteredLoans.forEach((l) => {
          csvContent += `"${l._id}","${l.farmer?.name || ''}","${l.farmer?.phone || ''}","${l.farmer?.fpoName || ''}","${l.purpose || ''}",${l.loanAmount || 0},"${l.status}","${new Date(l.createdAt).toLocaleDateString('en-IN')}"\n`;
        });
      } else if (activeTab === 'repayments') {
        csvContent += 'Repayment ID,Loan ID,Borrower Name,Installment No,Due Date,Amount Due (INR),Amount Paid (INR),Payment Status,Payment Method\n';
        filteredRepayments.forEach((r) => {
          csvContent += `"${r._id}","${r.loan?._id || r.loan}","${r.borrower?.name || ''}",${r.installmentNumber},"${new Date(r.dueDate).toLocaleDateString('en-IN')}",${r.amountDue},${r.amountPaid},"${r.paymentStatus}","${r.paymentMethod || ''}"\n`;
        });
      }

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `FPO_Credit_Report_${activeTab.toUpperCase()}_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showSuccess('Report CSV exported successfully');
    } catch {
      showError('Failed to generate CSV export');
    }
  };

  const handlePrintReport = () => {
    window.print();
  };

  return (
    <div className="reports-page-container">
      <PageHeader
        title="Financial & Operational Analytics Reports"
        subtitle="Comprehensive credit portfolio insights, repayment efficiency ratios, and compliance reports compiled directly from backend data"
        actions={
          <div className="report-header-actions">
            <button onClick={handleExportCSV} className="btn btn-secondary">
              <Download size={15} />
              <span>Export CSV</span>
            </button>
            <button onClick={handlePrintReport} className="btn btn-secondary">
              <Printer size={15} />
              <span>Print / PDF</span>
            </button>
            <button onClick={fetchReportData} className="btn btn-secondary" disabled={loading}>
              <RefreshCw size={15} className={loading ? 'spinning' : ''} />
            </button>
          </div>
        }
      />

      {/* Global Report Filter Bar */}
      <div className="reports-filter-bar glass-panel">
        <div className="filter-item">
          <label htmlFor="date-range-select" className="filter-label">
            <Calendar size={14} /> Date Horizon:
          </label>
          <select
            id="date-range-select"
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="filter-select"
          >
            <option value="ALL">All Time</option>
            <option value="30DAYS">Last 30 Days</option>
            <option value="THIS_MONTH">This Calendar Month</option>
            <option value="THIS_YEAR">This Calendar Year</option>
          </select>
        </div>

        <div className="filter-item">
          <label htmlFor="loan-status-select" className="filter-label">
            <Filter size={14} /> Loan Status:
          </label>
          <select
            id="loan-status-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="filter-select"
          >
            <option value="ALL">All Loan Statuses</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="DISBURSED">Disbursed</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>

        <div className="filter-item">
          <label htmlFor="fpo-select" className="filter-label">
            <Building2 size={14} /> FPO Organization:
          </label>
          <select
            id="fpo-select"
            value={fpoFilter}
            onChange={(e) => setFpoFilter(e.target.value)}
            className="filter-select"
          >
            <option value="ALL">All FPO Organizations</option>
            {fpoOptions.map((fpo) => (
              <option key={fpo} value={fpo}>
                {fpo}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Navigation Report Tabs */}
      <div className="reports-tab-bar">
        <button
          className={`report-tab-btn ${activeTab === 'executive' ? 'active' : ''}`}
          onClick={() => setActiveTab('executive')}
        >
          <BarChart3 size={16} />
          <span>Executive Financial Summary</span>
        </button>
        <button
          className={`report-tab-btn ${activeTab === 'loans' ? 'active' : ''}`}
          onClick={() => setActiveTab('loans')}
        >
          <FileText size={16} />
          <span>Loan Applications Audit ({filteredLoans.length})</span>
        </button>
        <button
          className={`report-tab-btn ${activeTab === 'repayments' ? 'active' : ''}`}
          onClick={() => setActiveTab('repayments')}
        >
          <CreditCard size={16} />
          <span>Repayments & Default Risk ({filteredRepayments.length})</span>
        </button>
        <button
          className={`report-tab-btn ${activeTab === 'fpo' ? 'active' : ''}`}
          onClick={() => setActiveTab('fpo')}
        >
          <Building2 size={16} />
          <span>FPO Organization Breakdown</span>
        </button>
      </div>

      {/* Main Content Sections */}
      {loading ? (
        <div className="reports-loading-container glass-panel">
          <LoadingSpinner message="Compiling real-time report analytics from backend database..." />
        </div>
      ) : error ? (
        <ErrorState title="Failed to Compile Report Data" message={error} onRetry={fetchReportData} />
      ) : (
        <div className="report-tab-body">
          {/* TAB 1: Executive Financial Summary */}
          {activeTab === 'executive' && (
            <div className="executive-summary-section">
              {/* Summary Metrics KPI Grid */}
              <div className="kpi-cards-grid">
                <div className="kpi-card glass-panel">
                  <span className="kpi-label">Total Credit Applications</span>
                  <span className="kpi-value">{analytics.totalApplications}</span>
                  <span className="kpi-subtext">Requested: ₹{analytics.totalRequestedCapital.toLocaleString('en-IN')}</span>
                </div>

                <div className="kpi-card glass-panel">
                  <span className="kpi-label">Disbursed Portfolio Capital</span>
                  <span className="kpi-value text-indigo">
                    ₹{analytics.totalDisbursedCapital.toLocaleString('en-IN')}
                  </span>
                  <span className="kpi-subtext">
                    {analytics.totalDisbursedCount} Active | {analytics.totalClosedCount} Closed
                  </span>
                </div>

                <div className="kpi-card glass-panel">
                  <span className="kpi-label">Collections Repaid</span>
                  <span className="kpi-value text-emerald">
                    ₹{analytics.totalCollectedRepaid.toLocaleString('en-IN')}
                  </span>
                  <span className="kpi-subtext">Efficiency Ratio: {analytics.collectionEfficiency}%</span>
                </div>

                <div className="kpi-card glass-panel">
                  <span className="kpi-label">Outstanding Balance</span>
                  <span className="kpi-value text-amber">
                    ₹{analytics.totalOutstandingCapital.toLocaleString('en-IN')}
                  </span>
                  <span className="kpi-subtext">Capital pending collection</span>
                </div>

                <div className="kpi-card glass-panel">
                  <span className="kpi-label">Overdue Risk Exposure</span>
                  <span className="kpi-value text-rose">
                    ₹{analytics.totalOverdueAmount.toLocaleString('en-IN')}
                  </span>
                  <span className="kpi-subtext">{analytics.overdueInstallmentCount} Overdue Installments</span>
                </div>

                <div className="kpi-card glass-panel">
                  <span className="kpi-label">Evaluation Approval Rate</span>
                  <span className="kpi-value">{analytics.approvalRate}%</span>
                  <span className="kpi-subtext">Rejection Rate: {analytics.rejectionRate}%</span>
                </div>
              </div>

              {/* Visual SVG Distribution Charts */}
              <div className="visual-charts-grid">
                {/* Application Lifecycle Distribution Chart */}
                <div className="chart-card glass-panel">
                  <h3 className="chart-title">Application Pipeline Breakdown</h3>
                  <div className="chart-bars-list">
                    <div className="bar-item">
                      <div className="bar-info">
                        <span>Submitted Applications ({analytics.totalSubmittedCount})</span>
                        <span>{analytics.totalApplications > 0 ? Math.round((analytics.totalSubmittedCount / analytics.totalApplications) * 100) : 0}%</span>
                      </div>
                      <div className="bar-track">
                        <div
                          className="bar-fill blue"
                          style={{
                            width: `${analytics.totalApplications > 0 ? (analytics.totalSubmittedCount / analytics.totalApplications) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="bar-item">
                      <div className="bar-info">
                        <span>Under Review ({analytics.totalUnderReviewCount})</span>
                        <span>{analytics.totalApplications > 0 ? Math.round((analytics.totalUnderReviewCount / analytics.totalApplications) * 100) : 0}%</span>
                      </div>
                      <div className="bar-track">
                        <div
                          className="bar-fill amber"
                          style={{
                            width: `${analytics.totalApplications > 0 ? (analytics.totalUnderReviewCount / analytics.totalApplications) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="bar-item">
                      <div className="bar-info">
                        <span>Approved ({analytics.totalApprovedCount})</span>
                        <span>{analytics.totalApplications > 0 ? Math.round((analytics.totalApprovedCount / analytics.totalApplications) * 100) : 0}%</span>
                      </div>
                      <div className="bar-track">
                        <div
                          className="bar-fill emerald"
                          style={{
                            width: `${analytics.totalApplications > 0 ? (analytics.totalApprovedCount / analytics.totalApplications) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="bar-item">
                      <div className="bar-info">
                        <span>Disbursed Active Loans ({analytics.totalDisbursedCount})</span>
                        <span>{analytics.totalApplications > 0 ? Math.round((analytics.totalDisbursedCount / analytics.totalApplications) * 100) : 0}%</span>
                      </div>
                      <div className="bar-track">
                        <div
                          className="bar-fill indigo"
                          style={{
                            width: `${analytics.totalApplications > 0 ? (analytics.totalDisbursedCount / analytics.totalApplications) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="bar-item">
                      <div className="bar-info">
                        <span>Closed Paid Off Loans ({analytics.totalClosedCount})</span>
                        <span>{analytics.totalApplications > 0 ? Math.round((analytics.totalClosedCount / analytics.totalApplications) * 100) : 0}%</span>
                      </div>
                      <div className="bar-track">
                        <div
                          className="bar-fill slate"
                          style={{
                            width: `${analytics.totalApplications > 0 ? (analytics.totalClosedCount / analytics.totalApplications) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="bar-item">
                      <div className="bar-info">
                        <span>Rejected Applications ({analytics.totalRejectedCount})</span>
                        <span>{analytics.totalApplications > 0 ? Math.round((analytics.totalRejectedCount / analytics.totalApplications) * 100) : 0}%</span>
                      </div>
                      <div className="bar-track">
                        <div
                          className="bar-fill rose"
                          style={{
                            width: `${analytics.totalApplications > 0 ? (analytics.totalRejectedCount / analytics.totalApplications) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Capital Collection Recovery Meter */}
                <div className="chart-card glass-panel">
                  <h3 className="chart-title">Capital Collection Recovery Meter</h3>
                  <div className="recovery-meter-container">
                    <div className="meter-circle">
                      <span className="meter-percentage">{analytics.collectionEfficiency}%</span>
                      <span className="meter-label">Recovered</span>
                    </div>
                    <div className="meter-stats">
                      <div className="meter-stat-row">
                        <span className="stat-dot emerald" />
                        <span className="stat-text">Repaid: ₹{analytics.totalCollectedRepaid.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="meter-stat-row">
                        <span className="stat-dot amber" />
                        <span className="stat-text">Outstanding: ₹{analytics.totalOutstandingCapital.toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Loan Portfolio Report */}
          {activeTab === 'loans' && (
            <div className="loans-report-section">
              <DataTable
                columns={[
                  {
                    header: 'Loan ID',
                    key: '_id',
                    render: (l) => <span className="mono-text">#{l._id.substring(0, 10)}...</span>,
                  },
                  {
                    header: 'Farmer Member',
                    key: 'farmer',
                    render: (l) => l.farmer?.name || 'Farmer',
                  },
                  {
                    header: 'FPO Organization',
                    key: 'fpoName',
                    render: (l) => l.farmer?.fpoName || 'Green Valley FPO',
                  },
                  {
                    header: 'Requested Amount',
                    key: 'loanAmount',
                    render: (l) => `₹${l.loanAmount?.toLocaleString('en-IN')}`,
                  },
                  {
                    header: 'Disbursed Amount',
                    key: 'disbursedAmount',
                    render: (l) => (l.disbursedAmount > 0 ? `₹${l.disbursedAmount?.toLocaleString('en-IN')}` : '—'),
                  },
                  {
                    header: 'Tenure',
                    key: 'tenureMonths',
                    render: (l) => `${l.tenureMonths}m (${l.interestRate || 0}%)`,
                  },
                  {
                    header: 'Application Date',
                    key: 'createdAt',
                    render: (l) => new Date(l.createdAt).toLocaleDateString('en-IN'),
                  },
                  {
                    header: 'Status',
                    key: 'status',
                    align: 'center',
                    render: (l) => <StatusBadge status={l.status} size="small" />,
                  },
                ]}
                data={filteredLoans}
              />
            </div>
          )}

          {/* TAB 3: Repayment & Default Risk Report */}
          {activeTab === 'repayments' && (
            <div className="repayments-report-section">
              <DataTable
                columns={[
                  {
                    header: 'Repayment ID',
                    key: '_id',
                    render: (r) => <span className="mono-text">#{r._id.substring(0, 10)}...</span>,
                  },
                  {
                    header: 'Loan ID',
                    key: 'loan',
                    render: (r) => <span className="mono-text">#{(r.loan?._id || r.loan || '').substring(0, 8)}</span>,
                  },
                  {
                    header: 'Borrower',
                    key: 'borrower',
                    render: (r) => r.borrower?.name || 'Farmer',
                  },
                  {
                    header: 'Installment',
                    key: 'installmentNumber',
                    align: 'center',
                    render: (r) => `#${r.installmentNumber}`,
                  },
                  {
                    header: 'Due Date',
                    key: 'dueDate',
                    render: (r) => new Date(r.dueDate).toLocaleDateString('en-IN'),
                  },
                  {
                    header: 'Amount Due',
                    key: 'amountDue',
                    render: (r) => `₹${r.amountDue?.toLocaleString('en-IN')}`,
                  },
                  {
                    header: 'Amount Paid',
                    key: 'amountPaid',
                    render: (r) => `₹${r.amountPaid?.toLocaleString('en-IN')}`,
                  },
                  {
                    header: 'Remaining',
                    key: 'remaining',
                    render: (r) => `₹${Math.max(0, (r.amountDue || 0) - (r.amountPaid || 0)).toLocaleString('en-IN')}`,
                  },
                  {
                    header: 'Status',
                    key: 'paymentStatus',
                    align: 'center',
                    render: (r) => <StatusBadge status={r.paymentStatus} size="small" />,
                  },
                ]}
                data={filteredRepayments}
              />
            </div>
          )}

          {/* TAB 4: FPO Organization Breakdown */}
          {activeTab === 'fpo' && (
            <div className="fpo-report-section">
              <DataTable
                columns={[
                  {
                    header: 'FPO Organization Name',
                    key: 'name',
                    render: (f) => (
                      <div className="fpo-cell">
                        <Building2 size={16} className="text-emerald" />
                        <span className="font-semibold">{f.name}</span>
                      </div>
                    ),
                  },
                  {
                    header: 'Registration No',
                    key: 'regNo',
                    render: (f) => f.regNo,
                  },
                  {
                    header: 'Total Applications',
                    key: 'totalLoans',
                    align: 'center',
                    render: (f) => f.totalLoans,
                  },
                  {
                    header: 'Active Disbursed Loans',
                    key: 'activeLoans',
                    align: 'center',
                    render: (f) => f.activeLoans,
                  },
                  {
                    header: 'Closed Paid Off Loans',
                    key: 'closedLoans',
                    align: 'center',
                    render: (f) => f.closedLoans,
                  },
                  {
                    header: 'Disbursed Capital (₹)',
                    key: 'disbursedCapital',
                    align: 'right',
                    render: (f) => `₹${f.disbursedCapital.toLocaleString('en-IN')}`,
                  },
                ]}
                data={fpoBreakdown}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Reports;
