import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { migrateStorage, purgeBusinessDataOnce, hydrateFromServer, migrateRenamesOnce, migrateOrderFieldsOnce, migrateRawMaterialBatchesOnce, migrateConsumptionToBatchUsesOnce, migrateToFifoMaterialsOnce, syncBatchStock } from './lib/db';
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
  migrateRawMaterialBatchesOnce(); // flat raw-material stock → opening batches
  migrateConsumptionToBatchUsesOnce(); // legacy lots → manual batch-use lines
  migrateToFifoMaterialsOnce();         // manual batch-use → auto-FIFO materials
  if (import.meta.env.DEV) seedSampleData(); // localhost-only sample data (never in the deployed build)
  syncBatchStock(); // derive each batch's remaining from the manual batch-use lines
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

boot();
