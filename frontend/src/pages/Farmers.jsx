import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Search,
  RefreshCw,
  Eye,
  User,
  Phone,
  Mail,
  MapPin,
  Building2,
  FileText,
  ShieldCheck,
  Calendar,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react';
import { loanAPI, documentAPI } from '../api/client';
import {
  PageHeader,
  DataTable,
  StatusBadge,
  LoadingSpinner,
  ErrorState,
  EmptyState,
} from '../components';
import './Farmers.css';

const Farmers = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [loans, setLoans] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedFarmer, setSelectedFarmer] = useState(null);
  const [activeModalTab, setActiveModalTab] = useState('profile');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [loansRes, docsRes] = await Promise.allSettled([
        loanAPI.getAllLoans({ limit: 100 }),
        documentAPI.getAllDocuments(),
      ]);

      let fetchedLoans = [];
      if (loansRes.status === 'fulfilled' && loansRes.value.data?.data?.loans) {
        fetchedLoans = loansRes.value.data.data.loans;
      } else if (loansRes.status === 'rejected') {
        console.warn('Loan fetch error:', loansRes.reason?.message);
      }

      let fetchedDocs = [];
      if (docsRes.status === 'fulfilled' && docsRes.value.data?.data?.documents) {
        fetchedDocs = docsRes.value.data.data.documents;
      } else if (docsRes.status === 'rejected') {
        console.warn('Document fetch error:', docsRes.reason?.message);
      }

      setLoans(fetchedLoans);
      setDocuments(fetchedDocs);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load farmer profiles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Process loans to group by unique Farmer entity
  const farmersList = useMemo(() => {
    const farmerMap = new Map();

    loans.forEach((loan) => {
      const farmerObj = loan.farmer;
      if (!farmerObj || !farmerObj._id) return;

      const farmerId = farmerObj._id.toString();

      if (!farmerMap.has(farmerId)) {
        farmerMap.set(farmerId, {
          _id: farmerId,
          name: farmerObj.name || 'N/A',
          email: farmerObj.email || 'N/A',
          phone: farmerObj.phone || 'N/A',
          fpoName: farmerObj.fpoName || 'Green Valley FPO',
          fpoRegistrationNo: farmerObj.fpoRegistrationNo || 'N/A',
          address: farmerObj.address || {},
          kycVerified: farmerObj.kycVerified ?? false,
          status: farmerObj.status || 'ACTIVE',
          createdAt: farmerObj.createdAt || loan.createdAt,
          loans: [],
          documents: [],
        });
      }

      const farmerRecord = farmerMap.get(farmerId);
      farmerRecord.loans.push(loan);
    });

    // Attach documents belonging to each farmer
    documents.forEach((doc) => {
      const docUserId = doc.user?._id || doc.user;
      if (docUserId && farmerMap.has(docUserId.toString())) {
        farmerMap.get(docUserId.toString()).documents.push(doc);
      }
    });

    return Array.from(farmerMap.values());
  }, [loans, documents]);

  // Search & Filtered Farmers
  const filteredFarmers = useMemo(() => {
    return farmersList.filter((farmer) => {
      const query = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !query ||
        farmer.name.toLowerCase().includes(query) ||
        farmer.email.toLowerCase().includes(query) ||
        farmer.phone.includes(query) ||
        (farmer.address?.village && farmer.address.village.toLowerCase().includes(query)) ||
        (farmer.address?.district && farmer.address.district.toLowerCase().includes(query));

      const latestLoan = farmer.loans[0];
      const matchesStatus =
        statusFilter === 'ALL' ||
        (latestLoan && latestLoan.status.toUpperCase() === statusFilter);

      return matchesSearch && matchesStatus;
    });
  }, [farmersList, searchTerm, statusFilter]);

  // Paginated data slice
  const paginatedFarmers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredFarmers.slice(start, start + pageSize);
  }, [filteredFarmers, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredFarmers.length / pageSize) || 1;

  // Format full address from User address schema
  const formatAddress = (addr) => {
    if (!addr) return 'Address not specified';
    const parts = [addr.village, addr.district, addr.state, addr.pincode].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : 'Location not specified';
  };

  // Table Columns
  const columns = [
    {
      header: 'Farmer Name',
      key: 'name',
      sortable: true,
      render: (item) => (
        <div className="farmer-profile-cell">
          <div className="farmer-avatar-icon">
            <User size={18} />
          </div>
          <div className="farmer-name-group">
            <span className="farmer-name-text">{item.name}</span>
            {item.kycVerified && (
              <span className="kyc-badge" title="KYC Verified">
                <CheckCircle2 size={12} /> KYC Verified
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      header: 'Contact Details',
      key: 'email',
      render: (item) => (
        <div className="contact-cell-group">
          <span className="contact-line">
            <Mail size={13} className="cell-icon" /> {item.email}
          </span>
          <span className="contact-line phone">
            <Phone size={13} className="cell-icon" /> {item.phone}
          </span>
        </div>
      ),
    },
    {
      header: 'FPO & Location',
      key: 'fpoName',
      render: (item) => (
        <div className="location-cell-group">
          <span className="fpo-line">
            <Building2 size={13} className="cell-icon" /> {item.fpoName}
          </span>
          <span className="address-line">
            <MapPin size={13} className="cell-icon" /> {formatAddress(item.address)}
          </span>
        </div>
      ),
    },
    {
      header: 'Applications',
      key: 'loans',
      align: 'center',
      render: (item) => (
        <span className="loan-count-badge">
          {item.loans.length} {item.loans.length === 1 ? 'Application' : 'Applications'}
        </span>
      ),
    },
    {
      header: 'Latest Status',
      key: 'status',
      align: 'center',
      render: (item) => {
        const latestLoan = item.loans[0];
        return latestLoan ? (
          <StatusBadge status={latestLoan.status} />
        ) : (
          <StatusBadge status="ACTIVE" customLabel="No Loans" />
        );
      },
    },
    {
      header: 'Member Since',
      key: 'createdAt',
      render: (item) => (
        <span className="date-cell">
          {new Date(item.createdAt).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
        </span>
      ),
    },
    {
      header: 'Actions',
      key: 'actions',
      align: 'right',
      render: (item) => (
        <button
          onClick={() => {
            setSelectedFarmer(item);
            setActiveModalTab('profile');
          }}
          className="btn btn-secondary view-farmer-btn"
          title="View Full Profile & Loans"
        >
          <Eye size={15} />
          <span>View Profile</span>
        </button>
      ),
    },
  ];

  return (
    <div className="farmers-page-container">
      <PageHeader
        title="Farmer Registry"
        subtitle="Manage and evaluate registered farmer members, active credit profiles, and document history"
        actions={
          <button onClick={fetchData} className="btn btn-secondary refresh-btn" disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spinning' : ''} />
            <span>Refresh Data</span>
          </button>
        }
      />

      {/* Filter & Search Bar */}
      <div className="farmers-filter-bar glass-panel">
        <div className="search-input-wrapper">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search by farmer name, email, phone, or village..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="filter-search-input"
          />
        </div>

        <div className="status-filter-wrapper">
          <label htmlFor="status-select" className="filter-label">
            Loan Status Filter:
          </label>
          <select
            id="status-select"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="filter-select"
          >
            <option value="ALL">All Application Statuses</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="DISBURSED">Disbursed</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="farmers-loading-container glass-panel">
          <LoadingSpinner message="Fetching farmer profiles from FPO credit database..." />
        </div>
      ) : error ? (
        <ErrorState title="Failed to Load Farmers" message={error} onRetry={fetchData} />
      ) : filteredFarmers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No Farmers Found"
          description={
            searchTerm || statusFilter !== 'ALL'
              ? 'No registered farmer profiles matched your search or filter criteria.'
              : 'There are currently no farmer members registered in the system.'
          }
          action={
            (searchTerm || statusFilter !== 'ALL') && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('ALL');
                }}
                className="btn btn-secondary"
              >
                Clear Filters
              </button>
            )
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={paginatedFarmers}
          pagination={{
            currentPage,
            totalPages,
            totalItems: filteredFarmers.length,
            pageSize,
            onPageChange: setCurrentPage,
            onPageSizeChange: (newSize) => {
              setPageSize(newSize);
              setCurrentPage(1);
            },
          }}
          onRowClick={(item) => {
            setSelectedFarmer(item);
            setActiveModalTab('profile');
          }}
        />
      )}

      {/* Farmer Details Modal Drawer */}
      {selectedFarmer && (
        <div className="modal-backdrop" onClick={() => setSelectedFarmer(null)}>
          <div className="modal-card glass-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-wrapper">
                <div className="modal-avatar">
                  <User size={22} />
                </div>
                <div>
                  <h2 className="modal-title">{selectedFarmer.name}</h2>
                  <span className="modal-subtitle">
                    Member ID: {selectedFarmer._id.substring(0, 8)}... | Role: FARMER
                  </span>
                </div>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => setSelectedFarmer(null)}
                aria-label="Close modal"
              >
                &times;
              </button>
            </div>

            {/* Modal Navigation Tabs */}
            <div className="modal-tabs">
              <button
                className={`tab-btn ${activeModalTab === 'profile' ? 'active' : ''}`}
                onClick={() => setActiveModalTab('profile')}
              >
                <User size={15} />
                <span>Profile & FPO</span>
              </button>
              <button
                className={`tab-btn ${activeModalTab === 'loans' ? 'active' : ''}`}
                onClick={() => setActiveModalTab('loans')}
              >
                <FileText size={15} />
                <span>Loan History ({selectedFarmer.loans.length})</span>
              </button>
              <button
                className={`tab-btn ${activeModalTab === 'documents' ? 'active' : ''}`}
                onClick={() => setActiveModalTab('documents')}
              >
                <ShieldCheck size={15} />
                <span>Verification Documents ({selectedFarmer.documents.length})</span>
              </button>
            </div>

            {/* Modal Body Views */}
            <div className="modal-body">
              {/* TAB 1: Profile & FPO Details */}
              {activeModalTab === 'profile' && (
                <div className="tab-content profile-tab">
                  <div className="detail-section">
                    <h3 className="section-title">Personal & Identity Information</h3>
                    <div className="detail-grid">
                      <div className="detail-field">
                        <span className="field-label">Full Name</span>
                        <span className="field-value">{selectedFarmer.name}</span>
                      </div>
                      <div className="detail-field">
                        <span className="field-label">Email Address</span>
                        <span className="field-value">{selectedFarmer.email}</span>
                      </div>
                      <div className="detail-field">
                        <span className="field-label">Phone Number</span>
                        <span className="field-value">{selectedFarmer.phone}</span>
                      </div>
                      <div className="detail-field">
                        <span className="field-label">KYC Verification Status</span>
                        <span className="field-value">
                          {selectedFarmer.kycVerified ? (
                            <span className="text-emerald font-semibold inline-flex items-center gap-1">
                              <CheckCircle2 size={14} /> Verified Member
                            </span>
                          ) : (
                            <span className="text-amber font-semibold inline-flex items-center gap-1">
                              <Clock size={14} /> Pending Verification
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="detail-field">
                        <span className="field-label">Account Status</span>
                        <span className="field-value">
                          <StatusBadge status={selectedFarmer.status} />
                        </span>
                      </div>
                      <div className="detail-field">
                        <span className="field-label">Registration Date</span>
                        <span className="field-value">
                          {new Date(selectedFarmer.createdAt).toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="detail-section">
                    <h3 className="section-title">FPO Affiliation & Residential Address</h3>
                    <div className="detail-grid">
                      <div className="detail-field">
                        <span className="field-label">FPO Name</span>
                        <span className="field-value">{selectedFarmer.fpoName}</span>
                      </div>
                      <div className="detail-field">
                        <span className="field-label">FPO Registration No</span>
                        <span className="field-value">{selectedFarmer.fpoRegistrationNo}</span>
                      </div>
                      <div className="detail-field col-span-2">
                        <span className="field-label">Full Residential Address</span>
                        <span className="field-value">{formatAddress(selectedFarmer.address)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: Loan History */}
              {activeModalTab === 'loans' && (
                <div className="tab-content loans-tab">
                  {selectedFarmer.loans.length === 0 ? (
                    <EmptyState
                      icon={FileText}
                      title="No Loan Applications"
                      description="This farmer has not submitted any loan applications yet."
                    />
                  ) : (
                    <div className="loans-list">
                      {selectedFarmer.loans.map((loan) => (
                        <div key={loan._id} className="loan-card-item glass-panel">
                          <div className="loan-card-header">
                            <div>
                              <span className="loan-id-tag">Loan ID: {loan._id.substring(0, 10)}...</span>
                              <h4 className="loan-purpose-title">{loan.purpose}</h4>
                            </div>
                            <StatusBadge status={loan.status} />
                          </div>

                          <div className="loan-card-details">
                            <div className="loan-metric">
                              <span className="metric-label">Loan Amount</span>
                              <span className="metric-value font-highlight">
                                ₹{loan.loanAmount?.toLocaleString('en-IN')}
                              </span>
                            </div>
                            <div className="loan-metric">
                              <span className="metric-label">Tenure</span>
                              <span className="metric-value">{loan.tenureMonths} Months</span>
                            </div>
                            <div className="loan-metric">
                              <span className="metric-label">Interest Rate</span>
                              <span className="metric-value">{loan.interestRate || 0}% p.a.</span>
                            </div>
                            {loan.disbursedAmount > 0 && (
                              <div className="loan-metric">
                                <span className="metric-label">Disbursed Amount</span>
                                <span className="metric-value text-indigo">
                                  ₹{loan.disbursedAmount?.toLocaleString('en-IN')}
                                </span>
                              </div>
                            )}
                          </div>

                          {loan.remarks && (
                            <div className="loan-remarks-box">
                              <strong>Remarks:</strong> {loan.remarks}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: Verification Documents */}
              {activeModalTab === 'documents' && (
                <div className="tab-content docs-tab">
                  {selectedFarmer.documents.length === 0 ? (
                    <EmptyState
                      icon={ShieldCheck}
                      title="No Documents Uploaded"
                      description="No verification documents have been uploaded for this farmer yet."
                    />
                  ) : (
                    <div className="docs-grid">
                      {selectedFarmer.documents.map((doc) => (
                        <div key={doc._id} className="doc-card-item glass-panel">
                          <div className="doc-card-header">
                            <span className="doc-type-badge">{doc.documentType || 'DOCUMENT'}</span>
                            <StatusBadge status={doc.status} size="small" />
                          </div>
                          <h4 className="doc-name-title">{doc.documentName}</h4>
                          <span className="doc-date">
                            Uploaded: {new Date(doc.uploadedAt || doc.createdAt).toLocaleDateString('en-IN')}
                          </span>

                          {doc.rejectionReason && (
                            <div className="doc-rejection-msg">
                              <strong>Reason:</strong> {doc.rejectionReason}
                            </div>
                          )}

                          {doc.fileUrl && (
                            <a
                              href={doc.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-secondary view-doc-link"
                            >
                              <ExternalLink size={14} />
                              <span>View Cloud Document</span>
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedFarmer(null)}>
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Farmers;
