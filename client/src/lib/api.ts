import axios from 'axios';

// Same-origin API. `withCredentials` sends the httpOnly auth cookie on every
// request (and in dev, Vite proxies /api → the backend on :3001).
const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

export default api;
