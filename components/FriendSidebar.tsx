
import React, { useState, useEffect } from 'react';
import { User, Friend, SharedHabitData, HabitRecord } from '../types';
import { fetchFriends, requestFriend, respondFriend, removeFriend, getAllRecords, fetchUsers } from '../services/sheetService';
import { Users, UserPlus, X, Check, Loader2, Trash2, Search, Zap, PanelRightClose, PanelRightOpen } from 'lucide-react';

interface FriendSidebarProps {
  user: User;
}

interface FriendWithStats {
  friendship: Friend;
  details: User;
  stats?: {
    habitName: string;
    type: 'do' | 'dont';
    rate: number;
    color: string;
  }[];
}

const FriendSidebar: React.FC<FriendSidebarProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'list' | 'add'>('list');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendsWithStats, setFriendsWithStats] = useState<FriendWithStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    loadFriends();
  }, [user]);

  const loadFriends = async () => {
    setLoading(true);
    try {
      const list = await fetchFriends(user.email);
      setFriends(list);
      
      const accepted = list.filter(f => f.status === 'accepted');
      if (accepted.length > 0) {
        // Optimization: Fetch ALL records once to process all friends at once
        const allRecords = await getAllRecords();
        processFriendStats(accepted, allRecords);
      } else {
        setFriendsWithStats([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const processFriendStats = (acceptedFriends: Friend[], allRecords: HabitRecord[]) => {
    const results = acceptedFriends.map((f) => {
      const friendEmail = f.requester === user.email.toLowerCase() ? f.receiver : f.requester;
      const friendName = friendEmail.split('@')[0];
      
      const friendHabitRecords = allRecords.filter(r => 
        r.email === friendEmail && 
        r.habit && 
        r.habit.recordStatus === 'active'
      );

      const habitStats = friendHabitRecords
        .map(r => {
          const logs = r.logs;
          const values = Object.values(logs);
          const totalLogged = values.length;
          const successCount = values.filter(v => v === true).length;
          const rate = totalLogged > 0 ? Math.round((successCount / totalLogged) * 100) : 0;
          
          return {
            habitName: r.habit.name,
            type: r.habit.type,
            rate,
            color: r.habit.color
          };
        })
        .sort((a, b) => a.rate - b.rate)
        .slice(0, 3); 

      return {
        friendship: f,
        details: { name: friendName, email: friendEmail },
        stats: habitStats
      };
    });

    setFriendsWithStats(results);
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
    const optimisticFriend: Friend = {
      id: `temp_${Date.now()}`,
      requester: user.email.toLowerCase(),
      receiver: receiverEmail.toLowerCase(),
      status: 'pending',
      updatedAt: new Date().toISOString()
    };
    setFriends(prev => [...prev, optimisticFriend]);
    setSearchTerm('');
    setSearchResults([]);

    try {
      const result = await requestFriend(user.email, receiverEmail);
      if (result.status === 'error') throw new Error(result.message);
      loadFriends();
      alert('요청을 보냈습니다.');
    } catch (e) {
      alert('요청 실패: ' + String(e));
      setFriends(prev => prev.filter(f => f.id !== optimisticFriend.id));
    }
  };

  const handleRespond = async (friendEmail: string, accept: boolean) => {
    const status = accept ? 'accepted' : 'rejected';
    setFriends(prev => prev.map(f => {
       if ((f.requester === friendEmail.toLowerCase() && f.receiver === user.email.toLowerCase()) ||
           (f.receiver === friendEmail.toLowerCase() && f.requester === user.email.toLowerCase())) {
           return { ...f, status: status as any };
       }
       return f;
    }));
    await respondFriend(friendEmail, user.email, status);
    loadFriends();
  };

  const handleDelete = async (friendEmail: string) => {
    if (confirm(`${friendEmail}님을 친구 목록에서 삭제하시겠습니까?`)) {
      setFriendsWithStats(prev => prev.filter(f => f.details.email !== friendEmail));
      setFriends(prev => prev.filter(f => f.requester !== friendEmail && f.receiver !== friendEmail));
      await removeFriend(user.email, friendEmail);
      loadFriends();
    }
  };

  const pendingRequests = friends.filter(f => f.status === 'pending' && f.receiver === user.email.toLowerCase());
  const sentRequests = friends.filter(f => f.status === 'pending' && f.requester === user.email.toLowerCase());

  if (isCollapsed) {
    return (
      <div className="w-12 flex-shrink-0 bg-github-card border-l border-github-border flex flex-col h-full items-center py-4 transition-all duration-300 z-30">
         <button onClick={() => setIsCollapsed(false)} className="p-2 text-github-muted hover:text-github-text hover:bg-github-btn rounded-md mb-4" title="친구 목록 펼치기">
           <PanelRightOpen size={20} />
         </button>
         <div className="flex flex-col gap-4 items-center">
             <div className="relative group cursor-pointer" title="친구">
                <Users size={20} className="text-github-text" />
                {pendingRequests.length > 0 && (
                   <span className="absolute -top-1 -right-1 w-3 h-3 bg-github-accent rounded-full border border-github-card"></span>
                )}
             </div>
         </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 lg:static lg:z-auto w-full lg:w-80 flex-shrink-0 bg-github-card lg:border-l border-github-border flex flex-col h-full transition-all duration-300">
       <div className="p-4 border-b border-github-border flex items-center justify-between">
         <div className="flex items-center gap-2">
           <button onClick={() => setIsCollapsed(true)} className="text-github-muted hover:text-github-text" title="접기">
              <PanelRightClose size={18} />
           </button>
           <h2 className="font-bold text-github-text flex items-center gap-2 select-none">친구</h2>
         </div>
         <div className="flex bg-github-bg rounded-lg p-1 border border-github-border">
            <button onClick={() => setActiveTab('list')} className={`px-3 py-1 rounded text-xs font-medium transition-all ${activeTab === 'list' ? 'bg-github-btn text-github-text shadow-sm' : 'text-github-muted hover:text-github-text'}`}>목록</button>
            <button onClick={() => setActiveTab('add')} className={`px-3 py-1 rounded text-xs font-medium transition-all ${activeTab === 'add' ? 'bg-github-btn text-github-text shadow-sm' : 'text-github-muted hover:text-github-text'}`}>추가</button>
         </div>
       </div>

       <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
          {activeTab === 'add' ? (
             <div className="space-y-4">
                <form onSubmit={handleSearch} className="relative">
                   <input type="text" placeholder="이메일로 친구 검색" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-github-bg border border-github-border rounded-md pl-9 pr-3 py-2 text-sm focus:border-github-accent focus:outline-none text-github-text" />
                   <button type="submit" className="absolute left-3 top-2.5 text-github-muted hover:text-github-text transition-colors" title="검색"><Search size={16} /></button>
                </form>
                {searchLoading ? <div className="text-center py-4"><Loader2 className="animate-spin mx-auto text-github-muted"/></div> : (
                   <div className="space-y-2">
                      {searchResults.map(u => {
                         const isFriend = friends.some(f => f.requester === u.email || f.receiver === u.email);
                         return (
                           <div key={u.email} className="flex items-center justify-between bg-github-bg p-3 rounded border border-github-border">
                              <div><div className="text-sm font-bold">{u.name}</div><div className="text-xs text-github-muted">{u.email}</div></div>
                              {!isFriend ? (
                                <button onClick={() => sendRequest(u.email)} className="p-1.5 bg-github-success text-white rounded hover:bg-github-successHover transition-transform active:scale-95"><UserPlus size={16} /></button>
                              ) : <span className="text-xs text-github-muted">친구/요청중</span>}
                           </div>
                         );
                      })}
                      {searchTerm && searchResults.length === 0 && <div className="text-center text-xs text-github-muted py-2">검색 결과가 없습니다.</div>}
                   </div>
                )}
                {sentRequests.length > 0 && (
                   <div><h3 className="text-xs font-bold text-github-muted uppercase mb-2">보낸 요청</h3>
                      {sentRequests.map(f => (
                         <div key={f.id} className="flex items-center justify-between py-2 text-sm">
                            <span className="text-github-muted">{f.receiver}</span>
                            <span className="text-xs bg-github-bg px-2 py-1 rounded border border-github-border">대기중</span>
                         </div>
                      ))}
                   </div>
                )}
             </div>
          ) : (
             <div className="space-y-6">
                {pendingRequests.length > 0 && (
                   <div className="bg-github-bg border border-github-accent/30 rounded-lg p-3">
                      <h3 className="text-xs font-bold text-github-accent uppercase mb-2 flex items-center gap-1"><Zap size={12}/> 받은 요청</h3>
                      <div className="space-y-2">
                         {pendingRequests.map(f => (
                            <div key={f.id} className="flex flex-col gap-2 pb-2 border-b border-github-border last:border-0 last:pb-0">
                               <span className="text-sm font-medium">{f.requester}</span>
                               <div className="flex gap-2">
                                  <button onClick={() => handleRespond(f.requester, true)} className="flex-1 py-1 bg-github-success text-white text-xs rounded font-bold hover:bg-github-successHover">수락</button>
                                  <button onClick={() => handleRespond(f.requester, false)} className="flex-1 py-1 bg-github-card border border-github-border text-xs rounded hover:text-red-400">거절</button>
                               </div>
                            </div>
                         ))}
                      </div>
                   </div>
                )}
                <div><h3 className="text-xs font-bold text-github-muted uppercase mb-3">내 친구 ({friendsWithStats.length})</h3>
                   {friendsWithStats.length === 0 ? (
                      <div className="text-center py-8 text-github-muted text-sm border border-dashed border-github-border rounded-lg">아직 친구가 없습니다.<br/>친구를 추가해 서로 동기부여해보세요!</div>
                   ) : (
                      <div className="space-y-4">
                         {friendsWithStats.map(({ details, stats }) => (
                            <div key={details.email} className="bg-github-bg border border-github-border rounded-lg p-3 group relative">
                               <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                     <div className="w-6 h-6 rounded-full bg-github-border flex items-center justify-center text-xs font-bold">{details.name[0]}</div>
                                     <span className="text-sm font-bold truncate max-w-[120px]">{details.name}</span>
                                  </div>
                                  <button onClick={(e) => { e.stopPropagation(); handleDelete(details.email); }} className="opacity-0 group-hover:opacity-100 text-github-muted hover:text-red-400 transition-opacity p-1" title="친구 삭제"><Trash2 size={14} /></button>
                               </div>
                               <div className="space-y-2 mt-3">
                                  {stats && stats.length > 0 ? (
                                     stats.map((s, idx) => (
                                        <div key={idx} className="flex items-center gap-2 text-xs">
                                           <div className={`w-1.5 h-1.5 rounded-full ${s.color}`}></div>
                                           <div className="flex-1 truncate text-github-muted">{s.habitName}</div>
                                           <div className={`font-mono font-bold ${s.rate < 50 ? 'text-red-400' : 'text-github-success'}`}>{s.rate}%</div>
                                        </div>
                                     ))
                                  ) : <div className="text-xs text-github-muted">진행중인 습관이 없습니다.</div>}
                               </div>
                            </div>
                         ))}
                      </div>
                   )}
                </div>
             </div>
          )}
       </div>
    </div>
  );
};

export default FriendSidebar;
