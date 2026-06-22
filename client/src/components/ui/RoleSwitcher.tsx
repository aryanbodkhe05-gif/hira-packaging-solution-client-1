import { useState } from 'react';
import { Eye } from 'lucide-react';
import type { UserRole } from '../../types';
import { getViewRole, setViewRole } from '../../lib/roles';

// Demo-only control. The app's auth is hardcoded to OWNER (no real login yet),
// so this lets you preview how each role sees the Job Card — Staff sees
// quantities/balances but no ₹ costs. Remove once real auth/roles land.
export function RoleSwitcher({ onChange }: { onChange?: (r: UserRole) => void }) {
  const [role, setRole] = useState<UserRole>(() => getViewRole());
  function change(r: UserRole) {
    setViewRole(r);
    setRole(r);
    onChange?.(r);
  }
  return (
    <label className="flex items-center gap-2 text-xs text-muted" title="Demo: preview the app as a different role">
      <Eye className="w-3.5 h-3.5" />
      <span className="hidden sm:inline">View as</span>
      <select
        value={role}
        onChange={(e) => change(e.target.value as UserRole)}
        className="bg-navy/60 border border-accent/20 text-white/80 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-accent/60"
      >
        <option value="OWNER">Owner</option>
        <option value="MANAGER">Manager</option>
        <option value="STAFF">Staff</option>
      </select>
    </label>
  );
}
