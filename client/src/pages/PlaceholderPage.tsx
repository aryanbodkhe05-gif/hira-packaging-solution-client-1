import { Construction } from 'lucide-react';

interface Props {
  title: string;
  description?: string;
}

export function PlaceholderPage({ title, description }: Props) {
  return (
    <div className="flex flex-col items-center justify-center min-h-96 animate-fade-in">
      <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mb-4">
        <Construction className="w-8 h-8 text-accent/60" />
      </div>
      <h1 className="text-2xl font-bold text-white mb-2">{title}</h1>
      <p className="text-muted text-sm max-w-sm text-center">
        {description ?? 'This module is being built. Check back soon!'}
      </p>
      <div className="mt-6 grid grid-cols-3 gap-2 opacity-40">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-20 w-32 rounded-lg bg-white/5 animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />
        ))}
      </div>
    </div>
  );
}
