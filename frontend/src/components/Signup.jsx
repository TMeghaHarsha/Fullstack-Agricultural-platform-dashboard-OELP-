import { API_ENDPOINTS, apiCall } from '../config/api';

// In your signup function:
const handleSignup = async (userData) => {
  try {
    const response = await apiCall(API_ENDPOINTS.AUTH.SIGNUP, {
      method: 'POST',
      body: JSON.stringify(userData),
    });

    if (response.ok) {
      const data = await response.json();
      // Handle successful signup
    } else {
      const error = await response.json();
      console.error('Signup failed:', error);
    }
  } catch (error) {
    console.error('Signup error:', error);
  }
};
