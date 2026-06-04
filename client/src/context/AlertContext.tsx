import { createContext, useContext, useState, ReactNode } from 'react';
import type { Alert } from '../types';

interface AlertContextValue {
  alerts: Alert[];
  unreadCount: number;
  markSeen: (id: string) => void;
  markAllSeen: () => void;
  refresh: () => void;
}

const AlertContext = createContext<AlertContextValue>({
  alerts: [], unreadCount: 0,
  markSeen: () => {}, markAllSeen: () => {}, refresh: () => {},
});

export function AlertProvider({ children }: { children: ReactNode }) {
  const [alerts, setAlerts] = useState<Alert[]>([]);

  const unreadCount = alerts.filter((a) => !a.seen).length;

  function markSeen(id: string) {
    setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, seen: true } : a));
  }
  function markAllSeen() {
    setAlerts((prev) => prev.map((a) => ({ ...a, seen: true })));
  }

  return (
    <AlertContext.Provider value={{ alerts, unreadCount, markSeen, markAllSeen, refresh: () => {} }}>
      {children}
    </AlertContext.Provider>
  );
}

export function useAlerts() { return useContext(AlertContext); }
