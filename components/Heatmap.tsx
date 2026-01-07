
import React, { useMemo } from 'react';
import { HabitRecord } from '../types';

interface HeatmapProps {
  myRecord: HabitRecord;
  peerRecords?: HabitRecord[];
  rangeDays?: number;
}

const Heatmap: React.FC<HeatmapProps> = ({ myRecord, peerRecords = [], rangeDays = 365 }) => {
  const { habit, logs: myLogs } = myRecord;
  const isTogether = habit.mode === 'together';

  const CELL_SIZE = 10;   // px
  const GAP = 3;          // px
  const HEADER_HEIGHT = 14; 
  const HEADER_MB = 3;    // Changed to 3px as requested

  // Calculate today's string for highlighting
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  
  const { weeks, weekLabels } = useMemo(() => {
    const logDates = Object.keys(myLogs).map(d => new Date(d).getTime());
    const creationTime = habit.createdAt ? new Date(habit.createdAt).getTime() : Date.now();
    
    // actualMinDate should be the start of the day (00:00:00)
    const minTimestamp = Math.min(creationTime, ...logDates);
    const actualMinDate = new Date(minTimestamp);
    actualMinDate.setHours(0, 0, 0, 0);

    const startDate = new Date(actualMinDate);
    const dayOfStart = startDate.getDay();
    startDate.setDate(startDate.getDate() - dayOfStart);

    const weeksArr = [];
    const totalWeeks = 53; 
    const cursor = new Date(startDate);
    cursor.setHours(0, 0, 0, 0);

    for (let w = 0; w < totalWeeks; w++) {
      const currentWeek = [];
      for (let d = 0; d < 7; d++) {
        const year = cursor.getFullYear();
        const month = String(cursor.getMonth() + 1).padStart(2, '0');
        const day = String(cursor.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        
        const myStatus = myLogs[dateStr];
        
        // Hide if before the actual creation or first log day
        const isVisible = cursor.getTime() >= actualMinDate.getTime();

        let displayStatus: string = 'empty';

        if (isVisible) {
          if (myStatus === false) {
             displayStatus = 'solid-red';
          } else if (myStatus === true) {
             if (isTogether) {
                const allPeersDone = peerRecords.every(p => p.logs[dateStr] === true);
                displayStatus = allPeersDone ? 'solid-green' : 'hollow-green';
             } else {
                displayStatus = 'solid-green';
             }
          } else {
             if (isTogether) {
                const anyPeerDone = peerRecords.some(p => p.logs[dateStr] === true);
                if (anyPeerDone) {
                   displayStatus = 'hollow-red';
                } else {
                   displayStatus = 'empty';
                }
             } else {
                displayStatus = 'empty';
             }
          }
        }

        currentWeek.push({
          date: dateStr,
          status: displayStatus,
          isVisible: isVisible
        });
        
        cursor.setDate(cursor.getDate() + 1);
      }
      weeksArr.push(currentWeek);
    }

    const wLabels = weeksArr.map((_, index) => {
      const weekNum = index + 1;
      if ((index === 0 || index % 4 === 0) && weekNum <= 49) {
        return { text: `W${weekNum}`, visible: true };
      }
      return { text: '', visible: false };
    });

    return { weeks: weeksArr, weekLabels: wLabels };
  }, [habit.createdAt, myLogs, peerRecords, isTogether]);

  const getCellClass = (status: string, isVisible: boolean) => {
    if (!isVisible) return 'bg-transparent';
    switch (status) {
      case 'solid-green': return 'bg-[#238636]'; 
      case 'hollow-green': return 'bg-transparent border-[1.5px] border-[#238636] box-border'; 
      case 'solid-red': return 'bg-red-500';
      case 'hollow-red': return 'bg-transparent border-[1.5px] border-red-500 box-border';
      case 'empty': default: return 'bg-[#21262d]'; 
    }
  };

  const DAYS_EN = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  return (
    <div className="flex">
      <div className="flex flex-col flex-shrink-0 pt-[2px]" style={{ marginRight: GAP }}>
        <div style={{ height: HEADER_HEIGHT, marginBottom: HEADER_MB }} />
        {DAYS_EN.map((day, i) => (
           <div key={i} className="text-[9px] text-github-muted font-mono flex items-center justify-end leading-none" style={{ height: CELL_SIZE, marginBottom: GAP }}>{day}</div>
        ))}
      </div>

      <div className="overflow-x-auto custom-scrollbar">
         <div className="flex flex-col w-fit p-[2px]">
            <div className="flex" style={{ height: HEADER_HEIGHT, marginBottom: HEADER_MB }}>
               {weekLabels.map((label, i) => (
                  <div key={i} className="text-[10px] text-github-muted text-left overflow-visible whitespace-nowrap leading-none" style={{ width: CELL_SIZE, marginRight: GAP }}>{label.visible ? label.text : ''}</div>
               ))}
            </div>
            <div className="flex">
               {weeks.map((week, wIndex) => (
                  <div key={wIndex} className="flex flex-col" style={{ marginRight: GAP }}>
                     {week.map((day) => {
                        const isToday = day.date === todayStr;
                        return (
                          <div 
                            key={day.date} 
                            className={`rounded-[2px] transition-all ${getCellClass(day.status, day.isVisible)} ${isToday && day.isVisible ? 'ring-1 ring-blue-500 ring-offset-1 ring-offset-github-card z-10' : ''}`} 
                            title={`${day.date}${isToday ? ' (Today)' : ''}`} 
                            style={{ width: CELL_SIZE, height: CELL_SIZE, marginBottom: GAP }} 
                          />
                        );
                     })}
                  </div>
               ))}
            </div>
         </div>
      </div>
    </div>
  );
};

export default Heatmap;
