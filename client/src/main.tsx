import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { migrateStorage, purgeBusinessDataOnce, hydrateFromServer, migrateRenamesOnce, migrateOrderFieldsOnce, migrateToMovingAvgOnce, syncMaterialPools } from './lib/db';
import { seedSampleData } from './lib/sampleSeed';

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
