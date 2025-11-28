import axios from 'axios';
import { getToken } from './auth';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to include the auth token
api.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Token ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add a response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle errors globally here
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('API Error:', error.response.data);
      return Promise.reject(error.response.data);
    } else if (error.request) {
      // The request was made but no response was received
      console.error('API Error: No response received', error.request);
      return Promise.reject({ detail: 'No response from server' });
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('API Error:', error.message);
      return Promise.reject({ detail: error.message });
    }
  }
);

export const apiRequest = async (
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  url: string,
  data: any = null,
  params: any = null
) => {
  try {
    const response = await api({
      method,
      url,
      data,
      params,
    });
    return response.data;
  } catch (error: any) {
    // The error is already processed by the interceptor
    throw error;
  }
};

export const get = (url: string, params: any = null) => 
  apiRequest('GET', url, null, params);

export const post = (url: string, data: any = null, params: any = null) => 
  apiRequest('POST', url, data, params);

export const put = (url: string, data: any = null, params: any = null) => 
  apiRequest('PUT', url, data, params);

export const patch = (url: string, data: any = null, params: any = null) => 
  apiRequest('PATCH', url, data, params);

export const del = (url: string, params: any = null) => 
  apiRequest('DELETE', url, null, params);

export default api;
