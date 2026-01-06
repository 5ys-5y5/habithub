import React, { useEffect, useState, useMemo, useRef } from 'react';
import { User, Habit, HabitRecord, SharedHabitData } from '../types';
import { fetchHabitRecords, saveHabitLog, createHabit, respondToInvite, deleteHabit } from '../services/sheetService';
import Heatmap from './Heatmap';
import HabitForm from './HabitForm';
import FriendSidebar from './FriendSidebar';
import { Plus, X as XIcon, Minus, LogOut, Loader2, LogIn, ChevronLeft, ChevronRight, Activity, Users, BellRing, Check, Ban, Mail, Pencil, Trash2, CalendarDays, Info, X } from 'lucide-react';

interface DashboardProps {
  user: User | null;
  onLogout: () => void;
  onLoginReq: () => void;
}

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

const Dashboard: React.FC<DashboardProps> = ({ user, onLogout, onLoginReq }) => {
  const [sharedData, setSharedData] = useState<SharedHabitData[]>([]);
  const [loading, setLoading] = useState(false);
  const [showHabitForm, setShowHabitForm] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | undefined>(undefined);
  const [tutorialMessage, setTutorialMessage] = useState<{ title: string; desc: string } | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  // 커스텀 달력 상태 (UI 노출용이 아닌 로직 해결용)
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [pickerViewDate, setPickerViewDate] = useState(new Date());

  const formattedDate = useMemo(() => getLocalISOString(selectedDate), [selectedDate]);
  const displayDate = useMemo(() => selectedDate.toLocaleDateString('ko-KR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }), [selectedDate]);

  // XPath 추적 및 클릭 디버깅 로그
  useEffect(() => {
    const getXPath = (element: HTMLElement | null): string => {
      if (!element || element.nodeType !== 1) return "";
      if (element.id) return `//*[@id="${element.id}"]`;
      let sames = Array.from(element.parentNode?.childNodes || []).filter(x => x.nodeName === element.nodeName);
      let index = sames.indexOf(element) + 1;
      return getXPath(element.parentNode as HTMLElement) + '/' + element.nodeName.toLowerCase() + (sames.length > 1 ? `[${index}]` : "");
    };

    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      console.log(`[TRACE][CLICK] Tag: <${target.tagName}>, Class: "${target.className}", ID: "${target.id}"`);
      console.log(`[TRACE][XPATH] ${getXPath(target)}`);
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  const loadData = async (showLoading = true) => {
    if (!user) {
      setSharedData(SAMPLE_DATA);
      return;
    }
    if (showLoading) setLoading(true);
    const data = await fetchHabitRecords(user.email);
    setSharedData(data);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [user]);

  const handleTutorial = (title: string, desc: string) => {
    if (!user) { 
      setTutorialMessage({ title, desc }); 
      return true; 
    }
    return false;
  };

  const shiftDate = (days: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(selectedDate.getDate() + days);
    setSelectedDate(newDate);
  };

  // 날짜 클릭 시 트리거 (XPath: //*[@id="root"]/div/div/main/div/section[2]/div[1]/div/div)
  const triggerDatePicker = (e: React.MouseEvent) => {
    console.log("[TRACE][STEP 1] Date Area Clicked - Logic Triggered");
    e.preventDefault();
    e.stopPropagation();

    if (handleTutorial("날짜 이동", "캘린더를 통해 과거의 기록을 확인하거나 특정 날짜의 목표를 미리 볼 수 있어요.")) {
      console.log("[TRACE][ABORT] Guest user - tutorial shown");
      return;
    }

    console.log("[TRACE][STEP 2] showPicker blocked by iframe. Opening custom modal fallback.");
    setPickerViewDate(new Date(selectedDate));
    setIsDatePickerOpen(true);
  };

  const selectDate = (year: number, month: number, day: number) => {
    const newDate = new Date(year, month, day);
    console.log(`[TRACE][STEP 3] Date Selected: ${year}-${month+1}-${day}`);
    setSelectedDate(newDate);
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

  const handleToggleLog = async (record: HabitRecord) => {
    const currentStatus = record.logs[formattedDate];
    let newStatus = currentStatus === undefined ? true : (currentStatus === true ? false : undefined);
    const newLogs = { ...record.logs };
    if (newStatus === undefined) delete newLogs[formattedDate];
    else newLogs[formattedDate] = newStatus;
    setSharedData(prev => prev.map(item => item.myRecord.habit_id === record.habit_id ? { ...item, myRecord: { ...item.myRecord, logs: newLogs } } : item));
    if (user) await saveHabitLog(user.email, record.habit_id, record.habit, newLogs);
  };

  const activeSharedData = useMemo(() => sharedData.filter(d => d.myRecord.habit.recordStatus === 'active' || !d.myRecord.habit.recordStatus), [sharedData]);
  const invitedHabits = useMemo(() => sharedData.filter(d => d.myRecord.habit.recordStatus === 'invited'), [sharedData]);
  const todaysHabits = useMemo(() => {
    const dayOfWeek = selectedDate.getDay(); 
    return activeSharedData.filter(({ myRecord: record }) => {
      const { frequency } = record.habit;
      if (frequency.type === 'daily') return true;
      if (frequency.type === 'specific_days') return frequency.days?.includes(dayOfWeek);
      return frequency.type === 'weekly_count';
    });
  }, [activeSharedData, selectedDate]);

  return (
    <div className="h-screen bg-github-bg text-github-text font-sans flex flex-col overflow-hidden">
      <nav className="bg-github-card border-b border-github-border py-4 px-6 flex justify-between items-center z-20 shadow-sm flex-shrink-0">
        <h1 className="font-bold text-lg tracking-tight">HabitHub</h1>
        <div className="flex items-center gap-4">
          {user ? (
            <><span className="text-sm text-github-muted hidden sm:inline"><span className="text-github-text font-medium">{user.name}</span>님</span><button onClick={onLogout} className="p-2 hover:bg-github-btnHover rounded-md text-github-muted hover:text-red-400 transition-colors"><LogOut size={18} /></button></>
          ) : <button onClick={onLoginReq} className="px-3 py-1.5 bg-github-btn border border-github-border rounded-md text-sm font-medium hover:bg-github-btnHover transition-colors flex items-center gap-2"><LogIn size={14} /> 로그인</button>}
        </div>
      </nav>

      <div className="flex-1 flex w-full overflow-hidden">
         <main className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-6 custom-scrollbar flex justify-center">
          <div className="pb-20 inline-flex flex-col gap-8 w-fit max-w-full">
            {invitedHabits.length > 0 && (
              <section className="w-full bg-github-card border border-github-accent/30 rounded-lg p-4 animate-in fade-in slide-in-from-top-2">
                 <div className="flex items-center gap-2 mb-3 text-github-accent font-bold"><BellRing size={18} /> 새로운 습관 초대</div>
                 <div className="space-y-3">
                   {invitedHabits.map(({ myRecord: record }) => (
                       <div key={record.habit_id} className="flex items-center justify-between bg-github-bg p-3 rounded border border-github-border">
                          <div className="flex items-center gap-3"><span className={`w-3 h-3 rounded-full ${record.habit.color}`}></span><div><div className="font-semibold text-sm">{record.habit.name}</div><div className="text-xs text-github-muted flex items-center gap-3 mt-1"><span><Users size={12} /> {record.habit.members?.length}명 멤버</span></div></div></div>
                          <div className="flex gap-2"><button onClick={() => respondToInvite(record, true).then(() => loadData(false))} className="px-3 py-1.5 bg-github-success text-white rounded text-xs font-bold hover:bg-github-successHover">수락</button><button onClick={() => respondToInvite(record, false).then(() => loadData(false))} className="px-3 py-1.5 bg-github-btn text-github-muted rounded text-xs hover:text-red-400">거절</button></div>
                       </div>
                   ))}
                 </div>
              </section>
            )}

            <section className="w-full">
              <div className="flex items-center justify-between mb-6"><h2 className="text-xl font-bold flex items-center gap-2"><Activity size={20} className="text-github-muted"/>활동 대시보드</h2></div>
              {activeSharedData.length === 0 ? <div className="w-full min-w-[720px] bg-github-card border border-github-border rounded-lg p-10 text-center text-github-muted italic">아직 활성화된 습관 활동이 없습니다.</div> : (
                <div className="flex flex-col gap-3 w-full max-w-full">
                  {activeSharedData.map(({ myRecord, peerRecords }) => (
                    <div key={myRecord.habit_id} className="w-full max-w-full min-w-0 bg-github-card border border-github-border rounded-lg pl-6 pr-6 pt-4 pb-4 relative group">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2"><span className={`w-3 h-3 rounded-full ${myRecord.habit.color}`}></span><span className="font-semibold text-sm truncate">{myRecord.habit.name}</span></div>
                        <div className="flex gap-1"><button onClick={() => { setEditingHabit(myRecord.habit); setShowHabitForm(true); }} className="p-2 text-github-muted hover:text-github-accent hover:bg-github-btn rounded"><Pencil size={14}/></button><button onClick={() => { if(confirm("삭제하시겠습니까?")) deleteHabit(myRecord).then(() => loadData(false)); }} className="p-1.5 text-github-muted hover:text-red-400 hover:bg-github-btn rounded"><Trash2 size={14}/></button></div>
                      </div>
                      <Heatmap myRecord={myRecord} peerRecords={peerRecords} rangeDays={365} />
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="w-full">
              {/* [UI 원복] XPath: //*[@id="root"]/div/div/main/div/section[2]/div[1]/div/div 영역 */}
              <div className="flex items-center justify-between mb-9 bg-github-card p-3 rounded-lg border border-github-border">
                <button onClick={() => shiftDate(-1)} className="p-2 hover:bg-github-btnHover rounded-full transition-colors"><ChevronLeft size={20} /></button>
                
                <div 
                  onClick={triggerDatePicker}
                  className="text-center relative group p-2 rounded transition-colors flex-1 cursor-pointer select-none"
                  id="goals-date-header"
                >
                  <h2 className="text-lg font-bold pointer-events-none">목표</h2>
                  <div className="text-sm text-github-muted group-hover:text-github-accent flex items-center justify-center gap-2 pointer-events-none">
                    {displayDate}
                  </div>
                </div>
                
                <button onClick={() => shiftDate(1)} className="p-2 hover:bg-github-btnHover rounded-full transition-colors"><ChevronRight size={20} /></button>
              </div>

              {loading ? <div className="h-48 flex items-center justify-center text-github-muted"><Loader2 className="animate-spin mr-2" /> 기록을 불러오는 중...</div> : (
                <div className="space-y-3">
                  {todaysHabits.length === 0 && <div className="text-center py-10 text-github-muted border-2 border-dashed border-github-border rounded-lg">이 날짜에 예정된 습관이 없습니다.</div>}
                  {todaysHabits.map(({ myRecord: record }) => {
                    const status = record.logs[formattedDate];
                    const isDone = status === true;
                    return (
                      <div key={record.habit_id} className={`bg-github-card border ${isDone ? 'border-github-muted' : 'border-github-border'} rounded-lg p-4 flex items-center justify-between transition-all`}>
                        <div className="flex items-center gap-4"><div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold shadow-sm ${isDone ? record.habit.color : `${record.habit.color} opacity-40`}`}>{record.habit.name.charAt(0)}</div><div><h3 className={`font-semibold text-lg ${isDone ? 'text-github-muted line-through' : 'text-github-text'}`}>{record.habit.name}</h3><p className="text-xs text-github-muted">{record.habit.goal} {record.habit.unit}</p></div></div>
                        <button onClick={() => handleToggleLog(record)} className={`w-12 h-12 rounded-xl border flex items-center justify-center transition-all ${isDone ? 'bg-github-btn border-github-muted text-github-muted' : 'bg-github-btn border-github-border text-github-success hover:bg-github-btnHover'}`}>{isDone ? <XIcon size={24} /> : <Plus size={24} />}</button>
                      </div>
                    );
                  })}
                  <button onClick={() => { if (!handleTutorial("새 습관", "")) setShowHabitForm(true); }} className="w-full py-4 border-2 border-dashed border-github-border rounded-lg text-github-muted hover:text-github-text hover:border-github-muted hover:bg-github-card/50 transition-all flex items-center justify-center gap-2 font-medium mt-4"><Plus size={18} />새로운 습관 추가하기</button>
                </div>
              )}
            </section>
          </div>
         </main>
        {user && <FriendSidebar user={user} />}
      </div>

      {/* 달력 선택기 모달 (iframe 보안 에러 우회용) */}
      {isDatePickerOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-github-card border border-github-border rounded-xl shadow-2xl p-6 w-full max-w-[320px] animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-github-text">날짜 선택</h3>
              <button onClick={() => setIsDatePickerOpen(false)} className="text-github-muted hover:text-github-text"><X size={20}/></button>
            </div>
            <div className="flex items-center justify-between mb-4 bg-github-bg rounded-lg p-1 border border-github-border">
              <button onClick={() => setPickerViewDate(new Date(pickerViewDate.getFullYear(), pickerViewDate.getMonth() - 1, 1))} className="p-1.5 hover:bg-github-btn rounded"><ChevronLeft size={18}/></button>
              <span className="text-sm font-bold">{pickerViewDate.getFullYear()}년 {pickerViewDate.getMonth() + 1}월</span>
              <button onClick={() => setPickerViewDate(new Date(pickerViewDate.getFullYear(), pickerViewDate.getMonth() + 1, 1))} className="p-1.5 hover:bg-github-btn rounded"><ChevronRight size={18}/></button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center">
              {['일','월','화','수','목','금','토'].map(d => <div key={d} className="text-[10px] font-bold text-github-muted pb-2">{d}</div>)}
              {calendarDays.map((d, i) => {
                const isSelected = selectedDate.getDate() === d.day && selectedDate.getMonth() === d.month && selectedDate.getFullYear() === d.year;
                return (
                  <button 
                    key={i} 
                    onClick={() => selectDate(d.year, d.month, d.day)}
                    className={`aspect-square rounded text-xs font-medium flex items-center justify-center transition-all ${!d.isCurrent ? 'text-github-muted/30' : 'text-github-text hover:bg-github-btn'} ${isSelected ? 'bg-github-accent text-white font-bold' : ''}`}
                  >
                    {d.day}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {showHabitForm && user && (
        <HabitForm 
          userEmail={user.email} 
          onClose={() => setShowHabitForm(false)} 
          onSave={(habit, invitees, logs) => {
             createHabit(user.email, habit, invitees).then(async (res) => {
               if(res.status === 'success' && logs) await saveHabitLog(user.email, habit.id || (res as any).data.habit_id, habit, logs);
               loadData(false);
             });
          }}
          initialData={editingHabit} 
          initialLogs={sharedData.find(d => d.myRecord.habit_id === editingHabit?.id)?.myRecord.logs}
        />
      )}

      {tutorialMessage && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center pointer-events-none p-4 pb-20 sm:pb-4">
           <div className="bg-github-card border border-github-accent shadow-2xl rounded-xl p-4 max-w-sm w-full animate-in fade-in slide-in-from-bottom-4 pointer-events-auto flex gap-4 items-start"><div className="bg-github-accent/10 p-2 rounded-full text-github-accent"><Info size={24} /></div><div className="flex-1"><h3 className="font-bold text-lg mb-1">{tutorialMessage.title}</h3><p className="text-sm text-github-muted leading-relaxed">{tutorialMessage.desc}</p><div className="mt-3 flex justify-end"><button onClick={() => setTutorialMessage(null)} className="text-sm font-bold text-github-accent hover:underline">확인</button></div></div></div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
