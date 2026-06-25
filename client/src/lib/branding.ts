// ── Editable branding (app name + company details) ─────────────────────────────
// App/company names were previously hardcoded in config.ts. They now live in the
// Settings record (same localStorage layer) and are read everywhere through
// useBranding() / getBranding(). config.COMPANY supplies the defaults.

import { useSyncExternalStore } from 'react';
import { getSettings, saveSettings } from './db';
import { COMPANY } from '../config';

export interface Branding {
  appName: string;
  companyName: string;
  companyAddress: string;
  companyGstin: string;
  companyLogo: string;   // optional URL / data-URI, used on print forms
}

const DEFAULTS: Branding = {
  appName: 'PackFlow ERP',
  companyName: COMPANY.name,
  companyAddress: COMPANY.address,
  companyGstin: COMPANY.gst,
  companyLogo: '',
};

// Cache the snapshot so useSyncExternalStore gets a stable reference between
// renders (only rebuilds when an underlying value actually changes).
let cache: Branding | null = null;
let cacheKey = '';

function snapshot(): Branding {
  const s = getSettings();
  const next: Branding = {
    appName:        s.app_name        || DEFAULTS.appName,
    companyName:    s.company_name     || DEFAULTS.companyName,
    companyAddress: s.company_address  || DEFAULTS.companyAddress,
    companyGstin:   s.company_gstin    || DEFAULTS.companyGstin,
    companyLogo:    s.company_logo     || DEFAULTS.companyLogo,
  };
  const key = JSON.stringify(next);
  if (key !== cacheKey || !cache) { cacheKey = key; cache = next; }
  return cache;
}

const listeners = new Set<() => void>();
function subscribe(cb: () => void) { listeners.add(cb); return () => { listeners.delete(cb); }; }

export function getBranding(): Branding { return snapshot(); }

export function saveBranding(patch: Partial<Branding>): void {
  const map: Record<string, string> = {};
  if (patch.appName !== undefined)        map.app_name        = patch.appName;
  if (patch.companyName !== undefined)    map.company_name    = patch.companyName;
  if (patch.companyAddress !== undefined) map.company_address = patch.companyAddress;
  if (patch.companyGstin !== undefined)   map.company_gstin   = patch.companyGstin;
  if (patch.companyLogo !== undefined)    map.company_logo    = patch.companyLogo;
  saveSettings(map);
  listeners.forEach((l) => l());   // notify subscribed components to re-render
}

export function useBranding(): Branding {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
