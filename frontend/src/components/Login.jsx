import { API_ENDPOINTS, apiCall } from '../config/api';

// In your login function:
const handleLogin = async (email, password) => {
  try {
    const response = await apiCall(API_ENDPOINTS.AUTH.LOGIN, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (response.ok) {
      const data = await response.json();
      localStorage.setItem('token', data.token);
      // Handle successful login
    } else {
      // Handle error
      const error = await response.json();
      console.error('Login failed:', error);
    }
  } catch (error) {
    console.error('Login error:', error);
  }
};
