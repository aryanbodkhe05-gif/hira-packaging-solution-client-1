import { LucideIcon } from 'lucide-react';

interface Props {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon: Icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mb-4">
        <Icon className="w-7 h-7 text-accent/60" />
      </div>
      <p className="text-white/70 font-medium text-base">{title}</p>
      {description && <p className="text-muted text-sm mt-1 max-w-xs">{description}</p>}
      {action && (
        <button onClick={action.onClick} className="btn-primary mt-5">
          {action.label}
        </button>
      )}
    </div>
  );
}
