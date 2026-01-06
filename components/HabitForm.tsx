import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, Users, User, Plus, Trash2 } from 'lucide-react';
import { Habit } from '../types';

interface HabitFormProps {
  userEmail: string;
  onClose: () => void;
  onSave: (habit: Habit, invitees: string[]) => void;
  initialData?: Habit; // For Edit Mode
}

const COLORS = [
  'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500', 
  'bg-teal-500', 'bg-blue-500', 'bg-indigo-500', 'bg-purple-500', 'bg-pink-500', 'bg-slate-500'
];

const DAYS = ['일', '월', '화', '수', '목', '금', '토'];

const HabitForm: React.FC<HabitFormProps> = ({ userEmail, onClose, onSave, initialData }) => {
  const isEdit = !!initialData;
  const [mode, setMode] = useState<'personal' | 'together'>('personal');
  const [invitees, setInvitees] = useState<string[]>([]);
  const [newInvitee, setNewInvitee] = useState('');

  const [formData, setFormData] = useState<Partial<Habit>>({
    name: '',
    color: 'bg-green-500',
    type: 'do',
    goal: 1,
    unit: '회',
    frequency: { type: 'daily' }
  });

  useEffect(() => {
    if (initialData) {
        setFormData({ ...initialData });
        setMode(initialData.mode || 'personal');
        if (initialData.members) {
            // Filter out self from invitees list for display
            setInvitees(initialData.members.filter(m => m !== userEmail));
        }
    }
  }, [initialData, userEmail]);

  const updateForm = (key: keyof Habit, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const updateFrequency = (key: keyof Habit['frequency'], value: any) => {
    setFormData(prev => ({
      ...prev,
      frequency: { ...prev.frequency!, [key]: value }
    }));
  };

  const handleDayToggle = (dayIndex: number) => {
    const currentDays = formData.frequency?.days || [];
    const newDays = currentDays.includes(dayIndex)
      ? currentDays.filter(d => d !== dayIndex)
      : [...currentDays, dayIndex].sort();
    
    updateFrequency('days', newDays);
  };

  const addInvitee = () => {
    if (newInvitee && newInvitee.includes('@') && !invitees.includes(newInvitee) && newInvitee !== userEmail) {
      setInvitees([...invitees, newInvitee.trim()]);
      setNewInvitee('');
    }
  };

  const removeInvitee = (email: string) => {
    setInvitees(invitees.filter(e => e !== email));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;

    const newHabit: Habit = {
      ...(initialData || {}), // Keep existing ID and timestamps if editing
      id: initialData?.id || '', // Will be generated in service if empty
      userEmail,
      name: formData.name!,
      color: formData.color!,
      type: formData.type!,
      goal: formData.goal!,
      unit: formData.unit!,
      frequency: formData.frequency!,
      createdAt: initialData?.createdAt || new Date().toISOString(),
      mode: mode
    };
    onSave(newHabit, mode === 'together' ? invitees : []);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-github-bg rounded-xl shadow-2xl border border-github-border flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-github-border flex items-center justify-between">
          <h2 className="text-lg font-bold text-github-text">{isEdit ? '습관 수정하기' : '습관 만들기'}</h2>
          <button onClick={onClose} className="p-1 text-github-muted hover:text-github-text">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar">
          <form id="habit-form" onSubmit={handleSubmit} className="space-y-6">
            
            {/* 1. Name & Color */}
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-github-text">어떤 습관인가요?</label>
              
              {/* Mode Toggle */}
              <div className="flex gap-2 mb-2 p-1 bg-github-card border border-github-border rounded-lg">
                <button
                  type="button"
                  disabled={isEdit}
                  onClick={() => setMode('personal')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${mode === 'personal' ? 'bg-github-btn text-github-text shadow-sm' : 'text-github-muted hover:text-github-text'} ${isEdit ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <User size={16} /> 혼자 하기
                </button>
                <button
                  type="button"
                  disabled={isEdit}
                  onClick={() => setMode('together')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${mode === 'together' ? 'bg-github-btn text-github-text shadow-sm' : 'text-github-muted hover:text-github-text'} ${isEdit ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <Users size={16} /> 같이 하기
                </button>
              </div>

              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={(e) => updateForm('name', e.target.value)}
                  className="flex-1 bg-github-card border border-github-border rounded-lg h-10 px-4 text-github-text focus:outline-none focus:border-github-accent placeholder-github-muted"
                  placeholder="예: 물 마시기, 러닝하기"
                  required
                />
              </div>
              
              {/* 색상 선택 영역 개선: 균등 배치 및 잘림 방지 */}
              <div className="flex justify-between items-center py-2 px-1">
                {COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => updateForm('color', color)}
                    className={`w-8 h-8 rounded-full flex-shrink-0 transition-all ${color} ${
                      formData.color === color 
                        ? 'ring-2 ring-white ring-offset-2 ring-offset-github-bg scale-110 z-10' 
                        : 'opacity-70 hover:opacity-100 hover:scale-105'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Together Mode: Invites */}
            {mode === 'together' && (
              <div className="space-y-3 bg-github-card/50 p-4 rounded-lg border border-github-border border-dashed">
                <label className="block text-sm font-semibold text-github-text">친구 초대하기</label>
                <div className="flex gap-2">
                  <input 
                    type="email"
                    value={newInvitee}
                    onChange={(e) => setNewInvitee(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addInvitee())}
                    placeholder="친구 이메일 입력"
                    className="flex-1 bg-github-bg border border-github-border rounded-lg h-10 px-3 text-sm focus:outline-none focus:border-github-accent"
                  />
                  <button 
                    type="button"
                    onClick={addInvitee}
                    className="px-3 bg-github-btn border border-github-border rounded-lg hover:bg-github-btnHover"
                  >
                    <Plus size={18} />
                  </button>
                </div>
                {invitees.length > 0 && (
                  <ul className="space-y-2 max-h-24 overflow-y-auto">
                    {invitees.map(email => (
                      <li key={email} className="flex justify-between items-center bg-github-bg px-3 py-2 rounded text-sm">
                        <span>{email}</span>
                        <button type="button" onClick={() => removeInvitee(email)} className="text-github-muted hover:text-red-400">
                          <Trash2 size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {invitees.length === 0 && <p className="text-xs text-github-muted">함께할 친구의 이메일을 추가해주세요.</p>}
              </div>
            )}

            {/* 2. Type */}
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-github-text">유형</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => updateForm('type', 'do')}
                  className={`p-3 rounded-lg border text-sm font-medium transition-all ${formData.type === 'do' ? 'bg-github-accent/20 border-github-accent text-github-accent' : 'bg-github-card border-github-border text-github-muted hover:border-github-muted'}`}
                >
                  잘 하기 (Do)
                  <div className="text-xs opacity-70 mt-1 font-normal">꾸준히 실행하는 습관</div>
                </button>
                <button
                  type="button"
                  onClick={() => updateForm('type', 'dont')}
                  className={`p-3 rounded-lg border text-sm font-medium transition-all ${formData.type === 'dont' ? 'bg-red-500/20 border-red-500 text-red-400' : 'bg-github-card border-github-border text-github-muted hover:border-github-muted'}`}
                >
                  안 하기 (Don't)
                  <div className="text-xs opacity-70 mt-1 font-normal">줄이거나 끊는 습관</div>
                </button>
              </div>
            </div>

            {/* 3. Goal & Frequency */}
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-github-text">목표 및 주기</label>
              <div className="bg-github-card border border-github-border rounded-lg p-4 space-y-4">
                
                {/* Amount */}
                <div className="flex items-center gap-3">
                  <span className="text-sm text-github-muted">하루에</span>
                  <input 
                    type="number" 
                    min="1"
                    value={formData.goal}
                    onChange={(e) => updateForm('goal', parseInt(e.target.value))}
                    className="w-16 bg-github-bg border border-github-border rounded h-8 text-center text-github-text"
                  />
                  <input 
                    type="text" 
                    value={formData.unit}
                    onChange={(e) => updateForm('unit', e.target.value)}
                    className="w-20 bg-github-bg border border-github-border rounded h-8 px-2 text-center text-github-text placeholder-github-muted"
                    placeholder="단위"
                  />
                  <span className="text-sm text-github-muted">{formData.type === 'do' ? '이상 하기' : '이하로 하기'}</span>
                </div>

                <div className="h-px bg-github-border" />

                {/* Frequency Type */}
                <div className="flex gap-2">
                   {[
                      { id: 'daily', label: '매일' },
                      { id: 'specific_days', label: '특정 요일' },
                      { id: 'weekly_count', label: '주 n회' }
                   ].map(opt => (
                     <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                           updateForm('frequency', { type: opt.id, days: [], value: 1 });
                        }}
                        className={`flex-1 py-1.5 text-xs rounded border transition-colors ${formData.frequency?.type === opt.id ? 'bg-github-text text-github-bg border-github-text font-bold' : 'border-github-border text-github-muted hover:text-github-text'}`}
                     >
                        {opt.label}
                     </button>
                   ))}
                </div>

                {/* Specific Days Selector */}
                {formData.frequency?.type === 'specific_days' && (
                  <div className="flex justify-between pt-2">
                    {DAYS.map((day, idx) => {
                      const isSelected = formData.frequency?.days?.includes(idx);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => handleDayToggle(idx)}
                          className={`w-9 h-9 rounded-full text-sm font-medium transition-all ${isSelected ? 'bg-github-success text-white' : 'bg-github-btn text-github-muted hover:bg-github-btnHover'}`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Weekly Count Selector */}
                {formData.frequency?.type === 'weekly_count' && (
                  <div className="flex items-center justify-center gap-4 pt-2">
                    <span className="text-sm text-github-muted">일주일에</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button" 
                        onClick={() => updateFrequency('value', Math.max(1, (formData.frequency?.value || 1) - 1))}
                        className="w-8 h-8 rounded bg-github-btn text-github-text hover:bg-github-btnHover"
                      >-</button>
                      <span className="text-lg font-bold text-github-text w-6 text-center">{formData.frequency?.value || 1}</span>
                      <button 
                        type="button"
                        onClick={() => updateFrequency('value', Math.min(7, (formData.frequency?.value || 1) + 1))}
                        className="w-8 h-8 rounded bg-github-btn text-github-text hover:bg-github-btnHover"
                      >+</button>
                    </div>
                    <span className="text-sm text-github-muted">번 실행</span>
                  </div>
                )}
              </div>
            </div>

          </form>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-github-border bg-github-card flex justify-end">
          <button 
            form="habit-form"
            type="submit"
            className="px-6 py-2.5 rounded-lg bg-github-success text-white font-bold hover:bg-github-successHover flex items-center gap-2 transition-colors shadow-sm"
          >
            <CheckCircle2 size={18}/> {isEdit ? '수정 저장' : '습관 생성'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default HabitForm;