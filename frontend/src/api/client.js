import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach JWT Bearer Token if present
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('fpo_admin_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Global Error Handling & 401 Auto-Logout
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const { status, data } = error.response;
      if (status === 401) {
        console.warn('Authentication error or token expired:', data?.message);
        localStorage.removeItem('fpo_admin_token');
        localStorage.removeItem('fpo_admin_user');
        // Dispatch custom event so AuthContext can update state
        window.dispatchEvent(new Event('fpo_auth_logout'));
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;

// API Service Contracts Grounded Strictly in Backend Specification

export const authAPI = {
  login: (credentials) => apiClient.post('/auth/login', credentials),
  register: (userData) => apiClient.post('/auth/register', userData),
  getMe: () => apiClient.get('/auth/me'),
};

export const loanAPI = {
  getAllLoans: (params) => apiClient.get('/loans', { params }),
  getLoanById: (id) => apiClient.get(`/loans/${id}`),
  markUnderReview: (id) => apiClient.put(`/loans/${id}/under-review`),
  approveLoan: (id, body) => apiClient.put(`/loans/${id}/approve`, body),
  rejectLoan: (id, body) => apiClient.put(`/loans/${id}/reject`, body),
  disburseLoan: (id, body) => apiClient.put(`/loans/${id}/disburse`, body),
};

export const documentAPI = {
  getAllDocuments: (params) => apiClient.get('/documents', { params }),
  getLoanDocuments: (loanId) => apiClient.get(`/documents/loan/${loanId}`),
  verifyDocument: (id) => apiClient.put(`/documents/${id}/verify`),
  rejectDocument: (id, body) => apiClient.put(`/documents/${id}/reject`, body),
};

export const repaymentAPI = {
  getAllRepayments: (params) => apiClient.get('/repayments', { params }),
  getLoanRepayments: (loanId) => apiClient.get(`/repayments/loan/${loanId}`),
  markRepaymentPaid: (id, body) => apiClient.put(`/repayments/${id}/pay`, body),
};
