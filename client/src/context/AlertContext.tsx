import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import toast from 'react-hot-toast';
import api from '../lib/api';
import type { Alert } from '../types';
import { ALERT_TYPE_LABELS } from '../lib/utils';
import { useAuth } from './AuthContext';

interface AlertContextValue {
  alerts: Alert[];
  unreadCount: number;
  markSeen: (id: string) => Promise<void>;
  markAllSeen: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AlertContext = createContext<AlertContextValue | null>(null);

export function AlertProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const { data } = await api.get('/alerts?limit=50');
      setAlerts(data.alerts);
      setUnreadCount(data.unreadCount);
    } catch {
      // silent
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    refresh();

    const socket: Socket = io('/', { transports: ['websocket', 'polling'] });

    socket.on('new_alert', (alert: Alert) => {
      setAlerts((prev) => [alert, ...prev]);
      setUnreadCount((c) => c + 1);

      // Fire toast
      const label = ALERT_TYPE_LABELS[alert.type] ?? alert.type;
      toast.error(`${label}: ${alert.title}`, {
        duration: 6000,
        style: {
          background: '#1A1A70',
          color: '#fff',
          border: '1px solid rgba(94,94,232,0.3)',
        },
      });

      // Play sound
      try {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
      } catch {
        // Audio context may be blocked
      }
    });

    return () => { socket.disconnect(); };
  }, [token, refresh]);

  async function markSeen(id: string) {
    await api.patch(`/alerts/${id}/seen`);
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, seen: true } : a)));
    setUnreadCount((c) => Math.max(0, c - 1));
  }

  async function markAllSeen() {
    await api.patch('/alerts/mark-all-seen');
    setAlerts((prev) => prev.map((a) => ({ ...a, seen: true })));
    setUnreadCount(0);
  }

  return (
    <AlertContext.Provider value={{ alerts, unreadCount, markSeen, markAllSeen, refresh }}>
      {children}
    </AlertContext.Provider>
  );
}

export function useAlerts() {
  const ctx = useContext(AlertContext);
  if (!ctx) throw new Error('useAlerts must be used within AlertProvider');
  return ctx;
}
