// Simple token management using localStorage
export const TOKEN_KEY = 'auth_token';

export const getToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
};

export const setToken = (token: string): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
};

export const removeToken = (): void => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
};

export const isAuthenticated = (): boolean => {
  return !!getToken();
};

export const getAuthHeader = (): { Authorization: string } | {} => {
  const token = getToken();
  return token ? { Authorization: `Token ${token}` } : {};
};

// User role helpers
export const getUserRoles = (): string[] => {
  if (typeof window === 'undefined') return [];
  const userData = localStorage.getItem('user_data');
  if (!userData) return [];
  try {
    const user = JSON.parse(userData);
    return user.roles || [];
  } catch (e) {
    console.error('Error parsing user data:', e);
    return [];
  }
};

export const hasRole = (role: string): boolean => {
  const roles = getUserRoles();
  return roles.includes(role);
};

export const hasAnyRole = (roles: string[]): boolean => {
  const userRoles = getUserRoles();
  return roles.some(role => userRoles.includes(role));
};

// User data management
export const getUserData = (): any => {
  if (typeof window === 'undefined') return null;
  const userData = localStorage.getItem('user_data');
  return userData ? JSON.parse(userData) : null;
};

export const setUserData = (user: any): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem('user_data', JSON.stringify(user));
};

export const clearUserData = (): void => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('user_data');  
};
