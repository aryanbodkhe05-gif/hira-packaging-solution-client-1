import { createContext, useContext, useState, useCallback, useMemo, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { getUnits, getActiveUnit, setActiveUnitLS, DEFAULT_UNITS } from '../lib/units';
import type { Unit } from '../types/models';

interface UnitCtx {
  activeUnit: string;                 // active unit id
  setActiveUnit: (id: string) => void;
  units: Unit[];
  locked: boolean;                    // true for a unit-scoped Staff login (can't switch)
}

const UnitContext = createContext<UnitCtx>({
  activeUnit: DEFAULT_UNITS[0].id,
  setActiveUnit: () => {},
  units: DEFAULT_UNITS,
  locked: false,
});

export function UnitProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const units = useMemo(() => getUnits(), []);
  // A Staff user tied to a unit is LOCKED to it; everyone else switches freely.
  const forcedUnit = user?.role === 'STAFF' ? user.unitId : undefined;
  const locked = !!forcedUnit;

  const [activeUnit, setActive] = useState<string>(() => forcedUnit ?? getActiveUnit());

  // Keep the scoped staffer pinned to their unit, and mirror the active unit to
  // localStorage so create-time stamping (getActiveUnit) stays authoritative.
  useEffect(() => {
    if (forcedUnit && activeUnit !== forcedUnit) { setActive(forcedUnit); return; }
    setActiveUnitLS(activeUnit);
  }, [forcedUnit, activeUnit]);

  const setActiveUnit = useCallback((id: string) => {
    if (locked) return;               // scoped staff cannot switch units
    setActiveUnitLS(id);
    setActive(id);
  }, [locked]);

  return (
    <UnitContext.Provider value={{ activeUnit, setActiveUnit, units, locked }}>
      {children}
    </UnitContext.Provider>
  );
}

export function useUnit() {
  return useContext(UnitContext);
}
