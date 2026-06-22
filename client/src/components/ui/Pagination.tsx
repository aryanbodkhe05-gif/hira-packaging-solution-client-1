import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

interface Props {
  page: number;          // 1-based current page
  total: number;         // total row count (unpaginated)
  pageSize: number;
  onPage: (page: number) => void;
}

// Compact pager used by the list views. Renders "Showing X–Y of N" + prev/next.
export function Pagination({ page, total, pageSize, onPage }: Props) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount);
  const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, total);

  return (
    <div className="flex items-center justify-between gap-3 flex-wrap px-5 py-2 border-t border-accent/10">
      <span className="text-muted text-xs">
        Showing <span className="text-white/80 font-mono">{from}</span>–
        <span className="text-white/80 font-mono">{to}</span> of{' '}
        <span className="text-white/80 font-mono">{total}</span>
      </span>

      {pageCount > 1 && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPage(safePage - 1)}
            disabled={safePage <= 1}
            className="p-1.5 rounded-lg text-muted hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            aria-label="Previous page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs text-white/70 px-2 font-mono">
            {safePage} / {pageCount}
          </span>
          <button
            onClick={() => onPage(safePage + 1)}
            disabled={safePage >= pageCount}
            className={cn(
              'p-1.5 rounded-lg text-muted hover:text-white hover:bg-white/10 transition-colors',
              'disabled:opacity-30 disabled:hover:bg-transparent'
            )}
            aria-label="Next page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
