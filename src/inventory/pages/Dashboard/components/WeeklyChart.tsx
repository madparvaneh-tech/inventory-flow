interface WeeklyChartProps {
  data: number[]; // 7 روز (شنبه تا جمعه)
  averageLabel: string;
}

const DAY_LABELS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

export function WeeklyChart({ data, averageLabel }: WeeklyChartProps) {
  const max = Math.max(...data, 1);
  const todayIndex = new Date().getDay(); // 0=یکشنبه
  // تبدیل: شنبه=6، یکشنبه=0 ... → اندیس ۰ تا ۶ با شروع شنبه
  const todayDayIdx = (todayIndex + 1) % 7;

  return (
    <div className="bg-surface-light dark:bg-surface-dark border border-black/5 dark:border-cream/10 rounded-card-lg p-[18px] shadow-card mb-3.5">
      <div className="flex justify-between items-center mb-4">
        <div className="text-[13px] font-bold text-ink dark:text-cream">گردش هفتگی</div>
        <div className="text-[11px] text-muted-light dark:text-muted-dark">{averageLabel}</div>
      </div>
      <div className="flex items-end gap-2.5 h-[90px]">
        {data.map((value, i) => {
          const height = (value / max) * 100;
          const isToday = i === todayDayIdx;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
              <div
                className={`w-full rounded-md transition-all ${isToday ? 'bg-orange' : 'bg-orange-soft'}`}
                style={{ height: `${Math.max(height, 8)}%` }}
              />
              <span className="text-[10px] text-muted-light dark:text-muted-dark font-medium">
                {DAY_LABELS[i]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
