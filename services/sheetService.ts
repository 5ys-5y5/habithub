
import { User, Habit, HabitRecord, ApiResponse, SharedHabitData, Friend } from '../types';

const USERS_SPREADSHEET_ID = '1iB0mVJjWRgRC1VuaoWKPE43EZVdJuoGaJoo5sQZNeXM';
const RECORDS_SPREADSHEET_ID = '1iB0mVJjWRgRC1VuaoWKPE43EZVdJuoGaJoo5sQZNeXM';
const API_URL = 'https://script.google.com/macros/s/AKfycbxEJPmVrt_kNdI4xU9Y8OVi0vyRGI92NCERrCaWZKvBScT5HqWxAoIIVybfkjlC6ROD/exec';

// --- Cache ---
let cachedRecords: HabitRecord[] | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 5000;

export const getApiUrl = () => API_URL;

const parseRowsToRecords = (rows: any[]): HabitRecord[] => {
  return rows.map((row) => {
    if (!Array.isArray(row)) return { email: '', habit_id: '', habit: null as any, logs: {} };

    const email = String(row[0] || '').trim().toLowerCase();
    let habitId = String(row[1] || '');
    let habit: Habit | null = null;
    let logs: { [key: string]: boolean } = {};

    try {
      if (row[2]) {
         const rawHabit = typeof row[2] === 'string' ? row[2] : JSON.stringify(row[2]);
         if (rawHabit.trim().startsWith('{')) habit = JSON.parse(rawHabit);
      }
      if (row[3]) {
         const rawLogs = typeof row[3] === 'string' ? row[3] : JSON.stringify(row[3]);
         if (rawLogs.trim().startsWith('{')) logs = JSON.parse(rawLogs);
      }
    } catch (e) {}

    if ((!habitId || habitId === 'undefined' || habitId === 'null') && habit && habit.id) {
        habitId = habit.id;
    }
    
    return { email, habit_id: habitId, habit: habit as Habit, logs };
  });
};

const fetchGvizData = async (spreadsheetId: string, sheetName: string, query: string = 'select *'): Promise<any[]> => {
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?sheet=${sheetName}&tq=${encodeURIComponent(query)}&tqx=out:json&_=${Date.now()}`;
  try {
    const response = await fetch(url);
    const text = await response.text();
    const match = text.match(/google\.visualization\.Query\.setResponse\((.*)\);/);
    if (!match) return [];
    const json = JSON.parse(match[1]);
    if (json.status !== 'ok') return [];
    return json.table.rows.map((row: any) => row.c ? row.c.map((cell: any) => cell?.v ?? null) : []);
  } catch (e) { return []; }
};

const sendToGas = async (params: any): Promise<ApiResponse<any>> => {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(params),
      redirect: 'follow',
    });
    const text = await response.text();
    return JSON.parse(text);
  } catch (e) { return { status: 'error', message: String(e) }; }
};

export const invalidateCache = () => { cachedRecords = null; lastFetchTime = 0; };

export const getAllRecords = async (forceRefresh = false): Promise<HabitRecord[]> => {
  const now = Date.now();
  if (!forceRefresh && cachedRecords && (now - lastFetchTime < CACHE_DURATION)) return cachedRecords;
  const rows = await fetchGvizData(RECORDS_SPREADSHEET_ID, 'records', 'select A, B, C, D');
  cachedRecords = parseRowsToRecords(rows);
  lastFetchTime = now;
  return cachedRecords;
};

export const fetchHabitRecords = async (userEmail: string): Promise<SharedHabitData[]> => {
  if (!userEmail) return [];
  const targetEmail = userEmail.trim().toLowerCase();
  const allRecords = await getAllRecords(true);
  
  // 1. 시트에 존재하는 내 모든 레코드를 필터링 없이 가져옵니다.
  // (과거의 탈퇴/거절 기록까지 포함하여 이력을 확인하기 위함)
  const myExistingRecords = allRecords.filter(r => r.email === targetEmail && r.habit);

  // 2. 사용자가 이미 가지고 있는 sharedId 목록 (상태와 무관하게 모든 참여 이력)
  const myInvolvedSharedIds = new Set(
    myExistingRecords
      .filter(r => r.habit.sharedId)
      .map(r => r.habit.sharedId)
  );

  // 3. 추론형 초대 감지: 내 레코드는 없지만, 타인의 members 리스트에 내가 포함된 공유 습관 찾기
  const allPotentialSharedHabits = allRecords.filter(r => 
    r.habit && 
    r.habit.mode === 'together' && 
    r.habit.members?.some(m => m.toLowerCase() === targetEmail)
  );

  const finalRecords: HabitRecord[] = [...myExistingRecords];

  // 4. 내가 참여한 적이 없는(시트에 레코드가 없는) 새로운 공유 습관들만 가상 초대 생성
  allPotentialSharedHabits.forEach(remoteRecord => {
    const sId = remoteRecord.habit.sharedId;
    if (sId && !myInvolvedSharedIds.has(sId)) {
      finalRecords.push({
        email: targetEmail,
        habit_id: `invited-${sId}`,
        habit: {
          ...remoteRecord.habit,
          userEmail: targetEmail,
          recordStatus: 'invited' 
        },
        logs: {}
      });
      myInvolvedSharedIds.add(sId); // 중복 방지
    }
  });

  // 5. UI에는 표시할 가치가 있는 것들만 전달 (active, invited)
  // 'left', 'rejected', 'deleted' 상태는 시트에는 남지만 UI 대시보드에서는 필터링됨
  const recordsToShow = finalRecords.filter(r => 
    r.habit && (r.habit.recordStatus === 'active' || r.habit.recordStatus === 'invited' || !r.habit.recordStatus)
  );

  return recordsToShow.map(myRecord => {
    let peerRecords: HabitRecord[] = [];
    if (myRecord.habit.mode === 'together' && myRecord.habit.sharedId) {
      peerRecords = allRecords.filter(r => 
        r.habit && 
        r.habit.sharedId === myRecord.habit.sharedId && 
        r.email !== targetEmail &&
        (r.habit.recordStatus === 'active' || r.habit.recordStatus === 'invited')
      );
    }
    return { myRecord, peerRecords };
  });
};

export const fetchUsers = async (): Promise<User[]> => {
  const rows = await fetchGvizData(USERS_SPREADSHEET_ID, 'users', 'select A, B');
  return rows.map(row => ({ name: String(row[0] || ''), email: String(row[1] || '') })).filter(u => u.email);
};

export const createUser = async (user: User): Promise<boolean> => {
  const result = await sendToGas({ action: 'create_user', name: user.name, email: user.email });
  return result.status === 'success' || result.status === 'skipped'; 
};

export const createHabit = async (creatorEmail: string, habit: Habit, invitees: string[], initialLogs: { [date: string]: boolean } = {}): Promise<ApiResponse<any>> => {
  invalidateCache();
  const sharedId = habit.mode === 'together' ? (habit.sharedId || crypto.randomUUID()) : undefined;
  const myHabitId = habit.id || `h-${Date.now()}`;
  const members = Array.from(new Set([creatorEmail.toLowerCase(), ...invitees.map(e => e.toLowerCase())]));

  const myHabit: Habit = {
    ...habit,
    id: myHabitId,
    sharedId,
    userEmail: creatorEmail.toLowerCase(),
    creatorEmail: creatorEmail.toLowerCase(), 
    recordStatus: 'active',
    members: members
  };
  
  const myResult = await saveHabitLog(creatorEmail, myHabitId, myHabit, initialLogs);
  if (myResult.status !== 'success') return myResult;

  if (habit.mode === 'together' && invitees.length > 0) {
    for (const inviteeEmail of invitees) {
      const inviteeHabitId = `h-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      const inviteeHabit: Habit = {
        ...habit,
        id: inviteeHabitId,
        sharedId,
        userEmail: inviteeEmail.toLowerCase(),
        creatorEmail: creatorEmail.toLowerCase(),
        recordStatus: 'invited', 
        members: members
      };
      await saveHabitLog(inviteeEmail, inviteeHabitId, inviteeHabit, {});
    }
  }
  invalidateCache();
  return myResult;
};

export const saveHabitLog = async (userEmail: string, habitId: string, habitConfig: Habit, logs: { [date: string]: boolean }): Promise<ApiResponse<any>> => {
  invalidateCache();
  return await sendToGas({
    action: 'save_habit',
    email: userEmail.trim().toLowerCase(), 
    habit_id: habitId,
    habit_config: habitConfig,
    logs: logs
  });
};

export const deleteHabit = async (record: HabitRecord): Promise<ApiResponse<any>> => {
  invalidateCache();
  const newStatus = record.habit.mode === 'together' ? 'left' : 'deleted';
  const updatedHabit: Habit = { ...record.habit, recordStatus: newStatus as any };
  // 시트에서 완전히 삭제하는 대신 상태를 업데이트하여 남겨둠 (재초대 방지 차단막)
  return await saveHabitLog(record.email, record.habit_id, updatedHabit, record.logs);
};

export const respondToInvite = async (record: HabitRecord, accept: boolean) => {
  invalidateCache();
  const newStatus = accept ? 'active' : 'rejected';
  // 만약 가상 레코드(invited-...)였다면 실제 새로운 ID를 부여하여 저장
  const actualHabitId = record.habit_id.startsWith('invited-') ? `h-${Date.now()}` : record.habit_id;
  const updatedHabit = { ...record.habit, id: actualHabitId, recordStatus: newStatus as any };
  await saveHabitLog(record.email, actualHabitId, updatedHabit, record.logs);
  invalidateCache();
  return updatedHabit;
};

export const fetchFriends = async (userEmail: string): Promise<Friend[]> => {
  const targetEmail = userEmail.trim().toLowerCase();
  const res = await sendToGas({ action: 'get_friends' });
  let rows = (res.status === 'success' && Array.isArray(res.data)) ? res.data : [];
  if (rows.length > 0 && (String(rows[0][0]).includes('requester'))) rows = rows.slice(1);
  return rows.map(row => ({
     id: `${row[0]}_${row[1]}`,
     requester: String(row[0] || '').toLowerCase(),
     receiver: String(row[1] || '').toLowerCase(),
     status: (row[2] || 'pending') as any,
     updatedAt: row[3]
  })).filter(f => f.requester === targetEmail || f.receiver === targetEmail);
};

export const requestFriend = async (requester: string, receiver: string): Promise<ApiResponse<any>> => {
  return await sendToGas({ action: 'request_friend', requester: requester.toLowerCase(), receiver: receiver.toLowerCase() });
};

export const respondFriend = async (requester: string, receiver: string, status: 'accepted' | 'rejected'): Promise<ApiResponse<any>> => {
  return await sendToGas({ action: 'respond_friend', requester: requester.toLowerCase(), receiver: receiver.toLowerCase(), status: status });
};

export const removeFriend = async (me: string, friendEmail: string): Promise<ApiResponse<any>> => {
  return await sendToGas({ action: 'remove_friend', me: me.toLowerCase(), friend: friendEmail.toLowerCase() });
};
