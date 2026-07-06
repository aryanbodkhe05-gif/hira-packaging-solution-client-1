import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { migrateStorage, purgeBusinessDataOnce, hydrateFromServer, migrateRenamesOnce } from './lib/db';
import { seedSampleData } from './lib/sampleSeed';

// Boot: migrate legacy keys, one-time handover purge, then hydrate the local
// mirror from the shared server (best-effort — falls back to local data if the
// server is unreachable), and only then render the app.
async function boot() {
  migrateStorage();
  purgeBusinessDataOnce();
  await hydrateFromServer();
  migrateRenamesOnce(); // UL → Milky, RP → Master Batch (after hydrate so it syncs up)
  if (import.meta.env.DEV) seedSampleData(); // localhost-only sample data (never in the deployed build)
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

boot();
