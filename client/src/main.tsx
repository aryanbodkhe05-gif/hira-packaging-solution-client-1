import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { migrateStorage, purgeBusinessDataOnce, hydrateFromServer } from './lib/db';

// Boot: migrate legacy keys, one-time handover purge, then hydrate the local
// mirror from the shared server (best-effort — falls back to local data if the
// server is unreachable), and only then render the app.
async function boot() {
  migrateStorage();
  purgeBusinessDataOnce();
  await hydrateFromServer();
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

boot();
