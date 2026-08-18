import { useState, useRef, useEffect } from 'react';

// A numeric input that lets the user type the full number freely (400, 1250, 12.5)
// and only COMMITS on blur / Enter. While focused it holds its own text so parent
// re-renders (auto-save, list re-ordering, cost recompute) can't reset the caret or
// truncate the entry to a single digit. Empty commits as 0.
export function CommitNumberInput({
  value, onCommit, className, placeholder, min = 0,
}: {
  value: number | undefined;
  onCommit: (v: number) => void;
  className?: string;
  placeholder?: string;
  min?: number;
}) {
  const [text, setText] = useState(value ? String(value) : '');
  const focused = useRef(false);

  // Sync from the prop only while NOT being edited (never clobber in-progress typing).
  useEffect(() => {
    if (!focused.current) setText(value ? String(value) : '');
  }, [value]);

  function commit() {
    focused.current = false;
    const n = parseFloat(text);
    onCommit(Math.max(min, Number.isFinite(n) ? n : 0));
  }

  return (
    <input
      className={className}
      type="number"
      min={min}
      step="any"
      inputMode="decimal"
      value={text}
      placeholder={placeholder}
      onFocus={() => { focused.current = true; }}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
    />
  );
}
