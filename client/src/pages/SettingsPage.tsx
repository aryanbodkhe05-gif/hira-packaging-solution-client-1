import { useState } from 'react';
import { Save, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { getSettings, saveSettings } from '../lib/db';
import { COMPANY } from '../config';

export function SettingsPage() {
  const [s, setS] = useState(() => ({
    owner_whatsapp:  '',
    alert_whatsapp:  '',
    followup_days:   '3',
    ...getSettings(),
  }));
  const [saved, setSaved] = useState(false);

  function save() {
    saveSettings(s);
    setSaved(true);
    toast.success('Settings saved');
    setTimeout(() => setSaved(false), 2000);
  }

  function resetData() {
    if (!confirm('This will clear ALL app data (orders, materials, leads etc.) and reload with fresh seed data. Continue?')) return;
    const keysToDelete = Object.keys(localStorage).filter((k) => k.startsWith('nicoflex_'));
    keysToDelete.forEach((k) => localStorage.removeItem(k));
    window.location.reload();
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div>
        <h1 className="page-header">Settings</h1>
        <p className="text-muted text-sm mt-1">Company config, WhatsApp numbers, reminder thresholds</p>
      </div>

      {/* Company info (read-only from config.ts) */}
      <div className="glass-card p-5 space-y-4">
        <p className="section-title">Company Information</p>
        <p className="text-muted text-xs">Edit <code className="text-accent">src/config.ts</code> to change company details.</p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {[
            ['Company',  COMPANY.name],
            ['Owner',    COMPANY.owner],
            ['GST No.',  COMPANY.gst],
            ['Phone',    COMPANY.phone],
            ['Email',    COMPANY.email],
            ['Address',  COMPANY.address],
          ].map(([label, value]) => (
            <div key={label} className={label === 'Address' ? 'col-span-2' : ''}>
              <p className="label">{label}</p>
              <p className="text-white/80 bg-navy/50 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* WhatsApp config */}
      <div className="glass-card p-5 space-y-4">
        <p className="section-title">WhatsApp Configuration</p>
        <p className="text-muted text-xs">
          Used to open WhatsApp with pre-filled messages via <code className="text-accent">wa.me</code> links.
          Format: +91XXXXXXXXXX
        </p>
        <div className="space-y-3">
          <div>
            <label className="label">Owner WhatsApp (Daily Summary & Alerts)</label>
            <input className="input-field font-mono" value={s.owner_whatsapp}
              onChange={(e) => setS((p) => ({ ...p, owner_whatsapp: e.target.value }))}
              placeholder="+919876543210" />
          </div>
          <div>
            <label className="label">Alert Group WhatsApp</label>
            <input className="input-field font-mono" value={s.alert_whatsapp}
              onChange={(e) => setS((p) => ({ ...p, alert_whatsapp: e.target.value }))}
              placeholder="+919876543210" />
          </div>
        </div>
      </div>

      {/* CRM settings */}
      <div className="glass-card p-5 space-y-4">
        <p className="section-title">CRM Follow-up Threshold</p>
        <div>
          <label className="label">Remind if no contact for (days)</label>
          <input className="input-field font-mono w-32" type="number" min="1" max="30"
            value={s.followup_days}
            onChange={(e) => setS((p) => ({ ...p, followup_days: e.target.value }))} />
          <p className="text-muted text-xs mt-1">
            Leads not contacted in this many days will show in the CRM follow-up reminder section.
          </p>
        </div>
      </div>

      {/* Data management */}
      <div className="glass-card p-5 space-y-4 border-red-500/20">
        <p className="section-title text-red-400">Data Management</p>
        <p className="text-muted text-xs">
          All data is stored in your browser's localStorage. Clearing browser data will erase everything.
        </p>
        <button onClick={resetData} className="btn-danger">
          <RefreshCw className="w-4 h-4" /> Reset to Demo Data
        </button>
      </div>

      <button onClick={save} className="btn-primary px-6 py-2.5">
        <Save className="w-4 h-4" />
        {saved ? 'Saved ✓' : 'Save Settings'}
      </button>
    </div>
  );
}
