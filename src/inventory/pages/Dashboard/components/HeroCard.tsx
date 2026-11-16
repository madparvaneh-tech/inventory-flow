import { Icon } from '../../../components/ui/Icon';
import { fmt } from '../../../lib/format';

interface HeroCardProps {
  totalValue: number;
  trendPercent: number;
}

export function HeroCard({ totalValue, trendPercent }: HeroCardProps) {
  return (
    <div className="relative rounded-hero bg-orange text-white p-5 overflow-hidden mb-3.5">
      <div className="absolute w-[200px] h-[200px] bg-white/10 rounded-full -top-20 -left-12" />
      <div className="absolute w-[140px] h-[140px] bg-white/[0.07] rounded-full -bottom-14 -right-8" />

      <div className="relative z-10">
        <div className="flex items-center gap-1.5 text-xs opacity-90 font-medium">
          <Icon name="box" size={14} />
          ارزش کل موجودی
        </div>
        <div className="text-[28px] font-extrabold mt-2 tracking-tight">
          {fmt(totalValue)}
          <small className="text-[13px] font-medium opacity-85 mr-1">ریال</small>
        </div>
        <div className="inline-flex items-center gap-1.5 mt-3.5 bg-white/20 px-3 py-1.5 rounded-[10px] text-[11px] font-semibold">
          <Icon name="arrow-up" size={12} />
          {trendPercent}% رشد این ماه
        </div>
      </div>
    </div>
  );
}
