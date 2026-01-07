
import React, { useEffect, useState, useMemo } from 'react';
import { User, Habit, HabitRecord, SharedHabitData } from '../types';
import { fetchHabitRecords, saveHabitLog, createHabit, respondToInvite, deleteHabit, invalidateCache } from '../services/sheetService';
import Heatmap from './Heatmap';
import HabitForm from './HabitForm';
import { Plus, X as XIcon, LogOut, Loader2, LogIn, ChevronLeft, ChevronRight, Activity, Users, User as UserIcon, BellRing, Pencil, Trash2, Info, X, Target, AlertTriangle, Sparkles, Eye } from 'lucide-react';

interface DashboardProps {
  user: User | null;
  currentUser?: User | null; // The actually logged-in user
  isReadOnly?: boolean;
  onLogout: () => void;
  onLoginReq: () => void;
  onNavigate: (view: 'dashboard' | 'friends') => void;
}

const SAMPLE_HABITS: Habit[] = [
  { id: 's1', userEmail: 'guest', creatorEmail: 'guest', name: '물 마시기', color: 'bg-blue-500', type: 'do', goal: 2, unit: 'L', frequency: { type: 'daily' }, createdAt: new Date(Date.now() - 365*24*60*60*1000).toISOString(), mode: 'personal' },
  { id: 's2', userEmail: 'guest', creatorEmail: 'guest', name: '러닝', color: 'bg-green-500', type: 'do', goal: 30, unit: '분', frequency: { type: 'weekly_count', value: 3 }, createdAt: new Date(Date.now() - 180*24*60*60*1000).toISOString(), mode: 'together' },
  { id: 's3', userEmail: 'guest', creatorEmail: 'guest', name: '야식 안먹기', color: 'bg-red-500', type: 'dont', goal: 0, unit: '회', frequency: { type: 'daily' }, createdAt: new Date(Date.now() - 60*24*60*60*1000).toISOString(), mode: 'personal' },
];

const generateSampleLogs = (habit: Habit) => {
  const logs: { [key: string]: boolean } = {};
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    if (Math.random() > 0.4) logs[dateStr] = true;
    else if (habit.type === 'dont' && Math.random() > 0.8) logs[dateStr] = false;
  }
  return logs;
};

const SAMPLE_DATA: SharedHabitData[] = SAMPLE_HABITS.map(h => ({
  myRecord: { email: 'guest', habit_id: h.id, habit: { ...h, recordStatus: 'active' }, logs: generateSampleLogs(h) },
  peerRecords: []
}));

const getLocalISOString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const Dashboard: React.FC<DashboardProps> = ({ user, currentUser, isReadOnly = false, onLogout, onLoginReq, onNavigate }) => {
  const [sharedData, setSharedData] = useState<SharedHabitData[]>([]);
  const [loading, setLoading] = useState(false);
  const [showHabitForm, setShowHabitForm] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | undefined>(undefined);
  const [tutorialMessage, setTutorialMessage] = useState<{ title: string; desc: string } | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  // New state for tabs
  const [activeTab, setActiveTab] = useState<'personal' | 'together'>('personal');

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [pickerViewDate, setPickerViewDate] = useState(new Date());

  const formattedDate = useMemo(() => getLocalISOString(selectedDate), [selectedDate]);
  const displayDate = useMemo(() => selectedDate.toLocaleDateString('ko-KR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }), [selectedDate]);

  const loadData = async (showLoading = true) => {
    if (!user) { setSharedData(SAMPLE_DATA); return; }
    if (showLoading) setLoading(true);
    try {
      const data = await fetchHabitRecords(user.email);
      setSharedData(data);
    } catch (err) {
      console.error("[DATA_FLOW] Failed:", err);
    } finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, [user]);

  const shiftDate = (days: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(selectedDate.getDate() + days);
    setSelectedDate(newDate);
  };

  const triggerDatePicker = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!user && !isReadOnly) { 
      setTutorialMessage({ title: "날짜 이동", desc: "캘린더를 통해 과거의 기록을 확인하거나 특정 날짜의 목표를 미리 볼 수 있어요." }); 
      return;
    }
    setPickerViewDate(new Date(selectedDate));
    setIsDatePickerOpen(true);
  };

  const selectDate = (year: number, month: number, day: number) => {
    setSelectedDate(new Date(year, month, day));
    setIsDatePickerOpen(false);
  };

  const calendarDays = useMemo(() => {
    const year = pickerViewDate.getFullYear();
    const month = pickerViewDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    const daysArr = [];
    const prevLastDate = new Date(year, month, 0).getDate();
    for(let i = firstDay - 1; i >= 0; i--) daysArr.push({ day: prevLastDate - i, month: month - 1, year, isCurrent: false });
    for(let i = 1; i <= lastDate; i++) daysArr.push({ day: i, month: month, year, isCurrent: true });
    const remaining = 42 - daysArr.length;
    for(let i = 1; i <= remaining; i++) daysArr.push({ day: i, month: month + 1, year, isCurrent: false });
    return daysArr;
  }, [pickerViewDate]);

  const calculateWeeklyRate = (record: HabitRecord) => {
    const today = new Date();
    let count = 0; let expected = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(); d.setDate(today.getDate() - i);
      const dateStr = getLocalISOString(d);
      const dayOfWeek = d.getDay();
      const { frequency } = record.habit;
      let isExpected = false;
      if (frequency.type === 'daily') isExpected = true;
      else if (frequency.type === 'specific_days') isExpected = frequency.days?.includes(dayOfWeek) || false;
      else if (frequency.type === 'weekly_count') isExpected = true;
      if (isExpected) {
        expected++;
        if (record.logs[dateStr] === true) count++;
      }
    }
    return expected > 0 ? Math.round((count / expected) * 100) : 0;
  };

  const handleToggleLog = async (record: HabitRecord) => {
    if (isReadOnly) return;
    const currentStatus = record.logs[formattedDate];
    let newStatus = currentStatus === undefined ? true : (currentStatus === true ? false : undefined);
    const newLogs = { ...record.logs };
    if (newStatus === undefined) delete newLogs[formattedDate];
    else newLogs[formattedDate] = newStatus;
    setSharedData(prev => prev.map(item => item.myRecord.habit_id === record.habit_id ? { ...item, myRecord: { ...item.myRecord, logs: newLogs } } : item));
    if (user) await saveHabitLog(user.email, record.habit_id, record.habit, newLogs);
  };

  const handleDeleteHabitClick = (e: React.MouseEvent, record: HabitRecord) => {
    e.preventDefault(); e.stopPropagation();
    if (isReadOnly) return;
    if (!user) { setTutorialMessage({ title: "습관 삭제", desc: "로그인하면 습관을 삭제할 수 있습니다." }); return; }
    const isTogether = record.habit.mode === 'together';
    setConfirmModal({
      isOpen: true,
      title: isTogether ? "그룹 탈퇴" : "습관 삭제",
      message: isTogether ? "이 습관 그룹에서 탈퇴하시겠습니까? 탈퇴 후 동일한 그룹에 다시 초대받을 수 없습니다." : "이 습관을 영구적으로 삭제하시겠습니까?",
      onConfirm: async () => {
        setConfirmModal(null);
        setLoading(true);
        try {
          await deleteHabit(record);
          await loadData(true);
        } catch (err) { console.error(err); setLoading(false); }
      }
    });
  };

  const activeSharedData = useMemo(() => sharedData.filter(d => d.myRecord.habit && (d.myRecord.habit.recordStatus === 'active' || !d.myRecord.habit.recordStatus)), [sharedData]);
  const invitedHabits = useMemo(() => sharedData.filter(d => d.myRecord.habit && d.myRecord.habit.recordStatus === 'invited'), [sharedData]);
  
  // Filter habits based on active tab
  const currentTabHabits = useMemo(() => {
    return activeSharedData.filter(d => {
        const mode = d.myRecord.habit.mode || 'personal';
        return mode === activeTab;
    });
  }, [activeSharedData, activeTab]);

  // Separate Do and Don't habits
  const dontHabits = useMemo(() => currentTabHabits.filter(d => d.myRecord.habit.type === 'dont'), [currentTabHabits]);
  const doHabits = useMemo(() => currentTabHabits.filter(d => d.myRecord.habit.type === 'do'), [currentTabHabits]);

  const todaysHabits = useMemo(() => {
    const dayOfWeek = selectedDate.getDay(); 
    return activeSharedData.filter(({ myRecord: record }) => {
      const { frequency } = record.habit;
      if (frequency.type === 'daily') return true;
      if (frequency.type === 'specific_days') return frequency.days?.includes(dayOfWeek);
      return frequency.type === 'weekly_count';
    });
  }, [activeSharedData, selectedDate]);

  const handleInviteResponse = async (record: HabitRecord, accept: boolean) => {
    setLoading(true);
    try {
      await respondToInvite(record, accept);
      await loadData(true);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const renderHabitCard = (data: SharedHabitData) => {
      const { myRecord, peerRecords } = data;
      const weeklyRate = calculateWeeklyRate(myRecord);
      const currentUserEmail = (currentUser?.email || user?.email || 'guest').toLowerCase();
      const habitCreator = (myRecord.habit.creatorEmail || myRecord.habit.userEmail || '').toLowerCase();
      const isCreator = habitCreator === currentUserEmail;

      return (
          <div key={myRecord.habit_id} className="w-full bg-github-card border border-github-border rounded-lg p-4 sm:px-6 sm:py-4 relative group hover:border-github-muted transition-colors shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3 overflow-hidden">
                <span className={`w-3 h-3 rounded-full flex-shrink-0 ${myRecord.habit.color}`}></span>
                <div className="flex flex-row sm:flex-row gap-1 sm:gap-4 sm:items-center min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm truncate">{myRecord.habit.name}</span>
                  </div>
                  <span className="text-[10px] text-github-muted flex items-center gap-1">
                    <Target size={10} /> 
                    <span className={weeklyRate >= 80 ? 'text-github-success' : weeklyRate >= 40 ? 'text-github-accent' : 'text-red-400'}>{weeklyRate}%</span>
                  </span>
                </div>
              </div>
              {!isReadOnly && (
                <div className="flex gap-1 items-center opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={(e) => { e.stopPropagation(); if(isCreator) { setEditingHabit(myRecord.habit); setShowHabitForm(true); } }} className={`p-2 rounded transition-colors ${isCreator ? 'text-github-muted hover:text-github-accent hover:bg-github-btn' : 'text-github-border cursor-not-allowed'}`} title={isCreator ? "수정" : "생성자만 수정 가능"}><Pencil size={14} /></button>
                  <button onClick={(e) => handleDeleteHabitClick(e, myRecord)} className="p-2 text-github-muted hover:text-red-400 hover:bg-github-btn rounded transition-colors"><Trash2 size={14} /></button>
                </div>
              )}
            </div>
            <Heatmap myRecord={myRecord} peerRecords={peerRecords} rangeDays={365} />
          </div>
      );
  };

  return (
    <div className="h-screen bg-github-bg text-github-text font-sans flex flex-col overflow-hidden">
      {isReadOnly && (
        <div className="bg-github-accent/10 border-b border-github-accent text-github-accent px-4 py-2 text-center text-sm font-bold flex items-center justify-center gap-2">
           {user?.name}님의 대시보드 구경중.
           <button onClick={() => onNavigate('dashboard')} className="ml-2 underline hover:text-white">돌아가기</button>
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
          {currentUser ? (
            <>
              <span className="text-sm text-github-muted hidden sm:inline"><span className="text-github-text font-medium">{currentUser.name}</span>님</span>
              <button onClick={() => onNavigate('friends')} className="p-2 hover:bg-github-btnHover rounded-md text-github-muted hover:text-github-accent transition-colors" title="친구 및 리더보드">
                <Users size={18} />
              </button>
              <button onClick={onLogout} className="p-2 hover:bg-github-btnHover rounded-md text-github-muted hover:text-red-400 transition-colors" title="로그아웃">
                <LogOut size={18} />
              </button>
            </>
          ) : <button onClick={onLoginReq} className="px-3 py-1.5 bg-github-btn border border-github-border rounded-md text-sm font-medium hover:bg-github-btnHover transition-colors flex items-center gap-2 text-white"><LogIn size={14} /> 로그인</button>}
        </div>
      </nav>

      <div className="flex-1 flex w-full overflow-hidden relative">
         <main className="flex-1 min-w-0 overflow-y-auto custom-scrollbar">
          <div className="max-w-4xl mx-auto p-4 sm:p-8 flex flex-col gap-6 sm:gap-10 pb-32 sm:pb-30">
            
            {invitedHabits.length > 0 && !isReadOnly && (
              <section className="w-full bg-github-card border border-github-accent/40 rounded-lg p-5 shadow-lg shadow-github-accent/5 animate-in fade-in slide-in-from-top-4">
                 <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-github-accent font-bold"><Sparkles size={20} className="animate-pulse" /> 새로운 습관 초대 도착!</div>
                    <span className="text-[10px] bg-github-accent/20 text-github-accent px-2 py-0.5 rounded-full border border-github-accent/30 font-bold uppercase tracking-wider">New</span>
                 </div>
                 <div className="space-y-3">
                   {invitedHabits.map(({ myRecord: record }) => (
                       <div key={record.habit_id} className="flex flex-col sm:flex-row sm:items-center justify-between bg-github-bg/50 p-4 rounded-lg border border-github-border/50 hover:border-github-accent/30 transition-all gap-4">
                          <div className="flex items-center gap-4">
                             <div className={`w-10 h-10 rounded-full ${record.habit.color} flex items-center justify-center text-white font-bold shadow-lg`}>{record.habit.name.charAt(0)}</div>
                             <div>
                                <div className="font-bold text-sm text-github-text">{record.habit.name}</div>
                                <div className="text-[11px] text-github-muted flex items-center gap-2 mt-1">
                                   <span className="flex items-center gap-1"><Users size={12}/> {record.habit.members?.length}명 멤버</span>
                                   <span className="w-1 h-1 rounded-full bg-github-border"></span>
                                   <span>생성자: {record.habit.creatorEmail?.split('@')[0]}</span>
                                </div>
                             </div>
                          </div>
                          <div className="flex gap-2">
                             <button onClick={() => handleInviteResponse(record, true)} className="flex-1 sm:flex-none px-4 py-2 bg-github-success text-white rounded-md text-xs font-bold hover:bg-github-successHover shadow-sm active:scale-95 transition-all">참여하기</button>
                             <button onClick={() => handleInviteResponse(record, false)} className="flex-1 sm:flex-none px-4 py-2 bg-github-btn text-github-muted rounded-md text-xs font-bold hover:text-red-400 hover:bg-github-btnHover transition-all">거절</button>
                          </div>
                       </div>
                   ))}
                 </div>
              </section>
            )}

            <section className="w-full">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                <h2 className="text-xl font-bold flex items-center gap-2"><Activity size={20} className="text-github-muted"/>활동 대시보드</h2>
                
                <div className="flex gap-2 p-1 bg-github-card border border-github-border rounded-lg self-start sm:self-auto w-full sm:w-auto">
                    <button onClick={() => setActiveTab('personal')} className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'personal' ? 'bg-github-btn text-github-text shadow-sm' : 'text-github-muted hover:text-github-text'}`}>
                        <UserIcon size={14} /> 혼자 하기
                    </button>
                    <button onClick={() => setActiveTab('together')} className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'together' ? 'bg-github-btn text-github-text shadow-sm' : 'text-github-muted hover:text-github-text'}`}>
                        <Users size={14} /> 같이 하기
                    </button>
                </div>
              </div>

              {currentTabHabits.length === 0 ? (
                <div className="w-full bg-github-card border border-github-border rounded-lg p-10 text-center text-github-muted italic">
                   {activeTab === 'personal' ? '혼자 하는 습관이 없습니다.' : '같이 하는 습관이 없습니다.'}
                </div>
              ) : (
                <div className="flex flex-col gap-8">
                  {/* Don't Section - First */}
                  {dontHabits.length > 0 && (
                    <div className="flex flex-col gap-4">
                        <h3 className="text-sm font-bold text-red-400 flex items-center gap-2 uppercase tracking-wider">
                            <span className="w-2 h-2 rounded-full bg-red-400"></span>
                            안 하기 (Don't)
                        </h3>
                        {dontHabits.map(renderHabitCard)}
                    </div>
                  )}

                  {/* Do Section - Second */}
                  {doHabits.length > 0 && (
                    <div className="flex flex-col gap-4">
                        <h3 className="text-sm font-bold text-github-success flex items-center gap-2 uppercase tracking-wider">
                            <span className="w-2 h-2 rounded-full bg-github-success"></span>
                            잘 하기 (Do)
                        </h3>
                        {doHabits.map(renderHabitCard)}
                    </div>
                  )}
                </div>
              )}
            </section>

            <section className="w-full">
              <div className="flex items-center justify-between mb-9 bg-github-card p-3 rounded-lg border border-github-border shadow-sm">
                <button onClick={() => shiftDate(-1)} className="p-2 hover:bg-github-btnHover rounded-full transition-colors text-github-text"><ChevronLeft size={20} /></button>
                <div onClick={triggerDatePicker} className={`text-center relative group p-2 rounded transition-colors flex-1 min-w-0 ${!isReadOnly && 'cursor-pointer hover:bg-github-btn/50 select-none'}`}>
                  <h2 className="text-base sm:text-lg font-bold text-white whitespace-nowrap overflow-hidden text-ellipsis">목표</h2>
                  <div className={`text-xs sm:text-sm text-github-muted flex items-center justify-center gap-2 ${!isReadOnly && 'group-hover:text-github-accent'}`}>{displayDate}</div>
                </div>
                <button onClick={() => shiftDate(1)} className="p-2 hover:bg-github-btnHover rounded-full transition-colors text-github-text"><ChevronRight size={20} /></button>
              </div>

              {loading ? <div className="h-48 flex items-center justify-center text-github-muted"><Loader2 className="animate-spin mr-2" /> 로딩 중...</div> : (
                <div className="space-y-4">
                  {todaysHabits.length === 0 && <div className="text-center py-10 text-github-muted border-2 border-dashed border-github-border rounded-lg bg-github-card/30">이 날짜에 예정된 습관이 없습니다.</div>}
                  {todaysHabits.map(({ myRecord: record }) => {
                    const status = record.logs[formattedDate];
                    const isDone = status === true;
                    return (
                      <div key={record.habit_id} className={`bg-github-card border ${isDone ? 'border-github-muted shadow-inner' : 'border-github-border shadow-sm'} rounded-xl p-4 sm:p-5 flex items-center justify-between transition-all hover:border-github-muted`}>
                        <div className="flex items-center gap-3 sm:gap-5 min-w-0 flex-1">
                          <div className={`w-12 h-12 sm:w-14 sm:h-14 flex-shrink-0 rounded-2xl flex items-center justify-center text-white font-black text-lg sm:text-xl shadow-lg transition-all ${isDone ? record.habit.color : `${record.habit.color} opacity-30 scale-95`}`}>
                            {record.habit.name.charAt(0)}
                          </div>
                          <div className="min-w-0 flex-1 mr-2">
                            <h3 className={`font-bold text-base sm:text-lg truncate ${isDone ? 'text-github-muted line-through decoration-2' : 'text-white'}`}>{record.habit.name}</h3>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] sm:text-xs px-2 py-0.5 bg-github-bg rounded border border-github-border text-github-muted whitespace-nowrap">{record.habit.goal} {record.habit.unit}</span>
                              <span className="text-[9px] sm:text-[10px] text-github-muted/60 uppercase tracking-widest hidden xs:inline">{record.habit.type === 'do' ? 'Achieve' : 'Avoid'}</span>
                            </div>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleToggleLog(record)} 
                          className={`w-12 h-12 sm:w-14 sm:h-14 flex-shrink-0 rounded-2xl border-2 flex items-center justify-center transition-all active:scale-90 ${isReadOnly ? 'cursor-default opacity-50' : ''} ${isDone ? 'bg-github-btn border-github-muted text-github-muted' : 'bg-github-success/10 border-github-success text-github-success hover:bg-github-success hover:text-white shadow-success/20 shadow-lg'}`}
                          disabled={isReadOnly}
                        >
                          {isDone ? <XIcon size={24} className="sm:w-7 sm:h-7" /> : <Plus size={24} className="sm:w-7 sm:h-7" />}
                        </button>
                      </div>
                    );
                  })}
                  {!isReadOnly && (
                    <button 
                      onClick={() => { if (!user) setTutorialMessage({title:"새 습관", desc:"로그인 후 습관을 만들 수 있습니다."}); else { setEditingHabit(undefined); setShowHabitForm(true); } }} 
                      className="w-full py-6 border-2 border-dashed border-github-border rounded-xl text-github-muted hover:text-white hover:border-github-muted hover:bg-github-card/50 transition-all flex items-center justify-center gap-3 font-bold mt-4 group"
                    >
                      <div className="p-2 rounded-full bg-github-btn group-hover:bg-github-btnHover transition-colors">
                        <Plus size={20} /> 
                      </div>
                      새로운 습관 추가하기
                    </button>
                  )}
                </div>
              )}
            </section>
          </div>
         </main>
      </div>
      
      {/* Floating Add Button */}
      {!isReadOnly && (
        <button 
          onClick={() => { if (!user) setTutorialMessage({title:"새 습관", desc:"로그인 후 습관을 만들 수 있습니다."}); else { setEditingHabit(undefined); setShowHabitForm(true); } }} 
          className="fixed bottom-6 right-6 z-40 w-14 h-14 bg-blue-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:bg-blue-700 hover:scale-110 active:scale-95 transition-all border border-white/10"
          title="새로운 습관 추가"
        >
          <Plus size={28} />
        </button>
      )}

      {confirmModal?.isOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
           <div className="bg-github-card border border-github-border rounded-xl shadow-2xl p-6 w-full max-w-sm animate-in zoom-in-95">
              <div className="flex items-center gap-3 text-red-400 mb-4"><AlertTriangle size={24} /><h3 className="font-bold text-lg">{confirmModal.title}</h3></div>
              <p className="text-sm text-github-text mb-6">{confirmModal.message}</p>
              <div className="flex gap-2">
                 <button onClick={() => setConfirmModal(null)} className="flex-1 py-2 bg-github-btn border border-github-border rounded-lg text-sm font-bold text-github-text hover:bg-github-btnHover">취소</button>
                 <button onClick={confirmModal.onConfirm} className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-bold shadow-lg hover:bg-red-700">확인</button>
              </div>
           </div>
        </div>
      )}

      {isDatePickerOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-github-card border border-github-border rounded-xl shadow-2xl p-6 w-full max-w-[320px] animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-4"><h3 className="font-bold text-github-text">날짜 선택</h3><button onClick={() => setIsDatePickerOpen(false)} className="text-github-muted hover:text-github-text"><X size={20}/></button></div>
            <div className="flex items-center justify-between mb-4 bg-github-bg rounded-lg p-1 border border-github-border">
              <button onClick={() => setPickerViewDate(new Date(pickerViewDate.getFullYear(), pickerViewDate.getMonth() - 1, 1))} className="p-1.5 hover:bg-github-btn rounded text-github-text"><ChevronLeft size={18}/></button>
              <span className="text-sm font-bold text-white">{pickerViewDate.getFullYear()}년 {pickerViewDate.getMonth() + 1}월</span>
              <button onClick={() => setPickerViewDate(new Date(pickerViewDate.getFullYear(), pickerViewDate.getMonth() + 1, 1))} className="p-1.5 hover:bg-github-btn rounded text-github-text"><ChevronRight size={18}/></button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center">
              {['일','월','화','수','목','금','토'].map(d => <div key={d} className="text-[10px] font-bold text-github-muted pb-2 uppercase tracking-tighter">{d}</div>)}
              {calendarDays.map((d, i) => {
                const isSelected = selectedDate.getDate() === d.day && selectedDate.getMonth() === d.month && selectedDate.getFullYear() === d.year;
                return (
                  <button key={i} onClick={() => selectDate(d.year, d.month, d.day)} className={`aspect-square rounded text-xs font-medium flex items-center justify-center transition-all ${!d.isCurrent ? 'text-github-muted/30' : 'text-github-text hover:bg-github-btn'} ${isSelected ? 'bg-github-accent text-white font-bold scale-110 shadow-lg shadow-github-accent/20' : ''}`}>{d.day}</button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {showHabitForm && user && !isReadOnly && (
        <HabitForm 
          userEmail={user.email} 
          onClose={() => { setShowHabitForm(false); setEditingHabit(undefined); }} 
          onSave={async (habit, invitees, logs) => {
             setLoading(true);
             try {
               if (editingHabit) await saveHabitLog(user.email, habit.id, habit, logs || {});
               else await createHabit(user.email, habit, invitees, logs || {});
               await loadData(true);
             } catch (e) { console.error(e); } finally { setLoading(false); setShowHabitForm(false); setEditingHabit(undefined); }
          }}
          initialData={editingHabit} 
          initialLogs={sharedData.find(d => d.myRecord.habit_id === editingHabit?.id)?.myRecord.logs}
        />
      )}

      {tutorialMessage && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center pointer-events-none p-4 pb-20 sm:pb-4">
           <div className="bg-github-card border border-github-accent shadow-2xl rounded-xl p-5 max-w-sm w-full animate-in fade-in slide-in-from-bottom-4 pointer-events-auto flex gap-4 items-start ring-1 ring-github-accent/30"><div className="bg-github-accent/10 p-2 rounded-full text-github-accent"><Info size={24} /></div><div className="flex-1"><h3 className="font-bold text-lg mb-1 text-white">{tutorialMessage.title}</h3><p className="text-sm text-github-muted leading-relaxed">{tutorialMessage.desc}</p><div className="mt-4 flex justify-end"><button onClick={() => setTutorialMessage(null)} className="px-4 py-1.5 bg-github-accent text-white text-xs font-bold rounded-md hover:bg-github-accent/80 transition-colors">확인</button></div></div></div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
