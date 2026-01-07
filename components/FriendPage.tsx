
import React, { useState, useEffect } from 'react';
import { User, Friend, HabitRecord } from '../types';
import { fetchFriends, requestFriend, respondFriend, removeFriend, getAllRecords, fetchUsers } from '../services/sheetService';
import { Users, UserPlus, Search, Zap, Loader2, Trophy, Medal, LogOut, LayoutDashboard, Trash2, CheckCircle2, Eye } from 'lucide-react';

interface FriendPageProps {
  user: User;
  onLogout: () => void;
  onNavigate: (view: 'dashboard' | 'friends') => void;
  onViewFriend?: (friend: User) => void;
}

interface RankedUser {
  name: string;
  email: string;
  avgRate: number;
  rank: number;
  isMe: boolean;
}

const FriendPage: React.FC<FriendPageProps> = ({ user, onLogout, onNavigate, onViewFriend }) => {
  const [activeTab, setActiveTab] = useState<'list' | 'add' | 'requests'>('list');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [rankings, setRankings] = useState<RankedUser[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Loading states for specific actions
  const [actionLoading, setActionLoading] = useState<{[key: string]: boolean}>({});
  const [toast, setToast] = useState<{msg: string, type: 'success' | 'error'} | null>(null);

  useEffect(() => {
    loadData();
  }, [user]);

  // Toast Timer
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [friendList, allRecords] = await Promise.all([
        fetchFriends(user.email),
        getAllRecords()
      ]);
      setFriends(friendList);
      calculateRankings(friendList, allRecords);
    } finally {
      setLoading(false);
    }
  };

  const getLocalISOString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const calculateRankings = (friendList: Friend[], allRecords: HabitRecord[]) => {
    const acceptedFriends = friendList.filter(f => f.status === 'accepted');
    // Targets: Me + Accepted Friends
    const targets = new Set([user.email.toLowerCase(), ...acceptedFriends.map(f => f.requester === user.email.toLowerCase() ? f.receiver : f.requester)]);
    
    const stats: RankedUser[] = [];

    targets.forEach(email => {
       const userRecords = allRecords.filter(r => r.email === email && r.habit && r.habit.recordStatus === 'active');
       let totalRate = 0;
       let count = 0;
       
       const today = new Date();

       userRecords.forEach(r => {
          // Calculate weekly rate for this habit
          let habitSuccess = 0;
          let habitExpected = 0;
          for (let i = 0; i < 7; i++) {
             const d = new Date(today); d.setDate(today.getDate() - i);
             const dateStr = getLocalISOString(d);
             const dayOfWeek = d.getDay();
             const { frequency } = r.habit;
             let isExpected = false;
             if (frequency.type === 'daily') isExpected = true;
             else if (frequency.type === 'specific_days') isExpected = frequency.days?.includes(dayOfWeek) || false;
             else if (frequency.type === 'weekly_count') isExpected = true;

             if (isExpected) {
                habitExpected++;
                if (r.logs[dateStr] === true) habitSuccess++;
             }
          }
          if (habitExpected > 0) {
             totalRate += (habitSuccess / habitExpected) * 100;
             count++;
          }
       });

       const avgRate = count > 0 ? Math.round(totalRate / count) : 0;
       const name = email === user.email.toLowerCase() ? user.name : (email.split('@')[0]);
       
       stats.push({
          name,
          email,
          avgRate,
          rank: 0,
          isMe: email === user.email.toLowerCase()
       });
    });

    stats.sort((a, b) => b.avgRate - a.avgRate);
    
    // Assign Ranks (handle ties)
    let currentRank = 1;
    for (let i = 0; i < stats.length; i++) {
       if (i > 0 && stats[i].avgRate < stats[i-1].avgRate) {
          currentRank = i + 1;
       }
       stats[i].rank = currentRank;
    }

    setRankings(stats);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.includes('@')) {
       alert("이메일 형식을 정확히 입력해주세요.");
       return;
    }
    setSearchLoading(true);
    try {
       const allUsers = await fetchUsers();
       const found = allUsers.filter(u => u.email.toLowerCase().includes(searchTerm.toLowerCase()) && u.email.toLowerCase() !== user.email.toLowerCase());
       setSearchResults(found);
    } catch (err) {
    } finally {
       setSearchLoading(false);
    }
  };

  const sendRequest = async (receiverEmail: string) => {
    const key = `req-${receiverEmail}`;
    setActionLoading(prev => ({ ...prev, [key]: true }));
    try {
      const result = await requestFriend(user.email, receiverEmail);
      if (result.status === 'error') throw new Error(result.message);
      await loadData();
      showToast('친구 요청을 보냈습니다!');
      setSearchTerm('');
      setSearchResults([]);
    } catch (e) {
      alert('요청 실패: ' + String(e));
    } finally {
      setActionLoading(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleRespond = async (friendEmail: string, accept: boolean) => {
    const key = `res-${friendEmail}-${accept}`;
    setActionLoading(prev => ({ ...prev, [key]: true }));
    try {
      const status = accept ? 'accepted' : 'rejected';
      await respondFriend(friendEmail, user.email, status);
      await loadData();
      showToast(accept ? '친구 요청을 수락했습니다!' : '친구 요청을 거절했습니다.');
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleDelete = async (friendEmail: string) => {
    if (confirm(`${friendEmail}님을 친구 목록에서 삭제하시겠습니까?`)) {
      const key = `del-${friendEmail}`;
      setActionLoading(prev => ({ ...prev, [key]: true }));
      try {
        await removeFriend(user.email, friendEmail);
        await loadData();
        showToast('친구가 삭제되었습니다.');
      } finally {
        setActionLoading(prev => ({ ...prev, [key]: false }));
      }
    }
  };

  const pendingRequests = friends.filter(f => f.status === 'pending' && f.receiver === user.email.toLowerCase());
  const sentRequests = friends.filter(f => f.status === 'pending' && f.requester === user.email.toLowerCase());
  const acceptedFriends = friends.filter(f => f.status === 'accepted');

  return (
    <div className="min-h-screen bg-github-bg text-github-text font-sans flex flex-col relative">
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top-4 fade-in">
          <div className={`px-4 py-3 rounded-full shadow-lg flex items-center gap-2 font-bold text-sm ${toast.type === 'success' ? 'bg-github-success text-white' : 'bg-red-500 text-white'}`}>
             {toast.type === 'success' ? <CheckCircle2 size={16}/> : <Trash2 size={16}/>}
             {toast.msg}
          </div>
        </div>
      )}

       <nav className="bg-github-card border-b border-github-border py-4 px-4 sm:px-6 flex justify-between items-center z-20 shadow-sm flex-shrink-0">
        <h1 
          onClick={() => onNavigate('dashboard')} 
          className="font-bold text-lg tracking-tight text-white cursor-pointer hover:text-github-accent transition-colors"
        >
          HabitHub
        </h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-github-muted hidden sm:inline"><span className="text-github-text font-medium">{user.name}</span>님</span>
          <button onClick={() => onNavigate('dashboard')} className="p-2 hover:bg-github-btnHover rounded-md text-github-muted hover:text-github-accent transition-colors" title="대시보드">
            <LayoutDashboard size={18} />
          </button>
          <button onClick={onLogout} className="p-2 hover:bg-github-btnHover rounded-md text-github-muted hover:text-red-400 transition-colors" title="로그아웃">
            <LogOut size={18} />
          </button>
        </div>
      </nav>

      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-8 grid grid-cols-1 md:grid-cols-3 gap-6">
         {/* Left Column: Profile & Leaderboard */}
         <div className="space-y-6 md:col-span-1">
            <section className="bg-github-card border border-github-border rounded-xl p-6 shadow-sm">
               <div className="flex flex-col items-center">
                  <div className="w-20 h-20 bg-gradient-to-br from-github-accent to-blue-700 rounded-full flex items-center justify-center text-3xl font-bold text-white mb-4 shadow-lg">
                     {user.name.charAt(0)}
                  </div>
                  <h2 className="text-xl font-bold text-white">{user.name}</h2>
                  <p className="text-sm text-github-muted">{user.email}</p>
               </div>
            </section>

            <section className="bg-github-card border border-github-border rounded-xl p-6 shadow-sm relative overflow-hidden">
               <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Trophy size={100} className="text-yellow-500" />
               </div>
               <h3 className="font-bold text-lg text-white mb-4 flex items-center gap-2 relative z-10">
                  <Trophy size={20} className="text-yellow-500"/> 금주의 랭킹
               </h3>
               <div className="space-y-3 relative z-10">
                  {rankings.length === 0 ? (
                     <p className="text-sm text-github-muted text-center py-4">데이터를 불러오는 중이거나<br/>순위 데이터가 없습니다.</p>
                  ) : (
                     rankings.map((r) => (
                        <div key={r.email} className={`flex items-center p-3 rounded-lg border ${r.isMe ? 'bg-github-btn border-github-accent' : 'bg-github-bg border-github-border'}`}>
                           <div className={`w-8 h-8 rounded flex items-center justify-center font-bold mr-3 ${r.rank === 1 ? 'bg-yellow-500/20 text-yellow-500' : r.rank === 2 ? 'bg-gray-400/20 text-gray-400' : r.rank === 3 ? 'bg-orange-700/20 text-orange-700' : 'text-github-muted'}`}>
                              {r.rank <= 3 ? <Medal size={16} /> : r.rank}
                           </div>
                           <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                 <span className={`font-bold text-sm truncate ${r.isMe ? 'text-github-accent' : 'text-github-text'}`}>{r.name}</span>
                                 {r.isMe && <span className="text-[10px] bg-github-accent/10 text-github-accent px-1 rounded">ME</span>}
                              </div>
                              <div className="w-full bg-github-border h-1.5 rounded-full mt-1.5 overflow-hidden">
                                 <div className={`h-full rounded-full ${r.rank === 1 ? 'bg-yellow-500' : 'bg-github-success'}`} style={{ width: `${r.avgRate}%` }}></div>
                              </div>
                           </div>
                           <div className="font-mono font-bold text-sm ml-3">{r.avgRate}%</div>
                        </div>
                     ))
                  )}
               </div>
            </section>
         </div>

         {/* Right Column: Friend Management */}
         <div className="md:col-span-2 space-y-6">
            <div className="bg-github-card border border-github-border rounded-xl overflow-hidden shadow-sm">
               <div className="flex border-b border-github-border">
                  <button onClick={() => setActiveTab('list')} className={`flex-1 py-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'list' ? 'border-github-accent text-github-text bg-github-btn' : 'border-transparent text-github-muted hover:text-github-text hover:bg-github-bg'}`}>내 친구 목록</button>
                  <button onClick={() => setActiveTab('requests')} className={`flex-1 py-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'requests' ? 'border-github-accent text-github-text bg-github-btn' : 'border-transparent text-github-muted hover:text-github-text hover:bg-github-bg'}`}>
                     받은 요청 {pendingRequests.length > 0 && <span className="ml-1 px-1.5 py-0.5 bg-red-500 text-white text-[10px] rounded-full">{pendingRequests.length}</span>}
                  </button>
                  <button onClick={() => setActiveTab('add')} className={`flex-1 py-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'add' ? 'border-github-accent text-github-text bg-github-btn' : 'border-transparent text-github-muted hover:text-github-text hover:bg-github-bg'}`}>친구 추가</button>
               </div>

               <div className="p-6 min-h-[400px]">
                  {activeTab === 'list' && (
                     <div className="space-y-4">
                        <div className="flex items-center justify-between mb-4">
                           <h3 className="font-bold flex items-center gap-2"><Users size={18}/> 친구 ({acceptedFriends.length}명)</h3>
                           <span className="text-xs text-github-muted">친구를 클릭하면 대시보드를 구경할 수 있어요</span>
                        </div>
                        {acceptedFriends.length === 0 ? (
                           <div className="text-center py-20 text-github-muted border-2 border-dashed border-github-border rounded-xl">
                              <Users size={48} className="mx-auto mb-4 opacity-20" />
                              <p>아직 친구가 없습니다.</p>
                              <button onClick={() => setActiveTab('add')} className="mt-4 text-github-accent hover:underline text-sm font-bold">친구 추가하러 가기</button>
                           </div>
                        ) : (
                           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              {acceptedFriends.map(f => {
                                 const friendEmail = f.requester === user.email.toLowerCase() ? f.receiver : f.requester;
                                 const friendName = friendEmail.split('@')[0];
                                 return (
                                    <div 
                                      key={f.id} 
                                      onClick={() => onViewFriend && onViewFriend({ name: friendName, email: friendEmail })}
                                      className="p-4 bg-github-bg border border-github-border rounded-lg flex items-center justify-between group hover:border-github-accent/50 hover:bg-github-card transition-all cursor-pointer relative"
                                    >
                                       <div className="flex items-center gap-3">
                                          <div className="w-10 h-10 rounded-full bg-github-border flex items-center justify-center font-bold text-github-text">
                                             {friendEmail[0].toUpperCase()}
                                          </div>
                                          <div>
                                             <div className="font-bold text-sm flex items-center gap-1">
                                               {friendName}
                                               <Eye size={12} className="opacity-0 group-hover:opacity-100 transition-opacity text-github-accent" />
                                             </div>
                                             <div className="text-xs text-github-muted truncate max-w-[120px]">{friendEmail}</div>
                                          </div>
                                       </div>
                                       <div className="flex items-center">
                                          {actionLoading[`del-${friendEmail}`] ? (
                                            <Loader2 className="animate-spin text-github-muted" size={16} />
                                          ) : (
                                            <button 
                                              onClick={(e) => { e.stopPropagation(); handleDelete(friendEmail); }} 
                                              className="p-2 text-github-muted hover:text-red-400 hover:bg-github-bg rounded-md opacity-0 group-hover:opacity-100 transition-all" 
                                              title="친구 삭제"
                                            >
                                              <Trash2 size={16} />
                                            </button>
                                          )}
                                       </div>
                                    </div>
                                 );
                              })}
                           </div>
                        )}
                     </div>
                  )}

                  {activeTab === 'requests' && (
                     <div className="space-y-6">
                        <div>
                           <h3 className="font-bold text-github-accent flex items-center gap-2 mb-4"><Zap size={18}/> 받은 요청</h3>
                           {pendingRequests.length === 0 ? (
                              <div className="text-sm text-github-muted py-4">받은 친구 요청이 없습니다.</div>
                           ) : (
                              <div className="space-y-3">
                                 {pendingRequests.map(f => (
                                    <div key={f.id} className="flex items-center justify-between p-4 bg-github-bg border border-github-border rounded-lg">
                                       <span className="font-bold text-sm">{f.requester}</span>
                                       <div className="flex gap-2">
                                          <button 
                                            onClick={() => handleRespond(f.requester, true)} 
                                            disabled={actionLoading[`res-${f.requester}-true`]}
                                            className="px-4 py-1.5 bg-github-success text-white text-xs font-bold rounded-md hover:bg-github-successHover flex items-center gap-1 disabled:opacity-50"
                                          >
                                            {actionLoading[`res-${f.requester}-true`] && <Loader2 className="animate-spin" size={12} />} 수락
                                          </button>
                                          <button 
                                            onClick={() => handleRespond(f.requester, false)} 
                                            disabled={actionLoading[`res-${f.requester}-false`]}
                                            className="px-4 py-1.5 bg-github-card border border-github-border text-xs font-bold rounded-md hover:text-red-400 disabled:opacity-50 flex items-center gap-1"
                                          >
                                            {actionLoading[`res-${f.requester}-false`] && <Loader2 className="animate-spin" size={12} />} 거절
                                          </button>
                                       </div>
                                    </div>
                                 ))}
                              </div>
                           )}
                        </div>

                        {sentRequests.length > 0 && (
                           <div>
                              <h3 className="font-bold text-github-muted flex items-center gap-2 mb-4 mt-8 border-t border-github-border pt-8">보낸 요청</h3>
                              <div className="space-y-3">
                                 {sentRequests.map(f => (
                                    <div key={f.id} className="flex items-center justify-between p-4 bg-github-bg border border-github-border rounded-lg opacity-70">
                                       <span className="text-sm">{f.receiver}</span>
                                       <span className="text-xs bg-github-card px-2 py-1 rounded border border-github-border">대기중</span>
                                    </div>
                                 ))}
                              </div>
                           </div>
                        )}
                     </div>
                  )}

                  {activeTab === 'add' && (
                     <div className="max-w-md mx-auto py-8">
                        <div className="text-center mb-6">
                           <UserPlus size={48} className="mx-auto text-github-accent mb-4" />
                           <h3 className="text-lg font-bold">새로운 친구 찾기</h3>
                           <p className="text-sm text-github-muted">이메일로 친구를 검색하고 요청을 보내보세요.</p>
                        </div>
                        <form onSubmit={handleSearch} className="relative mb-6">
                           <input type="text" placeholder="이메일 주소 입력" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-github-bg border border-github-border rounded-lg pl-10 pr-4 py-3 text-sm focus:border-github-accent focus:outline-none" />
                           <Search className="absolute left-3 top-3.5 text-github-muted" size={18} />
                           <button type="submit" disabled={searchLoading} className="absolute right-2 top-2 bg-github-btn text-xs font-bold px-3 py-1.5 rounded border border-github-border hover:bg-github-btnHover flex items-center gap-1">
                              {searchLoading ? <Loader2 className="animate-spin w-4 h-4"/> : '검색'}
                           </button>
                        </form>

                        <div className="space-y-2">
                           {searchResults.map(u => {
                              const isFriend = friends.some(f => f.requester === u.email || f.receiver === u.email);
                              const reqKey = `req-${u.email}`;
                              return (
                                 <div key={u.email} className="flex items-center justify-between bg-github-bg p-4 rounded-lg border border-github-border">
                                    <div>
                                       <div className="font-bold text-sm">{u.name}</div>
                                       <div className="text-xs text-github-muted">{u.email}</div>
                                    </div>
                                    {!isFriend ? (
                                       <button 
                                         onClick={() => sendRequest(u.email)} 
                                         disabled={actionLoading[reqKey]}
                                         className="px-3 py-1.5 bg-github-success text-white text-xs font-bold rounded hover:bg-github-successHover flex items-center gap-1 disabled:opacity-50"
                                       >
                                          {actionLoading[reqKey] ? <Loader2 className="animate-spin" size={14} /> : <UserPlus size={14} />} 요청
                                       </button>
                                    ) : <span className="text-xs text-github-muted bg-github-card px-2 py-1 rounded">이미 친구/요청중</span>}
                                 </div>
                              );
                           })}
                        </div>
                     </div>
                  )}
               </div>
            </div>
         </div>
      </main>
    </div>
  );
};

export default FriendPage;
