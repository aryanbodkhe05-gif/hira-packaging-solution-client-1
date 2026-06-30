import { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

interface Props {
  label: string;
  value: string | number;
  icon: LucideIcon;
  iconColor?: string;
  trend?: { value: string; positive?: boolean };
  mono?: boolean;
}

export function StatCard({ label, value, icon: Icon, iconColor = 'text-accent', trend, mono }: Props) {
  return (
    <div className="stat-card">
      <div className="flex items-start justify-between">
        <div className={cn('p-2 rounded-lg bg-white/5', iconColor.replace('text-', 'bg-').replace('400', '500/10'))}>
          <Icon className={cn('w-5 h-5', iconColor)} />
        </div>
        {trend && (
          <span className={cn(
            'text-xs font-medium px-2 py-0.5 rounded-full',
            trend.positive ? 'bg-success/10 text-success' : 'bg-red-500/10 text-red-400'
          )}>
            {trend.value}
          </span>
        )}
      </div>
      <div className="min-w-0">
        <p className={cn(
          'text-xl sm:text-2xl font-bold text-white mt-2 leading-tight break-words tabular-nums',
          mono && 'font-mono'
        )}>
          {value}
        </p>
        <p className="text-muted text-xs mt-0.5">{label}</p>
      </div>
    </div>
  );
}
