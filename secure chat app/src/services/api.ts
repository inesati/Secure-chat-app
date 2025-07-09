const API_BASE = 'http://localhost:3001/api';

export interface User {
  id: string;
  username: string;
  email: string;
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  user?: User;
  error?: string;
}

export class ApiService {
  private static token: string | null = localStorage.getItem('token');

  static setToken(token: string) {
    this.token = token;
    localStorage.setItem('token', token);
  }

  static clearToken() {
    this.token = null;
    localStorage.removeItem('token');
  }

  static getToken() {
    return this.token;
  }

  static async register(username: string, email: string, password: string): Promise<AuthResponse> {
    try {
      const response = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, email, password }),
      });

      const data = await response.json();
      
      if (data.success && data.token) {
        this.setToken(data.token);
      }

      return data;
    } catch (error) {
      return { success: false, error: 'Network error' };
    }
  }

  static async login(email: string, password: string): Promise<AuthResponse> {
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      
      if (data.success && data.token) {
        this.setToken(data.token);
      }

      return data;
    } catch (error) {
      return { success: false, error: 'Network error' };
    }
  }

  static async getOnlineUsers(): Promise<User[]> {
    try {
      const response = await fetch(`${API_BASE}/users/online`, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
        },
      });

      if (response.ok) {
        return await response.json();
      }
      
      return [];
    } catch (error) {
      console.error('Failed to fetch online users:', error);
      return [];
    }
  }
}