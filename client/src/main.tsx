import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { migrateStorage, purgeBusinessDataOnce, hydrateFromServer, migrateRenamesOnce, migrateOrderFieldsOnce, migrateToMovingAvgOnce, syncMaterialPools } from './lib/db';
import { seedSampleData } from './lib/sampleSeed';

// PWA auto-update: the service worker (registerType 'autoUpdate') installs a new
// build in the background and, with skipWaiting/clientsClaim, takes control right
// away — but the open tab keeps showing the OLD cached shell until it reloads.
// Reload once when a freshly-deployed worker takes over so users always land on
// the latest build with no manual cache-clear. `hadController` skips the reload on
// the first-ever registration (no prior worker = not an update).
if ('serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded || !hadController) return;
    reloaded = true;
    window.location.reload();
  });
}

// Boot: migrate legacy keys, one-time handover purge, then hydrate the local
// mirror from the shared server (best-effort — falls back to local data if the
// server is unreachable), and only then render the app.
async function boot() {
  migrateStorage();
  purgeBusinessDataOnce();
  await hydrateFromServer();
  migrateRenamesOnce();     // UL → Milky, RP → Master Batch (after hydrate so it syncs up)
  migrateOrderFieldsOnce(); // Client Name → Brand Name, GSM → GRM, single → multiple BOPP sizes
  migrateToMovingAvgOnce(); // FIFO batches → moving-average receipts + pooled costing
  if (import.meta.env.DEV) seedSampleData(); // localhost-only sample data (never in the deployed build)
  syncMaterialPools(); // derive each material's pool + snapshot avg rates from receipts + consumption
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

boot();
