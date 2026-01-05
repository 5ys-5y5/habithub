import React, { useState } from 'react';
import { User } from '../types';
import { fetchUsers, createUser } from '../services/sheetService';
import { X, Mail, Loader2, Home, LogIn } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: User) => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onLoginSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        const users = await fetchUsers();
        const user = users.find(u => u.email.toLowerCase() === email.toLowerCase().trim());
        
        if (user) {
          onLoginSuccess(user);
          onClose();
        } else {
          setError('등록되지 않은 이메일입니다. (먼저 회원가입을 해주세요)');
        }
      } else {
        if (!email.includes('@')) {
           setError('유효한 이메일 주소를 입력해주세요.');
           setLoading(false);
           return;
        }
        
        const newUser: User = { name: name || email.split('@')[0], email };
        
        const success = await createUser(newUser);
        
        if (!success) {
           setError("서버에 연결할 수 없습니다. 관리자에게 문의하세요.");
           setLoading(false);
           return;
        }
        
        onLoginSuccess(newUser);
        alert("회원가입이 완료되었습니다.");
        onClose();
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-github-bg rounded-xl shadow-2xl border border-github-border overflow-hidden flex flex-col relative">
        <button 
          onClick={onClose} 
          className="absolute right-4 top-4 text-github-muted hover:text-github-text transition-colors p-1"
          title="홈으로 돌아가기"
        >
          <X size={20} />
        </button>

        <div className="p-8 pb-6">
          <div className="text-center space-y-2 mb-8">
            <h2 className="text-2xl font-bold tracking-tight text-github-text">
              HabitHub
            </h2>
            <p className="text-github-muted text-sm">
              {isLogin ? '계정에 로그인하여 습관을 관리하세요' : '새로운 계정을 생성하고 시작하세요'}
            </p>
          </div>

          <div className="flex border-b border-github-border mb-6">
            <button
              onClick={() => { setIsLogin(true); setError(''); }}
              className={`flex-1 pb-3 text-sm font-medium border-b-2 transition-colors ${isLogin ? 'border-github-accent text-github-text' : 'border-transparent text-github-muted hover:text-github-text'}`}
            >
              로그인
            </button>
            <button
              onClick={() => { setIsLogin(false); setError(''); }}
              className={`flex-1 pb-3 text-sm font-medium border-b-2 transition-colors ${!isLogin ? 'border-github-accent text-github-text' : 'border-transparent text-github-muted hover:text-github-text'}`}
            >
              회원가입
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-github-text">이름</label>
                <input
                  type="text"
                  required={!isLogin}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="block w-full h-10 px-3 rounded-md border border-github-border bg-github-bg text-github-text focus:border-github-accent focus:ring-1 focus:ring-github-accent focus:outline-none text-sm"
                  placeholder="홍길동"
                />
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-semibold text-github-text">Gmail 주소</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-github-muted">
                  <Mail size={16} />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-9 h-10 rounded-md border border-github-border bg-github-bg text-github-text focus:border-github-accent focus:ring-1 focus:ring-github-accent focus:outline-none text-sm"
                  placeholder="user@gmail.com"
                />
              </div>
            </div>

            {error && (
              <div className="text-red-400 text-xs bg-red-900/20 border border-red-900/50 p-2 rounded-md whitespace-pre-wrap">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 flex items-center justify-center rounded-md bg-github-btn border border-github-border text-github-text font-bold hover:bg-github-btnHover transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2 gap-2"
            >
              {loading ? <Loader2 className="animate-spin w-4 h-4" /> : (
                <>
                  <LogIn size={16} />
                  {isLogin ? '로그인' : '회원가입'}
                </>
              )}
            </button>
          </form>
        </div>
        
        <div className="bg-github-card p-4 text-center border-t border-github-border flex justify-between items-center">
          <button 
             onClick={onClose}
             className="text-xs text-github-muted hover:text-github-accent flex items-center justify-center gap-1 mx-auto"
          >
             <Home size={12} /> 둘러보기
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;