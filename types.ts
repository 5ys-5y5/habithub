export interface User {
  name: string;
  email: string;
}

// Frequency Configuration
export interface Frequency {
  type: 'daily' | 'specific_days' | 'weekly_count';
  days?: number[]; // 0(Sun) - 6(Sat) for 'specific_days'
  value?: number; // count for 'weekly_count'
}

export interface Habit {
  id: string; // Unique ID per user's record
  sharedId?: string; // UUID shared across all participants in a "Together" habit
  userEmail: string;
  name: string;
  color: string;
  type: 'do' | 'dont'; 
  goal: number; 
  unit: string; 
  frequency: Frequency;
  createdAt: string;
  
  // Together Mode Fields
  mode?: 'personal' | 'together';
  members?: string[]; // List of emails
  recordStatus?: 'active' | 'invited' | 'rejected' | 'deleted' | 'left'; // Status of this specific user's participation
}

// Data structure
export interface HabitRecord {
  email: string;
  habit_id: string;
  habit: Habit; 
  logs: { [date: string]: boolean }; 
}

// Helper to group peer records
export interface SharedHabitData {
  myRecord: HabitRecord;
  peerRecords: HabitRecord[];
}

export interface ApiResponse<T> {
  status: 'success' | 'error' | 'skipped';
  data?: T;
  message?: string;
}

// Friend System
export interface Friend {
  id: string; // unique string (e.g., combined emails)
  requester: string;
  receiver: string;
  status: 'pending' | 'accepted' | 'rejected';
  updatedAt: string;
}

export interface FriendStats {
  email: string;
  name: string; // approximate from email if not available
  habits: {
    name: string;
    type: 'do' | 'dont';
    completionRate: number; // 0-100
  }[];
}