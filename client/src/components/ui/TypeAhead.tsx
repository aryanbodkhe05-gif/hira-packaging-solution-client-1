import { useState, useMemo, useRef } from 'react';
import { getList, addToList } from '../../lib/db';

// Free-text input backed by a reusable, extensible list. Typing filters the
// stored values and shows them in a suggestion popup; whatever is typed is saved
// back to the list on commit, so it's offered next time. Same behaviour as the
// Brand field on Orders — unlike ListSelect, the value is never constrained to
// the list.
export function TypeAhead({ value, onChange, listKey, defaults, placeholder, autoFocus, className }: {
  value: string;
  onChange: (v: string) => void;
  listKey: string;
  defaults: string[];
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [touched, setTouched] = useState(false);
  const options = useMemo(() => getList(listKey, defaults), [listKey, defaults]);
  const blurTimer = useRef<ReturnType<typeof setTimeout>>();

  const matches = useMemo(() => {
    const q = value.trim().toLowerCase();
    const pool = q ? options.filter((o) => o.toLowerCase().includes(q)) : options;
    // An exact hit needs no suggestion list.
    if (pool.length === 1 && pool[0].toLowerCase() === q) return [];
    return pool.slice(0, 8);
  }, [value, options]);

  return (
    <div className={'relative ' + (className ?? '')}>
      <input
        className="input-field" value={value} autoFocus={autoFocus} placeholder={placeholder ?? 'Type to search…'}
        onChange={(e) => { onChange(e.target.value); setTouched(true); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => { blurTimer.current = setTimeout(() => setOpen(false), 150); }}
      />
      {open && matches.length > 0 && (
        // Solid/opaque popup (not glass) so suggestions never bleed into content behind them.
        <div className="absolute z-40 left-0 right-0 mt-1 rounded-xl bg-navy border border-accent/40 max-h-52 overflow-y-auto shadow-2xl ring-1 ring-black/40">
          {touched && value.trim() && (
            <p className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-muted border-b border-white/10 bg-navy">Saved items — click to select</p>
          )}
          {matches.map((o) => (
            <button key={o} type="button" onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onChange(o); setOpen(false); clearTimeout(blurTimer.current); }}
              className="w-full text-left px-3 py-2 text-sm text-white/90 hover:bg-white/5 border-b border-white/5 last:border-0">
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Persist a typed value into its reusable list. Call on save.
export function rememberTypeAhead(listKey: string, value: string, defaults: string[]): void {
  const v = value.trim();
  if (v) addToList(listKey, v, defaults);
}
