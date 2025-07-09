import React, { useState, useEffect } from 'react';
import { AuthForm } from './components/AuthForm';
import { ChatInterface } from './components/ChatInterface';
import { ApiService, type User } from './services/api';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Check if user is already logged in
    const token = ApiService.getToken();
    if (token) {
      // In a real app, you'd verify the token with the server
      // For now, we'll just check if it exists
      setIsAuthenticated(true);
      // You might want to decode the JWT to get user info
    }
  }, []);

  const handleAuth = async (formData: any) => {
    setLoading(true);
    setError('');

    try {
      let response;
      if (isLogin) {
        response = await ApiService.login(formData.email, formData.password);
      } else {
        response = await ApiService.register(formData.username, formData.email, formData.password);
      }

      if (response.success && response.user) {
        setCurrentUser(response.user);
        setIsAuthenticated(true);
      } else {
        setError(response.error || 'Authentication failed');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    ApiService.clearToken();
    setIsAuthenticated(false);
    setCurrentUser(null);
  };

  const toggleAuthMode = () => {
    setIsLogin(!isLogin);
    setError('');
  };

  if (isAuthenticated && currentUser) {
    return <ChatInterface currentUser={currentUser} onLogout={handleLogout} />;
  }

  return (
    <AuthForm
      isLogin={isLogin}
      onSubmit={handleAuth}
      onToggleMode={toggleAuthMode}
      loading={loading}
      error={error}
    />
  );
}

export default App;