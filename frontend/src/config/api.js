// API Base URL - reads from environment variable
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// API Endpoints
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: `${API_BASE_URL}/api/auth/login/`,
    SIGNUP: `${API_BASE_URL}/api/auth/signup/`,
    LOGOUT: `${API_BASE_URL}/api/auth/logout/`,
  },
  // Add other endpoints as needed
};

// Helper function for API calls
export const apiCall = async (url, options = {}) => {
  const defaultHeaders = {
    'Content-Type': 'application/json',
  };

  // Add auth token if exists
  const token = localStorage.getItem('token');
  if (token) {
    defaultHeaders['Authorization'] = `Token ${token}`;
  }

  const config = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };

  const response = await fetch(url, config);
  return response;
};
