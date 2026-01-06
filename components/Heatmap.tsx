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

  // --- Configuration ---
  const CELL_SIZE = 10;   // px
  const GAP = 3;          // px
  const HEADER_HEIGHT = 14; // px (Height of W1, W5 text row)
  const HEADER_MB = 4;    // px (Margin bottom of header row)
  
  // --- Data Logic ---
  const { weeks, weekLabels } = useMemo(() => {
    const creationDate = habit.createdAt ? new Date(habit.createdAt) : new Date();
    const startDate = new Date(creationDate);
    startDate.setHours(0, 0, 0, 0);
    // Align to Sunday
    const dayOfStart = startDate.getDay();
    startDate.setDate(startDate.getDate() - dayOfStart);

    const weeksArr = [];
    // 히트맵 격자는 1년 전체를 보여주기 위해 53주로 설정
    const totalWeeks = 53; 
    const cursor = new Date(startDate);
    const compareCreation = new Date(creationDate);
    compareCreation.setHours(0,0,0,0);

    for (let w = 0; w < totalWeeks; w++) {
      const currentWeek = [];
      for (let d = 0; d < 7; d++) {
        const year = cursor.getFullYear();
        const month = String(cursor.getMonth() + 1).padStart(2, '0');
        const day = String(cursor.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        
        const myStatus = myLogs[dateStr];
        const isBeforeCreation = cursor < compareCreation;

        let displayStatus: string = 'empty';

        if (!isBeforeCreation) {
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
          isVisible: !isBeforeCreation
        });
        
        cursor.setDate(cursor.getDate() + 1);
      }
      weeksArr.push(currentWeek);
    }

    const wLabels = weeksArr.map((_, index) => {
      const weekNum = index + 1;
      // 4주 간격으로 라벨 표시하되, 사용자의 요청대로 W49까지만 출력 (W53 등 제외)
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
      
      {/* 1. Y-Axis Column (Fixed) */}
      <div className="flex flex-col flex-shrink-0" style={{ marginRight: GAP }}>
        {/* Spacer for Header Alignment */}
        <div style={{ height: HEADER_HEIGHT, marginBottom: HEADER_MB }} />
        
        {/* Days Labels */}
        {DAYS_EN.map((day, i) => (
           <div 
             key={i} 
             className="text-[9px] text-github-muted font-mono flex items-center justify-end leading-none"
             style={{ height: CELL_SIZE, marginBottom: GAP }}
           >
              {day}
           </div>
        ))}
      </div>

      {/* 2. X-Axis & Grid (Scrollable) */}
      <div className="overflow-x-auto custom-scrollbar">
         <div className="flex flex-col w-fit">
            
            {/* Row 1: X-Axis Labels (W1 ~ W49 까지만 표시) */}
            <div className="flex" style={{ height: HEADER_HEIGHT, marginBottom: HEADER_MB }}>
               {weekLabels.map((label, i) => (
                  <div 
                    key={i} 
                    className="text-[10px] text-github-muted text-left overflow-visible whitespace-nowrap leading-none"
                    style={{ width: CELL_SIZE, marginRight: GAP }}
                  >
                     {label.visible ? label.text : ''}
                  </div>
               ))}
            </div>

            {/* Row 2: The Grid (53 Weeks 전체 유지) */}
            <div className="flex">
               {weeks.map((week, wIndex) => (
                  <div key={wIndex} className="flex flex-col" style={{ marginRight: GAP }}>
                     {week.map((day) => (
                        <div
                           key={day.date}
                           className={`rounded-[2px] transition-all ${getCellClass(day.status, day.isVisible)}`}
                           title={`${day.date}`}
                           style={{ width: CELL_SIZE, height: CELL_SIZE, marginBottom: GAP }}
                        />
                     ))}
                  </div>
               ))}
            </div>
         </div>
      </div>
    </div>
  );
};

export default Heatmap;