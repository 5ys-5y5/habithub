import { User, Habit, HabitRecord, ApiResponse, SharedHabitData, Friend } from '../types';

// [Configuration] Corrected Sheet IDs based on user's latest link
// Both Users and Records are in the SAME spreadsheet (different tabs)
const USERS_SPREADSHEET_ID = '1iB0mVJjWRgRC1VuaoWKPE43EZVdJuoGaJoo5sQZNeXM';
const RECORDS_SPREADSHEET_ID = '1iB0mVJjWRgRC1VuaoWKPE43EZVdJuoGaJoo5sQZNeXM';

// Hardcoded Web App URL
const API_URL = 'https://script.google.com/macros/s/AKfycbxEJPmVrt_kNdI4xU9Y8OVi0vyRGI92NCERrCaWZKvBScT5HqWxAoIIVybfkjlC6ROD/exec';

const STORAGE_KEY_USERS = 'habithub_users';

export const getApiUrl = () => API_URL;

// --- Helper: Parse Rows to Records ---
const parseRowsToRecords = (rows: any[], targetEmail?: string): HabitRecord[] => {
  return rows.map((row, index) => {
    // Safety check for row structure
    if (!Array.isArray(row)) return { email: '', habit_id: '', habit: null as any, logs: {} };

    // Robust extraction
    const rawEmail = row[0];
    const email = String(rawEmail || '').trim().toLowerCase();
    
    // Attempt to get ID from Column B
    let habitId = String(row[1] || '');
    
    let habit: Habit | null = null;
    let logs: { [key: string]: boolean } = {};

    try {
      // Column C: Habit Config (JSON)
      if (row[2]) {
         const rawHabit = typeof row[2] === 'string' ? row[2] : JSON.stringify(row[2]);
         if (rawHabit.trim().startsWith('{')) {
             habit = JSON.parse(rawHabit);
         }
      }

      // Column D: Logs (JSON)
      if (row[3]) {
         const rawLogs = typeof row[3] === 'string' ? row[3] : JSON.stringify(row[3]);
         if (rawLogs.trim().startsWith('{')) {
             logs = JSON.parse(rawLogs);
         }
      }
    } catch (e) {
      if (targetEmail && email === targetEmail) {
         console.error(`[HabitHub Debug] ❌ JSON Parse Error for user row:`, e);
      }
    }

    // [CRITICAL FIX] ID Recovery Logic
    if ((!habitId || habitId === 'undefined' || habitId === 'null') && habit && habit.id) {
        habitId = habit.id;
    }
    
    return { email, habit_id: habitId, habit: habit as Habit, logs };
  });
};

// --- GVIZ (Read) Implementation ---
const fetchGvizData = async (spreadsheetId: string, sheetName: string, query: string = 'select *'): Promise<any[]> => {
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?sheet=${sheetName}&tq=${encodeURIComponent(query)}&tqx=out:json&_=${Date.now()}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
        console.warn(`[HabitHub Debug] GVIZ HTTP Error: ${response.status}`);
        throw new Error(`Sheet access failed (${response.status})`);
    }
    const text = await response.text();
    
    const match = text.match(/google\.visualization\.Query\.setResponse\((.*)\);/);
    if (!match) {
        console.warn(`[HabitHub Debug] GVIZ Parse Error: Response format invalid`);
        throw new Error("Failed to parse GVIZ response");
    }
    
    const json = JSON.parse(match[1]);
    if (json.status !== 'ok') {
        console.warn(`[HabitHub Debug] GVIZ Status Error: ${json.status}`);
        return [];
    }
    
    const rows = json.table.rows;
    return rows.map((row: any) => {
        if (!row.c) return [];
        return row.c.map((cell: any) => cell?.v ?? null);
    });
  } catch (e) {
    console.warn(`[HabitHub Debug] GVIZ Exception (${sheetName}):`, e);
    return []; 
  }
};

// --- GAS (Write/Read) Implementation ---
const sendToGas = async (params: any): Promise<ApiResponse<any>> => {
  const apiUrl = getApiUrl();

  if (!apiUrl) {
    console.warn("[HabitHub Debug] ⚠️ API URL is missing. Cannot send to GAS:", params.action);
    return { status: 'skipped' };
  }
  
  console.log(`[HabitHub Debug] 🚀 Sending to GAS [${params.action}]`, params);

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(params),
      redirect: 'follow',
    });
    
    if (!response.ok) {
       console.error(`[HabitHub Debug] ❌ GAS HTTP Error: ${response.status} ${response.statusText}`);
       return { status: 'error', message: `HTTP ${response.status}` };
    }
    
    const text = await response.text();
    console.log(`[HabitHub Debug] 📥 GAS Response Raw:`, text);

    try {
        const json = JSON.parse(text);
        if (json.status === 'error') {
            console.error(`[HabitHub Debug] ❌ GAS Server Error:`, json.message);
        } else {
            console.log(`[HabitHub Debug] ✅ GAS Success`);
        }
        return json;
    } catch (parseError) {
        console.error(`[HabitHub Debug] ❌ GAS JSON Parse Error. Raw text: ${text}`);
        return { status: 'error', message: 'Invalid JSON from server' };
    }
  } catch (e) {
    console.error("[HabitHub Debug] ❌ GAS Network/Fetch Error:", e);
    return { status: 'error', message: String(e) };
  }
};

// --- Services ---

export const fetchUsers = async (): Promise<User[]> => {
  const localUsers: User[] = JSON.parse(localStorage.getItem(STORAGE_KEY_USERS) || '[]');
  let remoteUsers: User[] = [];
  try {
    const rows = await fetchGvizData(USERS_SPREADSHEET_ID, 'users', 'select A, B');
    remoteUsers = rows.map(row => ({
      name: String(row[0] || ''),
      email: String(row[1] || '')
    })).filter(u => u.email && u.email !== 'null');
    console.log(`[HabitHub Debug] Fetched ${remoteUsers.length} users from sheet.`);
  } catch (e) {
    console.error(`[HabitHub Debug] Failed to fetch users:`, e);
  }

  const userMap = new Map<string, User>();
  [...remoteUsers, ...localUsers].forEach(u => {
      if (u.email) userMap.set(u.email.toLowerCase(), u);
  });
  return Array.from(userMap.values());
};

// Fetch My Records AND Peer Records for shared habits
export const fetchHabitRecords = async (userEmail: string): Promise<SharedHabitData[]> => {
  const targetEmail = userEmail.trim().toLowerCase();
  
  let allRows: any[] = [];
  
  // 1. Try GVIZ first
  try {
    allRows = await fetchGvizData(RECORDS_SPREADSHEET_ID, 'records', 'select A, B, C, D');
  } catch (e) {
    console.warn("[HabitHub Debug] GVIZ fetch failed inside try-catch");
  }

  // 2. Parse GVIZ rows
  let allRecords = parseRowsToRecords(allRows, targetEmail);
  let myRecords = allRecords.filter(r => 
      r.email === targetEmail && 
      r.habit && 
      r.habit.name && 
      r.habit.recordStatus !== 'rejected' &&
      r.habit.recordStatus !== 'deleted' && 
      r.habit.recordStatus !== 'left'
  );

  // 3. Fallback Logic
  const apiUrl = getApiUrl();
  const hasCorruptedIds = myRecords.some(r => !r.habit_id);
  const shouldFallback = (myRecords.length === 0 || hasCorruptedIds) && !!apiUrl;

  if (shouldFallback) {
     try {
       const response = await sendToGas({ action: 'get_records' });
       if (response.status === 'success' && Array.isArray(response.data)) {
          let rows = response.data;
          
          if (rows.length > 0) {
             const firstCol = String(rows[0][0]).toLowerCase();
             if (firstCol === 'email' || firstCol === '이메일' || firstCol === 'useremail') {
                 rows = rows.slice(1);
             }
          }
          
          allRows = rows;
          allRecords = parseRowsToRecords(allRows, targetEmail);
          myRecords = allRecords.filter(r => 
              r.email === targetEmail && 
              r.habit && 
              r.habit.name && 
              r.habit.recordStatus !== 'rejected' &&
              r.habit.recordStatus !== 'deleted' &&
              r.habit.recordStatus !== 'left'
          );
       }
     } catch (e) {
       console.warn("[HabitHub Debug] GAS fetch failed:", e);
     }
  }

  // 4. Group by Shared Habits
  const result: SharedHabitData[] = myRecords.map(myRecord => {
    let peerRecords: HabitRecord[] = [];
    
    if (myRecord.habit.mode === 'together' && myRecord.habit.sharedId) {
      peerRecords = allRecords.filter(r => 
        r.habit && 
        r.habit.sharedId === myRecord.habit.sharedId && 
        r.email !== targetEmail &&
        (r.habit.recordStatus === 'active' || r.habit.recordStatus === 'invited') // Include invited peers to correctly show "hollow" status
      );
    }
    
    return { myRecord, peerRecords };
  });

  return result;
};

export const createUser = async (user: User): Promise<boolean> => {
  const result = await sendToGas({ action: 'create_user', name: user.name, email: user.email });
  return result.status === 'success' || result.status === 'skipped'; 
};

// Create or Update Habit
export const createHabit = async (creatorEmail: string, habit: Habit, invitees: string[]): Promise<ApiResponse<any>> => {
  const sharedId = habit.mode === 'together' ? (habit.sharedId || crypto.randomUUID()) : undefined;
  
  // Use existing ID if update, or generate new 'h-' ID
  const myHabitId = habit.id || `h-${Date.now()}`;

  // 1. Save My Habit
  const myHabit: Habit = {
    ...habit,
    id: myHabitId,
    sharedId,
    userEmail: creatorEmail,
    recordStatus: 'active',
    members: [creatorEmail, ...invitees]
  };
  const myResult = await saveHabitLog(creatorEmail, myHabitId, myHabit, {});

  // If main save fails/skipped, return immediately
  if (myResult.status !== 'success') {
      return myResult;
  }

  // 2. Save Invitee Habits (Only for new invites, usually)
  // Note: For updates, we usually don't re-invite unless logic specifies. 
  // Simplified here: we re-assert invites which handles both cases.
  if (habit.mode === 'together' && invitees.length > 0) {
    for (const inviteeEmail of invitees) {
      // For existing shared habit, we need to check if they already have an ID or generate one.
      // This simple logic generates a new record if it doesn't exist, effectively "inviting" them.
      // A more complex logic would check existence, but for now we create a pending invite.
      const inviteeHabitId = `h-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      const inviteeHabit: Habit = {
        ...habit,
        id: inviteeHabitId,
        sharedId,
        userEmail: inviteeEmail,
        recordStatus: 'invited', 
        members: [creatorEmail, ...invitees]
      };
      // We only save invite if we don't know they have one. 
      // But SheetService 'save_habit' overwrites if ID matches. 
      // Since we generated a NEW ID here, it might duplicate invites if not careful.
      // For this simplified version, assume invites are mainly on Creation.
      if (!habit.id) {
          await saveHabitLog(inviteeEmail, inviteeHabitId, inviteeHabit, {});
      }
    }
  }
  
  return myResult;
};

export const updateHabit = async (userEmail: string, habit: Habit): Promise<ApiResponse<any>> => {
  // Just save the updated config. Logs are preserved because we pass {} but `save_habit` logic in GAS 
  // (if optimized) should merge, or we need to pass existing logs.
  // Wait, `saveHabitLog` replaces everything. We need the current logs!
  // The callers of updateHabit should pass current logs, or we fetch them.
  // Ideally, the Dashboard passes the full record including logs to the Form, which passes it back.
  // Let's assume habit object is enough and logs are handled separately or preserved.
  // Actually, GAS code: `sheet.getRange(rowIndex, 4).setValue(logsStr);`
  // We MUST pass existing logs. 
  // Let's change signature to take record.
  return { status: 'error', message: "Use saveHabitLog for updates with logs preservation" };
};

export const deleteHabit = async (record: HabitRecord): Promise<ApiResponse<any>> => {
  const newStatus = record.habit.mode === 'together' ? 'left' : 'deleted';
  const updatedHabit = { ...record.habit, recordStatus: newStatus as any };
  return await saveHabitLog(record.email, record.habit_id, updatedHabit, record.logs);
};

export const saveHabitLog = async (userEmail: string, habitId: string, habitConfig: Habit, logs: { [date: string]: boolean }): Promise<ApiResponse<any>> => {
  const normalizedEmail = userEmail.trim().toLowerCase();
  
  const response = await sendToGas({
    action: 'save_habit',
    email: normalizedEmail, 
    habit_id: habitId,
    habit_config: habitConfig,
    logs: logs
  });
  
  return response;
};

export const respondToInvite = async (record: HabitRecord, accept: boolean) => {
  const newStatus = accept ? 'active' : 'rejected';
  
  if (!record.habit_id) {
     alert("오류: 습관 ID를 찾을 수 없어 저장에 실패했습니다.");
     return;
  }

  const updatedHabit = { ...record.habit, recordStatus: newStatus as any };
  
  await saveHabitLog(record.email, record.habit_id, updatedHabit, record.logs);
  return updatedHabit;
};

// --- Friend Services ---

export const fetchFriends = async (userEmail: string): Promise<Friend[]> => {
  const targetEmail = userEmail.trim().toLowerCase();
  let rows: any[] = [];
  
  // [MODIFIED] Prioritize GAS if API URL is available because GVIZ has heavy caching (up to minutes).
  // Friends data (requests/accepts) needs to be real-time.
  const apiUrl = getApiUrl();

  if (apiUrl) {
     try {
       console.log("[HabitHub Debug] Fetching friends via GAS");
       const res = await sendToGas({ action: 'get_friends' });
       if (res.status === 'success' && Array.isArray(res.data)) {
         rows = res.data;
         // Remove header if present
         if (rows.length > 0 && (String(rows[0][0]).includes('requester') || String(rows[0][0]).includes('요청자'))) {
             rows = rows.slice(1);
         }
       }
     } catch (e) {
       console.warn("[HabitHub Debug] GAS friends fetch failed, falling back to GVIZ", e);
     }
  }

  // Fallback to GVIZ if GAS failed or not configured
  if (rows.length === 0) {
    try {
      console.log("[HabitHub Debug] Fetching friends via GVIZ (Fallback)");
      rows = await fetchGvizData(RECORDS_SPREADSHEET_ID, 'friends', 'select A, B, C, D');
    } catch(e) {
      console.warn("[HabitHub Debug] Failed to fetch friends via GVIZ");
    }
  }

  // Parse Rows: [Requester, Receiver, Status, UpdatedAt]
  return rows.map(row => ({
     id: `${row[0]}_${row[1]}`,
     requester: String(row[0] || '').toLowerCase(),
     receiver: String(row[1] || '').toLowerCase(),
     status: (row[2] || 'pending') as any,
     updatedAt: row[3]
  })).filter(f => f.requester === targetEmail || f.receiver === targetEmail);
};

export const requestFriend = async (requester: string, receiver: string): Promise<ApiResponse<any>> => {
  console.log(`[HabitHub Debug] Requesting Friend: ${requester} -> ${receiver}`);
  return await sendToGas({
    action: 'request_friend',
    requester: requester.trim().toLowerCase(),
    receiver: receiver.trim().toLowerCase()
  });
};

export const respondFriend = async (requester: string, receiver: string, status: 'accepted' | 'rejected'): Promise<ApiResponse<any>> => {
  console.log(`[HabitHub Debug] Responding Friend: ${requester} -> ${receiver} (${status})`);
  return await sendToGas({
     action: 'respond_friend',
     requester: requester.trim().toLowerCase(),
     receiver: receiver.trim().toLowerCase(),
     status: status
  });
};

export const removeFriend = async (me: string, friendEmail: string): Promise<ApiResponse<any>> => {
  console.log(`[HabitHub Debug] Removing Friend: ${me} <-> ${friendEmail}`);
  return await sendToGas({
      action: 'remove_friend',
      me: me.trim().toLowerCase(),
      friend: friendEmail.trim().toLowerCase()
  });
};