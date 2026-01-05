import React, { useState } from 'react';
import Dashboard from './components/Dashboard';
import AuthModal from './components/AuthModal';
import { User } from './types';

function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

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
