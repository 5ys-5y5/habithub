
import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import AuthModal from './components/AuthModal';
import { User } from './types';

const AUTH_KEY = 'habithub_current_user';

function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem(AUTH_KEY);
    return saved ? JSON.parse(saved) : null;
  });
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(AUTH_KEY, JSON.stringify(currentUser));
    } else {
      localStorage.removeItem(AUTH_KEY);
    }
  }, [currentUser]);

  const handleLogout = () => {
    setCurrentUser(null);
  };

  return (
    <>
      <Dashboard 
        user={currentUser} 
        onLogout={handleLogout} 
        onLoginReq={() => setIsAuthModalOpen(true)}
      />
      
      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)}
        onLoginSuccess={(user) => setCurrentUser(user)}
      />
    </>
  );
}

export default App;
