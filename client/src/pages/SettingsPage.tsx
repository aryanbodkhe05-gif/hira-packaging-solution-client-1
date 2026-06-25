import { useState } from 'react';
import { Save, RefreshCw, Building2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { getSettings, saveSettings } from '../lib/db';
import { getBranding, saveBranding } from '../lib/branding';

export function SettingsPage() {
  const [s, setS] = useState(() => ({
    owner_whatsapp:  '',
    alert_whatsapp:  '',
    followup_days:   '3',
    ...getSettings(),
  }));
  const [b, setB] = useState(() => getBranding());
  const [saved, setSaved] = useState(false);

  function save() {
    saveSettings(s);
    saveBranding(b);
    setSaved(true);
    toast.success('Settings saved');
    setTimeout(() => setSaved(false), 2000);
  }

  function resetData() {
    if (!confirm('This will clear ALL app data (orders, materials, leads etc.) and reload with fresh seed data. Continue?')) return;
    const keysToDelete = Object.keys(localStorage).filter((k) => k.startsWith('packflow_') || k.startsWith('nicoflex_'));
    keysToDelete.forEach((k) => localStorage.removeItem(k));
    window.location.reload();
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div>
        <h1 className="page-header">Settings</h1>
        <p className="text-muted text-sm mt-1">Company config, WhatsApp numbers, reminder thresholds</p>
      </div>

      {/* Branding — app + company name (editable, read everywhere) */}
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
