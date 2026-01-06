import React, { useEffect, useState, useMemo, useRef } from 'react';
import { User, Habit, HabitRecord, SharedHabitData } from '../types';
import { fetchHabitRecords, saveHabitLog, createHabit, respondToInvite, deleteHabit } from '../services/sheetService';
import Heatmap from './Heatmap';
import HabitForm from './HabitForm';
import FriendSidebar from './FriendSidebar';
import { Plus, X as XIcon, Minus, LogOut, Loader2, LogIn, ChevronLeft, ChevronRight, Activity, Users, BellRing, Check, Ban, Mail, Pencil, Trash2, CalendarDays, Info } from 'lucide-react';

interface DashboardProps {
  user: User | null;
  onLogout: () => void;
  onLoginReq: () => void;
}

// --- Sample Data for Guests ---
const SAMPLE_HABITS: Habit[] = [
  { id: 's1', userEmail: 'guest', name: '물 마시기', color: 'bg-blue-500', type: 'do', goal: 2, unit: 'L', frequency: { type: 'daily' }, createdAt: new Date(Date.now() - 365*24*60*60*1000).toISOString() },
  { id: 's2', userEmail: 'guest', name: '러닝', color: 'bg-green-500', type: 'do', goal: 30, unit: '분', frequency: { type: 'weekly_count', value: 3 }, createdAt: new Date(Date.now() - 180*24*60*60*1000).toISOString() },
  { id: 's3', userEmail: 'guest', name: '야식 안먹기', color: 'bg-red-500', type: 'dont', goal: 0, unit: '회', frequency: { type: 'daily' }, createdAt: new Date(Date.now() - 60*24*60*60*1000).toISOString() },
];

const generateSampleLogs = (habit: Habit) => {
  const logs: { [key: string]: boolean } = {};
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    
    // Random pattern
    if (Math.random() > 0.4) logs[dateStr] = true;
    else if (habit.type === 'dont' && Math.random() > 0.8) logs[dateStr] = false;
  }
  return logs;
};

const SAMPLE_DATA: SharedHabitData[] = SAMPLE_HABITS.map(h => ({
  myRecord: {
    email: 'guest',
    habit_id: h.id,
    habit: { ...h, recordStatus: 'active' },
    logs: generateSampleLogs(h)
  },
  peerRecords: []
}));

// Helper for Local Date String
const getLocalISOString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const Dashboard: React.FC<DashboardProps> = ({ user, onLogout, onLoginReq }) => {
  const [sharedData, setSharedData] = useState<SharedHabitData[]>([]);
  const [loading, setLoading] = useState(false);
  const [showHabitForm, setShowHabitForm] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | undefined>(undefined);
  
  // Tutorial State
  const [tutorialMessage, setTutorialMessage] = useState<{ title: string; desc: string } | null>(null);
  
  // Date Navigation State
  const [selectedDate, setSelectedDate] = useState(new Date());
  const dateInputRef = useRef<HTMLInputElement>(null);

  const formattedDate = useMemo(() => {
    return getLocalISOString(selectedDate);
  }, [selectedDate]);

  const displayDate = useMemo(() => {
    return selectedDate.toLocaleDateString('ko-KR', { 
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    });
  }, [selectedDate]);

  useEffect(() => {
    const loadData = async () => {
      if (!user) {
        setSharedData(SAMPLE_DATA);
        return;
      }
      setLoading(true);
      const data = await fetchHabitRecords(user.email);
      setSharedData(data);
      setLoading(false);
    };
    loadData();
  }, [user]);

  // --- Handlers with Guest Check ---

  const handleTutorial = (title: string, desc: string) => {
    if (!user) {
       setTutorialMessage({ title, desc });
       return true;
    }
    return false;
  };

  const handleSaveHabit = async (newHabit: Habit, invitees: string[]) => {
    if (handleTutorial("습관 저장", "로그인하면 나만의 습관을 만들고 데이터를 영구적으로 저장할 수 있어요.")) return;
    if (!user) return;
    
    setLoading(true);
    try {
        const result = await createHabit(user.email, newHabit, invitees);
        
        if (result.status === 'skipped') {
            alert("⚠️ 데이터 저장을 위해 서버 연결 설정이 필요합니다.");
            setLoading(false);
            return;
        }
        
        if (result.status === 'error') {
            alert(`⛔ 저장 중 오류가 발생했습니다.\n${result.message}`);
            setLoading(false);
            return;
        }

        setTimeout(async () => {
            const data = await fetchHabitRecords(user.email);
            setSharedData(data);
            setLoading(false);
        }, 1000);
        
    } catch (e) {
        alert("알 수 없는 오류가 발생했습니다.");
        setLoading(false);
    }
  };

  const handleDeleteHabit = async (record: HabitRecord) => {
    if (handleTutorial("습관 삭제", "더 이상 진행하지 않는 습관을 대시보드에서 제거할 수 있어요.")) return;
    if (!user || !confirm(`'${record.habit.name}' 습관을 삭제하시겠습니까?\n(함께하기의 경우 목록에서만 제거됩니다)`)) return;
    
    setLoading(true);
    try {
      await deleteHabit(record);
      setTimeout(async () => {
        const data = await fetchHabitRecords(user.email);
        setSharedData(data);
        setLoading(false);
      }, 1000);
    } catch(e) {
      alert("삭제 중 오류가 발생했습니다.");
      setLoading(false);
    }
  };

  const handleToggleLog = async (record: HabitRecord) => {
    // Guest Mode Toggle Visuals locally
    if (!user) {
       setTutorialMessage({ 
         title: "습관 기록", 
         desc: "오늘의 목표를 달성했나요? 버튼을 눌러 O, X, 또는 취소 상태로 기록할 수 있어요." 
       });
       
       // Visual feedback for guest
       const currentStatus = record.logs[formattedDate];
       let newStatus: boolean | undefined;
       if (currentStatus === undefined) newStatus = true;     
       else if (currentStatus === true) newStatus = false;    
       else newStatus = undefined;

       const newLogs = { ...record.logs };
       if (newStatus === undefined) delete newLogs[formattedDate];
       else newLogs[formattedDate] = newStatus;

       setSharedData(prev => prev.map(item => {
         if (item.myRecord.habit_id === record.habit_id) {
           return { ...item, myRecord: { ...item.myRecord, logs: newLogs } };
         }
         return item;
       }));
       return;
    }
    
    const currentStatus = record.logs[formattedDate];
    let newStatus: boolean | undefined;

    if (currentStatus === undefined) newStatus = true;     
    else if (currentStatus === true) newStatus = false;    
    else newStatus = undefined;                            

    const newLogs = { ...record.logs };
    if (newStatus === undefined) {
      delete newLogs[formattedDate];
    } else {
      newLogs[formattedDate] = newStatus;
    }
    
    setSharedData(prev => prev.map(item => {
      if (item.myRecord.habit_id === record.habit_id) {
        return { ...item, myRecord: { ...item.myRecord, logs: newLogs } };
      }
      return item;
    }));

    const result = await saveHabitLog(user.email, record.habit_id, record.habit, newLogs);
    if (result.status === 'skipped') alert("⚠️ 서버 연결 설정이 없어 변경사항이 저장되지 않습니다.");
  };

  const handleInviteResponse = async (record: HabitRecord, accept: boolean) => {
    if (!user) return;
    
    setSharedData(prev => prev.map(item => {
      if (item.myRecord.habit_id === record.habit_id) {
        return {
          ...item,
          myRecord: {
            ...item.myRecord,
            habit: {
              ...item.myRecord.habit,
              recordStatus: accept ? 'active' : 'rejected'
            }
          }
        };
      }
      return item;
    }));

    try {
      await respondToInvite(record, accept);
      setTimeout(async () => {
         const data = await fetchHabitRecords(user.email);
         setSharedData(data);
      }, 2000); 
    } catch (e) {
      alert("요청 처리 중 오류가 발생했습니다.");
    }
  };

  const shiftDate = (days: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(selectedDate.getDate() + days);
    setSelectedDate(newDate);
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
       setSelectedDate(new Date(e.target.value));
    }
  };

  const handleAddClick = () => {
    if (handleTutorial("새 습관 추가", "로그인 후 + 버튼을 눌러 새로운 습관 트래커를 생성할 수 있어요.")) return;
    if (!user) {
      onLoginReq();
      return;
    }
    setEditingHabit(undefined);
    setShowHabitForm(true);
  };

  const handleEditClick = (habit: Habit) => {
    if (handleTutorial("습관 수정", "습관의 이름, 목표, 주기 등을 언제든지 수정할 수 있어요.")) return;
    setEditingHabit(habit);
    setShowHabitForm(true);
  };

  const getWeeklyRate = (record: HabitRecord) => {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay()); 
    startOfWeek.setHours(0,0,0,0);
    
    let dueCount = 0;
    let successCount = 0;

    for(let i=0; i<7; i++) {
       const d = new Date(startOfWeek);
       d.setDate(startOfWeek.getDate() + i);
       const ds = getLocalISOString(d);
       
       let isDue = false;
       if (record.habit.frequency.type === 'daily') isDue = true;
       else if (record.habit.frequency.type === 'specific_days') {
         if (record.habit.frequency.days?.includes(d.getDay())) isDue = true;
       }
       else if (record.habit.frequency.type === 'weekly_count') {
         if (i===6) dueCount = record.habit.frequency.value || 1; 
       }

       if (record.habit.frequency.type !== 'weekly_count' && isDue) {
          dueCount++;
       }

       if (record.logs[ds] === true) successCount++;
    }
    
    if (dueCount === 0) return 0;
    return Math.round(Math.min(100, (successCount / dueCount) * 100));
  };

  const activeSharedData = useMemo(() => {
    return sharedData.filter(d => d.myRecord.habit.recordStatus === 'active' || !d.myRecord.habit.recordStatus);
  }, [sharedData]);

  const invitedHabits = useMemo(() => {
    return sharedData.filter(d => d.myRecord.habit.recordStatus === 'invited');
  }, [sharedData]);

  const todaysHabits = useMemo(() => {
    const dayOfWeek = selectedDate.getDay(); 
    return activeSharedData.filter(({ myRecord: record }) => {
      const { frequency } = record.habit;
      if (frequency.type === 'daily') return true;
      if (frequency.type === 'specific_days') return frequency.days?.includes(dayOfWeek);
      if (frequency.type === 'weekly_count') return true; 
      return false;
    });
  }, [activeSharedData, selectedDate]);

  return (
    <div className="h-screen bg-github-bg text-github-text font-sans flex flex-col overflow-hidden">
      {/* Navbar - Fixed at top */}
      <nav className="bg-github-card border-b border-github-border py-4 px-6 flex justify-between items-center z-20 shadow-sm flex-shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="font-bold text-lg tracking-tight">HabitHub</h1>
        </div>
        <div className="flex items-center gap-4">
          {user ? (
            <>
              <span className="text-sm text-github-muted hidden sm:inline">
                 <span className="text-github-text font-medium">{user.name}</span>님
              </span>
              <button onClick={onLogout} className="p-2 hover:bg-github-btnHover rounded-md text-github-muted hover:text-red-400 transition-colors">
                <LogOut size={18} />
              </button>
            </>
          ) : (
            <button onClick={onLoginReq} className="px-3 py-1.5 bg-github-btn border border-github-border rounded-md text-sm font-medium hover:bg-github-btnHover transition-colors flex items-center gap-2">
              <LogIn size={14} /> 로그인
            </button>
          )}
        </div>
      </nav>

      {/* Main Layout Container - Takes remaining height */}
      <div className="flex-1 flex w-full overflow-hidden">
         
         {/* Main Content Area - Scrolls independently */}
         <main className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
          {/* 
            수정: w-fit을 w-full로 변경하고 max-w를 적절히 조정하여 
            내용이 없을 때도 일정한 너비를 유지하게 함. 
          */}
          <div className="flex flex-col gap-8 w-full max-w-4xl mx-auto pb-20">
            
            {/* Invite Notifications */}
            {invitedHabits.length > 0 && (
              <section className="w-full bg-github-card border border-github-accent/30 rounded-lg p-4 animate-in fade-in slide-in-from-top-2">
                 <div className="flex items-center gap-2 mb-3 text-github-accent font-bold">
                    <BellRing size={18} /> 새로운 습관 초대
                 </div>
                 <div className="space-y-3">
                   {invitedHabits.map(({ myRecord: record }) => {
                     const inviter = record.habit.members && record.habit.members.length > 0 ? record.habit.members[0] : 'Unknown';
                     return (
                       <div key={record.habit_id} className="flex items-center justify-between bg-github-bg p-3 rounded border border-github-border">
                          <div className="flex items-center gap-3">
                             <span className={`w-3 h-3 rounded-full ${record.habit.color}`}></span>
                             <div>
                               <div className="font-semibold text-sm">{record.habit.name}</div>
                               <div className="text-xs text-github-muted flex items-center gap-3 mt-1">
                                  <span className="flex items-center gap-1"><Users size={12} /> {record.habit.members?.length}명 멤버</span>
                                  <span className="flex items-center gap-1 text-github-text/80"><Mail size={12} /> 초대자: {inviter}</span>
                               </div>
                             </div>
                          </div>
                          <div className="flex gap-2">
                             <button onClick={() => handleInviteResponse(record, true)} className="flex items-center gap-1 px-3 py-1.5 bg-github-success text-white rounded text-xs font-bold hover:bg-github-successHover"><Check size={14} /> 수락</button>
                             <button onClick={() => handleInviteResponse(record, false)} className="flex items-center gap-1 px-3 py-1.5 bg-github-btn text-github-muted rounded text-xs hover:text-red-400"><Ban size={14} /> 거절</button>
                          </div>
                       </div>
                     );
                   })}
                 </div>
              </section>
            )}

            {/* Heatmap Section */}
            <section className="w-full">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Activity size={20} className="text-github-muted"/>
                  활동 대시보드
                </h2>
                {!user && <span className="text-xs bg-github-btn px-2 py-1 rounded border border-github-border text-github-accent">체험 모드</span>}
              </div>
              
              {activeSharedData.length === 0 ? (
                <div className="w-full bg-github-card border border-github-border rounded-lg p-10 text-center text-github-muted italic">
                  아직 활성화된 습관 활동이 없습니다.
                </div>
              ) : (
                <div className="flex flex-col gap-6 items-start w-full">
                  {activeSharedData.map(({ myRecord, peerRecords }) => (
                    <div 
                      key={myRecord.habit_id} 
                      className="w-full bg-github-card border border-github-border rounded-lg pl-6 py-4 pr-0 relative group"
                      onClick={() => handleTutorial("대시보드 히트맵", "지난 1년 동안의 활동 기록을 잔디 심기처럼 시각화하여 보여줘요.")}
                    >
                      {/* Together Badge */}
                      {myRecord.habit.mode === 'together' && (
                         <div className="absolute top-4 right-4 text-xs text-github-muted flex items-center gap-1 bg-github-bg px-2 py-1 rounded-full border border-github-border z-10">
                            <Users size={12} /> 함께 하기
                         </div>
                      )}
                      
                      <div className="flex items-center justify-between mb-3 min-w-0 pr-4">
                        <div className="flex items-center gap-2 min-w-0">
                           <span className={`w-3 h-3 rounded-full flex-shrink-0 ${myRecord.habit.color}`}></span>
                           <span className="font-semibold text-sm truncate">{myRecord.habit.name}</span>
                           <span className="text-xs text-github-muted ml-2 flex-shrink-0">
                             {myRecord.habit.frequency.type === 'daily' ? '매일' : 
                              myRecord.habit.frequency.type === 'weekly_count' ? `주 ${myRecord.habit.frequency.value}회` : '특정 요일'}
                           </span>
                           <span className="ml-2 px-2 py-0.5 rounded-full bg-github-btn text-[10px] text-github-muted border border-github-border flex-shrink-0">
                              이번 주 {getWeeklyRate(myRecord)}%
                           </span>
                        </div>

                        <div className="flex gap-1 bg-github-card rounded ml-4 flex-shrink-0">
                           <button 
                             onClick={(e) => { e.stopPropagation(); handleEditClick(myRecord.habit); }} 
                             className="p-1.5 text-github-muted hover:text-github-accent hover:bg-github-btn rounded"
                             title="수정"
                           >
                             <Pencil size={14}/>
                           </button>
                           <button 
                             onClick={(e) => { e.stopPropagation(); handleDeleteHabit(myRecord); }} 
                             className="p-1.5 text-github-muted hover:text-red-400 hover:bg-github-btn rounded"
                             title="삭제"
                           >
                             <Trash2 size={14}/>
                           </button>
                        </div>
                      </div>
                      
                      <Heatmap myRecord={myRecord} peerRecords={peerRecords} rangeDays={365} />
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Daily Goals List */}
            <section className="w-full">
              <div className="flex items-center justify-between mb-6 bg-github-card p-3 rounded-lg border border-github-border">
                <button onClick={() => shiftDate(-1)} className="p-2 hover:bg-github-btnHover rounded-full transition-colors"><ChevronLeft size={20} /></button>
                
                <div 
                   className="text-center relative group cursor-pointer p-2 rounded transition-colors"
                >
                   <h2 className="text-lg font-bold">목표</h2>
                   <div className="text-sm text-github-muted group-hover:text-github-accent flex items-center justify-center gap-2 transition-colors">
                      {displayDate}
                   </div>
                   <input 
                      ref={dateInputRef}
                      type="date" 
                      value={formattedDate}
                      onChange={handleDateChange}
                      onClick={(e) => {
                          try {
                            if ('showPicker' in HTMLInputElement.prototype) {
                                e.currentTarget.showPicker();
                            }
                          } catch(err) {
                             // fallback
                          }
                      }}
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                   />
                </div>

                <button onClick={() => shiftDate(1)} className="p-2 hover:bg-github-btnHover rounded-full transition-colors"><ChevronRight size={20} /></button>
              </div>

              {loading ? (
                 <div className="h-48 flex items-center justify-center text-github-muted">
                    <Loader2 className="animate-spin mr-2" /> 기록을 불러오는 중...
                 </div>
              ) : (
                <div className="space-y-3">
                  {todaysHabits.length === 0 && (
                    <div className="text-center py-10 text-github-muted border-2 border-dashed border-github-border rounded-lg">
                      이 날짜에 예정된 습관이 없습니다.
                    </div>
                  )}
                  
                  {todaysHabits.map(({ myRecord: record }) => {
                    const status = record.logs[formattedDate];
                    const isDone = status === true;
                    const isFail = status === false;

                    return (
                      <div key={record.habit_id} className={`bg-github-card border ${isDone ? 'border-github-muted' : (isFail ? 'border-red-900/30' : 'border-github-border')} rounded-lg p-4 flex items-center justify-between transition-all`}>
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold shadow-sm transition-all
                            ${isDone ? record.habit.color : (isFail ? 'bg-red-900/50 text-red-200' : `${record.habit.color} opacity-40`)}`}>
                            {isFail ? <XIcon size={24} /> : record.habit.name.charAt(0)}
                          </div>
                          <div>
                            <h3 className={`font-semibold text-lg ${isDone ? 'text-github-muted line-through' : 'text-github-text'}`}>
                              {record.habit.name}
                            </h3>
                            <p className="text-xs text-github-muted">
                               {record.habit.mode === 'together' && <span className="mr-2 text-github-accent flex inline-flex items-center gap-0.5"><Users size={10}/> 같이 하기</span>}
                               {record.habit.type === 'do' ? '목표: ' : '제한: '} 
                               {record.habit.goal} {record.habit.unit}
                            </p>
                          </div>
                        </div>
                        
                        <button 
                          onClick={() => handleToggleLog(record)}
                          className={`w-12 h-12 rounded-xl border flex items-center justify-center transition-all duration-300 transform active:scale-95
                            ${isDone 
                              ? 'bg-github-btn border-github-muted text-github-muted hover:bg-red-900/20 hover:text-red-400' 
                              : (isFail 
                                  ? 'bg-red-900/10 border-red-900/30 text-red-400 hover:bg-github-btn hover:text-github-muted'
                                  : 'bg-github-btn border-github-border text-github-success hover:bg-github-btnHover hover:scale-105')
                            }`}
                        >
                          {isDone ? <XIcon size={24} /> : (isFail ? <Minus size={24} /> : <Plus size={24} />)}
                        </button>
                      </div>
                    );
                  })}

                  <button 
                    onClick={handleAddClick}
                    className="w-full py-4 border-2 border-dashed border-github-border rounded-lg text-github-muted hover:text-github-text hover:border-github-muted hover:bg-github-card/50 transition-all flex items-center justify-center gap-2 font-medium mt-4"
                  >
                    <Plus size={18} />
                    새로운 습관 추가하기
                  </button>
                </div>
              )}
            </section>
          </div>
         </main>

        {/* Friend Sidebar */}
        {user && <FriendSidebar user={user} />}
      </div>

      {/* Floating Action Button (Mobile) */}
      <button 
        onClick={handleAddClick}
        className="fixed bottom-6 right-6 w-14 h-14 bg-github-text text-github-bg rounded-full shadow-lg flex items-center justify-center sm:hidden hover:scale-105 transition-transform z-40"
      >
        <Plus size={24} />
      </button>

      {showHabitForm && user && (
        <HabitForm 
          userEmail={user.email}
          onClose={() => setShowHabitForm(false)} 
          onSave={handleSaveHabit}
          initialData={editingHabit}
        />
      )}
      
      {/* Tutorial Overlay */}
      {tutorialMessage && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center pointer-events-none p-4 pb-20 sm:pb-4">
           <div className="bg-github-card border border-github-accent shadow-2xl rounded-xl p-4 max-w-sm w-full animate-in fade-in slide-in-from-bottom-4 pointer-events-auto flex gap-4 items-start">
              <div className="bg-github-accent/10 p-2 rounded-full text-github-accent">
                 <Info size={24} />
              </div>
              <div className="flex-1">
                 <h3 className="font-bold text-lg mb-1">{tutorialMessage.title}</h3>
                 <p className="text-sm text-github-muted leading-relaxed">{tutorialMessage.desc}</p>
                 <div className="mt-3 flex justify-end">
                    <button 
                       onClick={() => setTutorialMessage(null)}
                       className="text-sm font-bold text-github-accent hover:underline"
                    >
                       확인
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;