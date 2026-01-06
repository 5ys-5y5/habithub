import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, CheckCircle2, Users, User, Plus, Trash2, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Save, RotateCcw, Image as ImageIcon, Upload, Check, Mail, UserMinus, Loader2 } from 'lucide-react';
import { Habit } from '../types';

interface HabitFormProps {
  userEmail: string;
  onClose: () => void;
  onSave: (habit: Habit, invitees: string[], logs?: { [date: string]: boolean }) => void;
  initialData?: Habit; // For Edit Mode
  initialLogs?: { [date: string]: boolean };
}

const COLORS = [
  'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500', 
  'bg-teal-500', 'bg-blue-500', 'bg-indigo-500', 'bg-purple-500', 'bg-pink-500', 'bg-slate-500'
];

const DAYS = ['일', '월', '화', '수', '목', '금', '토'];

const formatDatesToRange = (dates: string[]) => {
  if (dates.length === 0) return '';
  const sorted = [...dates].sort();
  const result: string[] = [];
  let start = sorted[0];
  let end = sorted[0];

  for (let i = 1; i <= sorted.length; i++) {
    const current = sorted[i];
    if (!current) {
      if (start === end) result.push(start);
      else result.push(`${start}~${end}`);
      break;
    }
    const prevDate = new Date(end);
    prevDate.setDate(prevDate.getDate() + 1);
    const expected = prevDate.toISOString().split('T')[0];

    if (current === expected) {
      end = current;
    } else {
      if (start === end) result.push(start);
      else result.push(`${start}~${end}`);
      start = current;
      end = current;
    }
  }
  return result.join(', ');
};

const HabitForm: React.FC<HabitFormProps> = ({ userEmail, onClose, onSave, initialData, initialLogs = {} }) => {
  const isEdit = !!initialData;
  const [mode, setMode] = useState<'personal' | 'together'>('personal');
  const [invitees, setInvitees] = useState<string[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  
  const [isBatchLogOpen, setIsBatchLogOpen] = useState(false);
  const [tempLogs, setTempLogs] = useState<{ [date: string]: boolean }>(initialLogs);
  const [viewDate, setViewDate] = useState(new Date());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState<Partial<Habit>>({
    name: '',
    color: 'bg-green-500',
    type: 'do',
    goal: 1,
    unit: '회',
    frequency: { type: 'daily' }
  });

  const [batchRangeStr, setBatchRangeStr] = useState('');
  const [batchStatus, setBatchStatus] = useState<'true' | 'false' | 'null'>('true');
  const [batchLogic, setBatchLogic] = useState<'daily' | 'specific' | 'weekly'>('daily');
  const [batchSelectedDays, setBatchSelectedDays] = useState<number[]>([]);
  const [batchWeeklyValue, setBatchWeeklyValue] = useState<number>(1);

  const [pendingImageDates, setPendingImageDates] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialData) {
        setFormData({ ...initialData });
        setMode(initialData.mode || 'personal');
        if (initialData.members) {
            setInvitees(initialData.members.filter(m => m.toLowerCase() !== userEmail.toLowerCase()));
        }
        if (initialData.frequency) {
          const fType = initialData.frequency.type;
          setBatchLogic(fType === 'weekly_count' ? 'weekly' : (fType === 'specific_days' ? 'specific' : 'daily'));
          setBatchSelectedDays(initialData.frequency.days || []);
          setBatchWeeklyValue(initialData.frequency.value || 1);
        }
    }
  }, [initialData, userEmail]);

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3000);
  };

  const updateForm = (key: keyof Habit, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleAddInvitee = (e: React.FormEvent) => {
    e.preventDefault();
    const email = inviteEmail.trim().toLowerCase();
    if (email && email !== userEmail.toLowerCase() && !invitees.includes(email)) {
      setInvitees(prev => [...prev, email]);
      setInviteEmail('');
    }
  };

  const handleRemoveInvitee = (email: string) => {
    setInvitees(prev => prev.filter(e => e !== email));
  };

  const handleBatchDayToggle = (dayIndex: number) => {
    setBatchSelectedDays(prev => 
      prev.includes(dayIndex) ? prev.filter(d => d !== dayIndex) : [...prev, dayIndex].sort()
    );
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!formData.name || isSubmitting) return;

    setIsSubmitting(true);
    const newHabit: Habit = {
      ...(initialData || {}),
      id: initialData?.id || '',
      userEmail,
      name: formData.name!,
      color: formData.color!,
      type: formData.type!,
      goal: formData.goal!,
      unit: formData.unit!,
      frequency: formData.frequency!,
      createdAt: initialData?.createdAt || new Date().toISOString(),
      mode: mode,
      members: mode === 'together' ? [userEmail, ...invitees] : [userEmail]
    };
    
    onSave(newHabit, mode === 'together' ? invitees : [], tempLogs);
    onClose();
  };

  const calendarDays = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    
    const daysArr = [];
    const prevLastDate = new Date(year, month, 0).getDate();
    for(let i = firstDay - 1; i >= 0; i--) {
      daysArr.push({ day: prevLastDate - i, month: month - 1, year, isCurrent: false });
    }
    for(let i = 1; i <= lastDate; i++) {
      daysArr.push({ day: i, month: month, year, isCurrent: true });
    }
    const remaining = 42 - daysArr.length;
    for(let i = 1; i <= remaining; i++) {
      daysArr.push({ day: i, month: month + 1, year, isCurrent: false });
    }
    return daysArr;
  }, [viewDate]);

  const toggleDayLog = (dateStr: string) => {
    setTempLogs(prev => {
      const next = { ...prev };
      const current = prev[dateStr];
      if (current === true) next[dateStr] = false;
      else if (current === false) delete next[dateStr];
      else next[dateStr] = true;
      return next;
    });
  };

  const applyBatch = () => {
    if (!batchRangeStr) return;
    const parts = batchRangeStr.split(',').map(p => p.trim());
    const newLogs = { ...tempLogs };
    let count = 0;
    
    parts.forEach(part => {
      if (part.includes('~')) {
        const [startStr, endStr] = part.split('~').map(s => s.trim());
        const start = new Date(startStr);
        const end = new Date(endStr);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) return;
        
        let cursor = new Date(start);
        while (cursor <= end) {
          const dateKey = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
          let shouldApply = false;
          if (batchLogic === 'daily') shouldApply = true;
          else if (batchLogic === 'specific') shouldApply = batchSelectedDays.includes(cursor.getDay());
          else if (batchLogic === 'weekly') {
            const dayOfW = cursor.getDay();
            if (dayOfW < batchWeeklyValue) shouldApply = true;
          }

          if (shouldApply) {
            if (batchStatus === 'true') newLogs[dateKey] = true;
            else if (batchStatus === 'false') newLogs[dateKey] = false;
            else delete newLogs[dateKey];
            count++;
          }
          cursor.setDate(cursor.getDate() + 1);
        }
      } else {
        const d = new Date(part);
        if (!isNaN(d.getTime())) {
          const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          if (batchStatus === 'true') newLogs[dateKey] = true;
          else if (batchStatus === 'false') newLogs[dateKey] = false;
          else delete newLogs[dateKey];
          count++;
        }
      }
    });
    setTempLogs(newLogs);
    setBatchRangeStr('');
    showFeedback(`${count}개의 기록이 캘린더에 반영되었습니다.`);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const dates = Array.from(files).map(file => {
      const d = new Date(file.lastModified);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return dateStr;
    });
    const uniqueDates = Array.from(new Set(dates)).sort();
    setPendingImageDates(uniqueDates);
  };

  const applyImageBatch = () => {
    if (pendingImageDates.length === 0) return;

    setTempLogs(prev => {
      const next = { ...prev };
      pendingImageDates.forEach(date => {
        next[date] = true;
      });
      return next;
    });
    const appliedCount = pendingImageDates.length;
    setPendingImageDates([]);
    if (imageInputRef.current) imageInputRef.current.value = '';
    showFeedback(`${appliedCount}개의 이미지 날짜가 '완료'로 기록되었습니다.`);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className={`w-full ${isBatchLogOpen ? 'max-w-3xl' : 'max-w-lg'} bg-github-bg rounded-xl shadow-2xl border border-github-border flex flex-col max-h-[90vh] transition-all duration-300 relative`}>
        
        {feedback && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[80] bg-github-success text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg animate-in fade-in slide-in-from-top-4 flex items-center gap-2">
            <Check size={16} /> {feedback}
          </div>
        )}

        <div className="p-4 border-b border-github-border flex items-center justify-between">
          <h2 className="text-lg font-bold text-github-text">
            {isBatchLogOpen ? '과거 기록 일괄 관리' : (isEdit ? '습관 수정하기' : '습관 만들기')}
          </h2>
          <button onClick={onClose} className="p-1 text-github-muted hover:text-github-text"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className={`p-6 space-y-6 ${isBatchLogOpen ? 'hidden' : 'block'}`}>
            <form id="habit-form" onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-github-text">어떤 습관인가요?</label>
                <div className="flex gap-2 mb-2 p-1 bg-github-card border border-github-border rounded-lg">
                  <button type="button" onClick={() => setMode('personal')} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${mode === 'personal' ? 'bg-github-btn text-github-text shadow-sm' : 'text-github-muted hover:text-github-text'}`}><User size={16} /> 혼자 하기</button>
                  <button type="button" onClick={() => setMode('together')} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${mode === 'together' ? 'bg-github-btn text-github-text shadow-sm' : 'text-github-muted hover:text-github-text'}`}><Users size={16} /> 같이 하기</button>
                </div>

                {mode === 'together' && (
                  <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                    <div className="flex gap-2">
                      <input 
                        type="email" 
                        value={inviteEmail} 
                        onChange={(e) => setInviteEmail(e.target.value)} 
                        className="flex-1 bg-github-card border border-github-border rounded-lg h-10 px-4 text-sm focus:outline-none focus:border-github-accent placeholder-github-muted" 
                        placeholder="초대할 친구의 Gmail 이메일"
                        onKeyPress={(e) => { if(e.key === 'Enter') handleAddInvitee(e); }}
                      />
                      <button type="button" onClick={handleAddInvitee} className="px-4 bg-github-btn border border-github-border rounded-lg text-github-text hover:bg-github-btnHover transition-colors"><Plus size={18} /></button>
                    </div>
                    {invitees.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {invitees.map(email => (
                          <div key={email} className="flex items-center gap-1 bg-github-btn border border-github-border px-2 py-1 rounded text-xs text-github-muted">
                            <Mail size={12} /> {email}
                            <button type="button" onClick={() => handleRemoveInvitee(email)} className="ml-1 text-github-muted hover:text-red-400"><X size={14}/></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <input type="text" value={formData.name} onChange={(e) => updateForm('name', e.target.value)} className="w-full bg-github-card border border-github-border rounded-lg h-10 px-4 text-github-text focus:outline-none focus:border-github-accent placeholder-github-muted" placeholder="예: 물 마시기" required />
                <div className="flex justify-between items-center py-2 px-1">
                  {COLORS.map(color => (
                    <button key={color} type="button" onClick={() => updateForm('color', color)} className={`w-8 h-8 rounded-full flex-shrink-0 transition-all ${color} ${formData.color === color ? 'ring-2 ring-white ring-offset-2 ring-offset-github-bg scale-110' : 'opacity-70 hover:opacity-100'}`} />
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-github-text">유형</label>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => updateForm('type', 'do')} className={`p-3 rounded-lg border text-sm font-medium transition-all ${formData.type === 'do' ? 'bg-github-accent/20 border-github-accent text-github-accent' : 'bg-github-card border-github-border text-github-muted hover:border-github-muted'}`}>잘 하기 (Do)</button>
                  <button type="button" onClick={() => updateForm('type', 'dont')} className={`p-3 rounded-lg border text-sm font-medium transition-all ${formData.type === 'dont' ? 'bg-red-500/20 border-red-500 text-red-400' : 'bg-github-card border-github-border text-github-muted hover:border-github-muted'}`}>안 하기 (Don't)</button>
                </div>
              </div>
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-github-text">목표 및 주기</label>
                <div className="bg-github-card border border-github-border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-center gap-3">
                    <span className="text-sm text-github-muted">하루에</span>
                    <input type="number" min="1" value={formData.goal} onChange={(e) => updateForm('goal', parseInt(e.target.value))} className="w-16 bg-github-bg border border-github-border rounded h-8 text-center" />
                    <input type="text" value={formData.unit} onChange={(e) => updateForm('unit', e.target.value)} className="w-20 bg-github-bg border border-github-border rounded h-8 px-2 text-center" placeholder="단위" />
                    <span className="text-sm text-github-muted">{formData.type === 'do' ? '이상 하기' : '이하로 하기'}</span>
                  </div>
                  <div className="flex gap-2">
                     {['daily', 'specific_days', 'weekly_count'].map(id => (
                       <button key={id} type="button" onClick={() => setFormData(prev => ({ ...prev, frequency: { type: id as any, days: [], value: 1 } }))} className={`flex-1 py-1.5 text-xs rounded border transition-colors ${formData.frequency?.type === id ? 'bg-github-text text-github-bg font-bold' : 'border-github-border text-github-muted'}`}>{id === 'daily' ? '매일' : id === 'specific_days' ? '특정 요일' : '주 n회'}</button>
                     ))}
                  </div>
                </div>
              </div>
            </form>
          </div>

          <div className={`p-6 space-y-8 ${isBatchLogOpen ? 'block' : 'hidden'}`}>
            <div className="w-full">
               <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-github-text flex items-center gap-2"><CalendarIcon size={16}/> 날짜별 직접 수정</h3>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))} className="p-1 hover:bg-github-btn rounded"><ChevronLeft size={20}/></button>
                    <span className="text-sm font-bold min-w-[100px] text-center">{viewDate.getFullYear()}년 {viewDate.getMonth() + 1}월</span>
                    <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))} className="p-1 hover:bg-github-btn rounded"><ChevronRight size={20}/></button>
                  </div>
               </div>
               <div className="grid grid-cols-7 gap-1">
                 {DAYS.map(d => <div key={d} className="text-center text-[10px] text-github-muted font-bold py-1">{d}</div>)}
                 {calendarDays.map((d, i) => {
                   const dateObj = new Date(d.year, d.month, d.day);
                   const dateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
                   const status = tempLogs[dateStr];
                   return (
                     <button key={i} onClick={() => toggleDayLog(dateStr)} className={`aspect-square rounded border flex flex-col items-center justify-center transition-all ${!d.isCurrent ? 'opacity-30' : ''} ${status === true ? 'bg-github-success border-github-success text-white' : status === false ? 'bg-red-500 border-red-500 text-white' : 'bg-github-card border-github-border text-github-muted'}`}>
                        <span className="text-xs font-bold">{d.day}</span>
                     </button>
                   );
                 })}
               </div>
            </div>

            <div className="w-full bg-github-card border border-github-border rounded-xl p-5 space-y-5">
               <h3 className="font-bold text-github-text flex items-center gap-2 border-b border-github-border pb-2"><RotateCcw size={16}/> 날짜 일괄 추가 도구</h3>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="space-y-2">
                    <label className="text-xs font-semibold text-github-muted">대상 날짜 범위</label>
                    <textarea value={batchRangeStr} onChange={(e) => setBatchRangeStr(e.target.value)} placeholder="예: 2024-12-01~2024-12-31, 2025-01-05" className="w-full h-24 bg-github-bg border border-github-border rounded-lg p-3 text-sm focus:border-github-accent focus:outline-none placeholder:text-github-muted" />
                 </div>
                 <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-github-muted">적용할 상태</label>
                      <div className="grid grid-cols-3 gap-2">
                        <button onClick={() => setBatchStatus('true')} className={`py-1.5 rounded text-xs font-bold border ${batchStatus === 'true' ? 'bg-github-success border-github-success text-white' : 'bg-github-bg border-github-border text-github-muted'}`}>완료</button>
                        <button onClick={() => setBatchStatus('false')} className={`py-1.5 rounded text-xs font-bold border ${batchStatus === 'false' ? 'bg-red-500 border-red-500 text-white' : 'bg-github-bg border-github-border text-github-muted'}`}>미완료</button>
                        <button onClick={() => setBatchStatus('null')} className={`py-1.5 rounded text-xs font-bold border ${batchStatus === 'null' ? 'bg-github-muted border-github-muted text-white' : 'bg-github-bg border-github-border text-github-muted'}`}>비대상</button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-github-muted">적용 주기 기준</label>
                      <select value={batchLogic} onChange={(e) => setBatchLogic(e.target.value as any)} className="w-full bg-github-bg border border-github-border rounded p-2 text-xs text-github-text focus:outline-none">
                        <option value="daily">기간 내 매일 적용</option>
                        <option value="specific">기간 내 특정 요일만</option>
                        <option value="weekly">기간 내 주 N회만</option>
                      </select>
                      {batchLogic === 'specific' && (
                        <div className="flex justify-between gap-1 mt-1">
                          {DAYS.map((day, idx) => (
                            <button key={idx} onClick={() => handleBatchDayToggle(idx)} className={`w-7 h-7 rounded-full text-[10px] font-bold border transition-all ${batchSelectedDays.includes(idx) ? 'bg-github-accent border-github-accent text-white' : 'bg-github-bg border-github-border text-github-muted'}`}>{day}</button>
                          ))}
                        </div>
                      )}
                      {batchLogic === 'weekly' && (
                        <div className="flex items-center gap-3 mt-1 bg-github-bg p-2 rounded border border-github-border">
                          <span className="text-[10px] text-github-muted">주당 횟수:</span>
                          <div className="flex items-center gap-2">
                            <button onClick={() => setBatchWeeklyValue(v => Math.max(1, v - 1))} className="w-6 h-6 rounded bg-github-btn">-</button>
                            <span className="text-xs font-bold w-4 text-center">{batchWeeklyValue}</span>
                            <button onClick={() => setBatchWeeklyValue(v => Math.min(7, v + 1))} className="w-6 h-6 rounded bg-github-btn">+</button>
                          </div>
                        </div>
                      )}
                    </div>
                 </div>
               </div>
               <button onClick={applyBatch} className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-sm shadow-md transition-all active:scale-95">조건대로 일괄 반영하기</button>
            </div>

            <div className="w-full bg-github-card border border-github-border rounded-xl p-5 space-y-4">
               <h3 className="font-bold text-github-text flex items-center gap-2 border-b border-github-border pb-2"><ImageIcon size={16}/> 이미지로 날짜 일괄 추가 도구</h3>
               <div className="p-4 bg-github-bg border border-dashed border-github-border rounded-lg flex flex-col items-center justify-center text-center space-y-3 transition-colors hover:border-github-accent">
                  <Upload className="text-github-muted" size={32} />
                  <div>
                    <p className="text-sm font-semibold text-github-text">이미지를 선택하여 업로드하세요</p>
                    <p className="text-xs text-github-muted mt-1">이미지의 생성(촬영) 날짜를 추출하여 완료 상태로 자동 기록합니다.</p>
                  </div>
                  <input ref={imageInputRef} type="file" multiple accept="image/*" onChange={handleImageSelect} className="hidden" id="image-batch-upload" />
                  <label htmlFor="image-batch-upload" className="px-4 py-2 bg-github-btn border border-github-border rounded-md text-sm font-bold hover:bg-github-btnHover cursor-pointer transition-colors shadow-sm">이미지 선택하기</label>
               </div>
               {pendingImageDates.length > 0 && (
                 <div className="space-y-4 pt-2">
                    <div className="p-4 bg-github-bg border border-github-border rounded-lg">
                       <p className="text-xs font-bold text-github-muted uppercase mb-2 flex items-center justify-between">
                         감지된 날짜 ({pendingImageDates.length}개)
                         <button onClick={() => setPendingImageDates([])} className="text-red-400 hover:text-red-300">비우기</button>
                       </p>
                       <p className="text-sm text-github-accent font-medium leading-relaxed break-all">
                          {formatDatesToRange(pendingImageDates)}
                       </p>
                    </div>
                    <button onClick={applyImageBatch} className="w-full py-2.5 bg-github-success text-white rounded-lg text-sm font-bold hover:bg-github-successHover shadow-md transition-all active:scale-95 flex items-center justify-center gap-2">
                      <CheckCircle2 size={16} /> 추출된 날짜 모두 '완료'로 반영하기
                    </button>
                 </div>
               )}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-github-border bg-github-card flex gap-3">
          {!isBatchLogOpen && (
            <>
              {isEdit && (
                <button type="button" onClick={() => setIsBatchLogOpen(true)} className="flex-1 px-6 py-2.5 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors shadow-sm flex items-center justify-center gap-2">
                  <RotateCcw size={18} /> 일괄 추가/수정
                </button>
              )}
              <button disabled={isSubmitting} form="habit-form" type="submit" className="flex-1 px-6 py-2.5 rounded-lg bg-github-success text-white font-bold hover:bg-github-successHover flex items-center justify-center transition-colors shadow-sm disabled:opacity-50">
                {isSubmitting ? <Loader2 className="animate-spin w-5 h-5" /> : (isEdit ? '수정 저장' : '습관 생성')}
              </button>
            </>
          )}

          {isBatchLogOpen && (
            <>
              <button type="button" onClick={() => { setIsBatchLogOpen(false); setPendingImageDates([]); }} className="flex-1 px-6 py-2.5 rounded-lg bg-github-btn border border-github-border text-github-text font-bold hover:bg-github-btnHover transition-colors flex items-center justify-center">돌아가기</button>
              <button disabled={isSubmitting} type="button" onClick={() => handleSubmit()} className="flex-1 px-6 py-2.5 rounded-lg bg-github-success text-white font-bold hover:bg-github-successHover flex items-center justify-center transition-colors shadow-sm disabled:opacity-50">
                {isSubmitting ? <Loader2 className="animate-spin w-5 h-5" /> : '최종 저장'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default HabitForm;