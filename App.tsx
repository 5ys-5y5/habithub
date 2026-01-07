
import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import FriendPage from './components/FriendPage';
import AuthModal from './components/AuthModal';
import { User } from './types';
import { preloadData, invalidateCache } from './services/sheetService';

const AUTH_KEY = 'habithub_current_user';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem(AUTH_KEY);
    return saved ? JSON.parse(saved) : null;
  });
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [currentView, setCurrentView] = useState<'dashboard' | 'friends'>('dashboard');
  const [viewingFriend, setViewingFriend] = useState<User | null>(null);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(AUTH_KEY, JSON.stringify(currentUser));
      // Pre-load friend data and records in the background immediately after login
      preloadData(currentUser.email);
    } else {
      localStorage.removeItem(AUTH_KEY);
      invalidateCache(); // Clear cache on logout
    }
  }, [currentUser]);

  const handleLogout = () => {
    setCurrentUser(null);
    setViewingFriend(null);
    setCurrentView('dashboard');
  };

  const handleNavigateToDashboard = () => {
    setViewingFriend(null); // Reset to my dashboard
    setCurrentView('dashboard');
  };

  const handleViewFriend = (friend: User) => {
    setViewingFriend(friend);
    setCurrentView('dashboard');
  };

  return (
    <>
      {currentView === 'dashboard' ? (
        <Dashboard 
          user={viewingFriend || currentUser} 
          currentUser={currentUser} // Pass the actual logged-in user for permission checks
          isReadOnly={!!viewingFriend && viewingFriend.email !== currentUser?.email}
          onLogout={handleLogout} 
          onLoginReq={() => setIsAuthModalOpen(true)}
          onNavigate={(view) => {
            if (view === 'dashboard') handleNavigateToDashboard();
            else setCurrentView(view);
          }}
        />
      ) : (
        <FriendPage
          user={currentUser!}
          onLogout={handleLogout}
          onNavigate={(view) => {
             if (view === 'dashboard') handleNavigateToDashboard();
             else setCurrentView(view);
          }}
          onViewFriend={handleViewFriend}
        />
      )}
      
      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)}
        onLoginSuccess={(user) => setCurrentUser(user)}
      />
    </>
  );
}
