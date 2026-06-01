import { cn } from '../../lib/utils';

export function LoadingSpinner({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center justify-center', className)}>
      <div className="w-8 h-8 border-2 border-accent/20 border-t-accent rounded-full animate-spin" />
    </div>
  );
}

export function PageLoader() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-64">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-accent/20 border-t-accent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-muted text-sm">Loading...</p>
      </div>
    </div>
  );
}
