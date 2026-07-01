import { useState } from 'react';
import { Save, Building2, MessageCircle, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { getSettings, saveSettings } from '../lib/db';
import { getBranding, saveBranding } from '../lib/branding';

// ── WhatsApp contacts (multiple numbers, each tagged with a role) ───────────────
const WA_ROLES = ['Owner', 'Manager', 'Staff'] as const;
type WaRole = typeof WA_ROLES[number];
interface WaContact { id: string; number: string; role: WaRole; label?: string }

const WA_KEY = 'whatsapp_contacts';
const isValidPhone = (n: string) => /^\+?[0-9]{8,15}$/.test(n.trim());
const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// Load saved contacts; migrate any legacy single owner/alert numbers into rows.
function loadContacts(s: Record<string, string>): WaContact[] {
  try {
    const raw = s[WA_KEY];
    if (raw) { const arr = JSON.parse(raw); if (Array.isArray(arr)) return arr; }
  } catch { /* ignore */ }
  const migrated: WaContact[] = [];
  if (s.owner_whatsapp) migrated.push({ id: genId(), number: s.owner_whatsapp, role: 'Owner', label: 'Owner' });
  if (s.alert_whatsapp && s.alert_whatsapp !== s.owner_whatsapp) migrated.push({ id: genId(), number: s.alert_whatsapp, role: 'Manager', label: 'Alert group' });
  return migrated;
}

export function SettingsPage() {
  const [s, setS] = useState(() => ({ followup_days: '3', ...getSettings() }));
  const [b, setB] = useState(() => getBranding());
  const [contacts, setContacts] = useState<WaContact[]>(() => loadContacts(getSettings()));
  const [saved, setSaved] = useState(false);

  const setContact = (id: string, patch: Partial<WaContact>) =>
    setContacts((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const addContact = () => setContacts((cs) => [...cs, { id: genId(), number: '', role: 'Owner', label: '' }]);
  const removeContact = (id: string) => setContacts((cs) => cs.filter((c) => c.id !== id));

  function save() {
    const cleaned = contacts.map((c) => ({ ...c, number: c.number.trim(), label: c.label?.trim() || undefined }));
    const bad = cleaned.find((c) => c.number && !isValidPhone(c.number));
    if (bad) { toast.error(`Invalid phone: ${bad.number} — use +91XXXXXXXXXX`); return; }
    const kept = cleaned.filter((c) => c.number); // drop empty rows
    setContacts(kept.length ? kept : cleaned);

    saveSettings({ ...s, [WA_KEY]: JSON.stringify(kept) });
    saveBranding(b);
    setSaved(true);
    toast.success('Settings saved');
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div>
        <h1 className="page-header">Settings</h1>
        <p className="text-muted text-sm mt-1">Company config, WhatsApp numbers, reminder thresholds</p>
      </div>

      {/* Branding */}
      <div className="glass-card p-5 space-y-4">
        <p className="section-title flex items-center gap-2"><Building2 className="w-4 h-4 text-accent" /> Branding</p>
        <p className="text-muted text-xs">These appear across the app — sidebar, header, dashboard, and printed forms.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">App / Product Name</label>
            <input className="input-field" value={b.appName} onChange={(e) => setB((p) => ({ ...p, appName: e.target.value }))} placeholder="PackFlow ERP" />
          </div>
          <div>
            <label className="label">Company Name</label>
            <input className="input-field" value={b.companyName} onChange={(e) => setB((p) => ({ ...p, companyName: e.target.value }))} placeholder="Hira Packaging Solutions" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Address (printed forms)</label>
            <input className="input-field" value={b.companyAddress} onChange={(e) => setB((p) => ({ ...p, companyAddress: e.target.value }))} placeholder="Plot 8, Industrial Area…" />
          </div>
          <div>
            <label className="label">GSTIN (printed forms)</label>
            <input className="input-field font-mono" value={b.companyGstin} onChange={(e) => setB((p) => ({ ...p, companyGstin: e.target.value }))} placeholder="07AAD…" />
          </div>
          <div>
            <label className="label">Logo URL (optional)</label>
            <input className="input-field" value={b.companyLogo} onChange={(e) => setB((p) => ({ ...p, companyLogo: e.target.value }))} placeholder="https://… or data:image/…" />
          </div>
        </div>
      </div>

      {/* WhatsApp config — multiple numbers, each with a role */}
      <div className="glass-card p-5 space-y-4">
        <p className="section-title flex items-center gap-2"><MessageCircle className="w-4 h-4 text-accent" /> WhatsApp Numbers</p>
        <p className="text-muted text-xs">
          Numbers alerts can route to, tagged by role. More than one per role is allowed. Format: <span className="font-mono text-accent">+91XXXXXXXXXX</span>.
        </p>

        <div className="space-y-2">
          {contacts.length === 0 && <p className="text-muted text-xs">No numbers yet — add one below.</p>}
          {contacts.map((c) => {
            const invalid = c.number.trim() !== '' && !isValidPhone(c.number);
            return (
              <div key={c.id} className="flex flex-col sm:flex-row gap-2 sm:items-start">
                <div className="flex-1">
                  <input className={`input-field font-mono ${invalid ? 'border-red-500/60' : ''}`} value={c.number}
                    onChange={(e) => setContact(c.id, { number: e.target.value })} placeholder="+919876543210" />
                  {invalid && <p className="text-red-300 text-[10px] mt-0.5">Use +country code, 8–15 digits</p>}
                </div>
                <select className="input-field sm:w-32" value={c.role} onChange={(e) => setContact(c.id, { role: e.target.value as WaRole })}>
                  {WA_ROLES.map((r) => <option key={r}>{r}</option>)}
                </select>
                <input className="input-field sm:w-40" value={c.label ?? ''} onChange={(e) => setContact(c.id, { label: e.target.value })} placeholder="Label (optional)" />
                <button onClick={() => removeContact(c.id)} title="Remove"
                  className="p-2 rounded-lg hover:bg-red-500/20 text-muted hover:text-red-400 transition-colors self-start"><Trash2 className="w-4 h-4" /></button>
              </div>
            );
          })}
        </div>
        <button onClick={addContact} className="btn-secondary"><Plus className="w-4 h-4" /> Add Number</button>
      </div>

      {/* CRM follow-up threshold */}
      <div className="glass-card p-5 space-y-4">
        <p className="section-title">CRM Follow-up Threshold</p>
        <div>
          <label className="label">Remind if no contact for (days)</label>
          <input className="input-field font-mono w-32" type="number" min="1" max="30"
            value={s.followup_days}
            onChange={(e) => setS((p) => ({ ...p, followup_days: e.target.value }))} />
          <p className="text-muted text-xs mt-1">Leads not contacted in this many days show in the CRM follow-up reminder section.</p>
        </div>
      </div>

      <button onClick={save} className="btn-primary px-6 py-2.5">
        <Save className="w-4 h-4" />
        {saved ? 'Saved ✓' : 'Save Settings'}
      </button>
    </div>
  );
}
