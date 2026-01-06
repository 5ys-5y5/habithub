
import { User, Habit, HabitRecord, ApiResponse, SharedHabitData, Friend } from '../types';

const USERS_SPREADSHEET_ID = '1iB0mVJjWRgRC1VuaoWKPE43EZVdJuoGaJoo5sQZNeXM';
const RECORDS_SPREADSHEET_ID = '1iB0mVJjWRgRC1VuaoWKPE43EZVdJuoGaJoo5sQZNeXM';
const API_URL = 'https://script.google.com/macros/s/AKfycbxEJPmVrt_kNdI4xU9Y8OVi0vyRGI92NCERrCaWZKvBScT5HqWxAoIIVybfkjlC6ROD/exec';

const STORAGE_KEY_USERS = 'habithub_users';

// --- Simple Cache Implementation ---
let cachedRecords: HabitRecord[] | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 5000; // 5 seconds cache

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
    if (!response.ok) throw new Error(`Sheet access failed (${response.status})`);
    const text = await response.text();
    const match = text.match(/google\.visualization\.Query\.setResponse\((.*)\);/);
    if (!match) throw new Error("Failed to parse GVIZ response");
    
    const json = JSON.parse(match[1]);
    if (json.status !== 'ok') return [];
    
    const rows = json.table.rows;
    return rows.map((row: any) => {
        if (!row.c) return [];
        return row.c.map((cell: any) => cell?.v ?? null);
    });
  } catch (e) {
    return []; 
  }
};

const sendToGas = async (params: any): Promise<ApiResponse<any>> => {
  const apiUrl = getApiUrl();
  if (!apiUrl) return { status: 'skipped' };

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(params),
      redirect: 'follow',
    });
    
    if (!response.ok) return { status: 'error', message: `HTTP ${response.status}` };
    const text = await response.text();
    return JSON.parse(text);
  } catch (e) {
    return { status: 'error', message: String(e) };
  }
};

const invalidateCache = () => {
  cachedRecords = null;
  lastFetchTime = 0;
};

export const fetchUsers = async (): Promise<User[]> => {
  let remoteUsers: User[] = [];
  try {
    const rows = await fetchGvizData(USERS_SPREADSHEET_ID, 'users', 'select A, B');
    remoteUsers = rows.map(row => ({
      name: String(row[0] || ''),
      email: String(row[1] || '')
    })).filter(u => u.email && u.email !== 'null');
  } catch (e) {}
  return remoteUsers;
};

export const getAllRecords = async (forceRefresh = false): Promise<HabitRecord[]> => {
  const now = Date.now();
  if (!forceRefresh && cachedRecords && (now - lastFetchTime < CACHE_DURATION)) {
    return cachedRecords;
  }

  const rows = await fetchGvizData(RECORDS_SPREADSHEET_ID, 'records', 'select A, B, C, D');
  cachedRecords = parseRowsToRecords(rows);
  lastFetchTime = now;
  return cachedRecords;
};

export const fetchHabitRecords = async (userEmail: string): Promise<SharedHabitData[]> => {
  const targetEmail = userEmail.trim().toLowerCase();
  const allRecords = await getAllRecords();
  
  const myRecords = allRecords.filter(r => 
      r.email === targetEmail && 
      r.habit && 
      r.habit.recordStatus !== 'rejected' &&
      r.habit.recordStatus !== 'deleted' && 
      r.habit.recordStatus !== 'left'
  );

  return myRecords.map(myRecord => {
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

export const createUser = async (user: User): Promise<boolean> => {
  const result = await sendToGas({ action: 'create_user', name: user.name, email: user.email });
  return result.status === 'success' || result.status === 'skipped'; 
};

export const createHabit = async (creatorEmail: string, habit: Habit, invitees: string[]): Promise<ApiResponse<any>> => {
  invalidateCache();
  const sharedId = habit.mode === 'together' ? (habit.sharedId || crypto.randomUUID()) : undefined;
  const myHabitId = habit.id || `h-${Date.now()}`;

  const myHabit: Habit = {
    ...habit,
    id: myHabitId,
    sharedId,
    userEmail: creatorEmail,
    recordStatus: 'active',
    members: [creatorEmail, ...invitees]
  };
  
  const myResult = await saveHabitLog(creatorEmail, myHabitId, myHabit, {});
  if (myResult.status !== 'success') return myResult;

  if (habit.mode === 'together' && invitees.length > 0) {
    await Promise.all(invitees.map(inviteeEmail => {
      const inviteeHabitId = `h-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      const inviteeHabit: Habit = {
        ...habit,
        id: inviteeHabitId,
        sharedId,
        userEmail: inviteeEmail,
        recordStatus: 'invited', 
        members: [creatorEmail, ...invitees]
      };
      return saveHabitLog(inviteeEmail, inviteeHabitId, inviteeHabit, {});
    }));
  }
  return myResult;
};

export const deleteHabit = async (record: HabitRecord): Promise<ApiResponse<any>> => {
  invalidateCache();
  const newStatus = record.habit.mode === 'together' ? 'left' : 'deleted';
  const updatedHabit = { ...record.habit, recordStatus: newStatus as any };
  return await saveHabitLog(record.email, record.habit_id, updatedHabit, record.logs);
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

export const respondToInvite = async (record: HabitRecord, accept: boolean) => {
  invalidateCache();
  const newStatus = accept ? 'active' : 'rejected';
  const updatedHabit = { ...record.habit, recordStatus: newStatus as any };
  await saveHabitLog(record.email, record.habit_id, updatedHabit, record.logs);
  return updatedHabit;
};

export const fetchFriends = async (userEmail: string): Promise<Friend[]> => {
  const targetEmail = userEmail.trim().toLowerCase();
  let rows: any[] = [];
  try {
    const res = await sendToGas({ action: 'get_friends' });
    if (res.status === 'success' && Array.isArray(res.data)) {
      rows = res.data;
      if (rows.length > 0 && (String(rows[0][0]).includes('requester') || String(rows[0][0]).includes('요청자'))) {
          rows = rows.slice(1);
      }
    }
  } catch (e) {}

  if (rows.length === 0) {
    try {
      rows = await fetchGvizData(RECORDS_SPREADSHEET_ID, 'friends', 'select A, B, C, D');
    } catch(e) {}
  }

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
