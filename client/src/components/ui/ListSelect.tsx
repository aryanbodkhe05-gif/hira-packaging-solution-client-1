import { useState } from 'react';
import { Plus, Check, X } from 'lucide-react';
import { getList, addToList } from '../../lib/db';

// Dropdown backed by a reusable, extensible list (stored in settings).
// Adding a new value persists it so it's available next time.
export function ListSelect({ value, onChange, listKey, defaults, placeholder = 'Select…' }: {
  value: string;
  onChange: (v: string) => void;
  listKey: string;
  defaults: string[];
  placeholder?: string;
}) {
  const [options, setOptions] = useState<string[]>(() => getList(listKey, defaults));
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');

  function commit() {
    const v = draft.trim();
    if (!v) { setAdding(false); return; }
    const next = addToList(listKey, v, defaults);
    setOptions(next);
    onChange(v);
    setDraft('');
    setAdding(false);
  }

  if (adding) {
    return (
      <div className="flex gap-1.5">
        <input className="input-field" value={draft} autoFocus placeholder="New value…"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setAdding(false); }} />
        <button type="button" onClick={commit} className="px-2 rounded bg-primary text-white"><Check className="w-4 h-4" /></button>
        <button type="button" onClick={() => setAdding(false)} className="px-2 rounded bg-white/10 text-muted"><X className="w-4 h-4" /></button>
      </div>
    );
  }

  return (
    <div className="flex gap-1.5">
      <select className="input-field" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{placeholder}</option>
        {options.map((o) => <option key={o}>{o}</option>)}
        {value && !options.includes(value) && <option>{value}</option>}
      </select>
      <button type="button" onClick={() => setAdding(true)} title="Add new"
        className="px-2 rounded bg-white/10 text-muted hover:text-white"><Plus className="w-4 h-4" /></button>
    </div>
  );
}
