import { ReactElement } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AlertProvider } from './context/AlertContext';
import { UnitProvider } from './context/UnitContext';
import { AppLayout } from './components/layout/AppLayout';
import { LoomUnitLayout } from './components/layout/LoomUnitLayout';
import { RollCountPage } from './pages/RollCountPage';
import { TapeStockPage } from './pages/TapeStockPage';
import { LoginPage }        from './pages/LoginPage';
import { DashboardPage }    from './pages/DashboardPage';
import { MaterialsPage }    from './pages/MaterialsPage';
import { PPFabricPage }     from './pages/PPFabricPage';
import { LoomProductionPage } from './pages/LoomProductionPage';
import { JobCardListPage }   from './pages/JobCardListPage';
import { JobCardDetailPage } from './pages/JobCardDetailPage';
import { RateMasterPage }    from './pages/RateMasterPage';
import { DispatchRegisterPage } from './pages/DispatchRegisterPage';
import { InventoryRollsPage } from './pages/InventoryRollsPage';
import { RawMaterialsPage }  from './pages/RawMaterialsPage';
import { BoppFilmPage }      from './pages/BoppFilmPage';
import { FinishedRollsPage } from './pages/FinishedRollsPage';
import { PPGranuleStockPage } from './pages/PPGranuleStockPage';
import { UsersPage }         from './pages/UsersPage';
import { MachinesPage }      from './pages/MachinesPage';
import { SuppliersPage }     from './pages/SuppliersPage';
import { GrnPage }           from './pages/GrnPage';
import { OrdersPage }       from './pages/OrdersPage';
import { DispatchPage }     from './pages/DispatchPage';
import { VendorsPage }      from './pages/VendorsPage';
import { AlertEnginePage }  from './pages/AlertEnginePage';
import { SettingsPage }     from './pages/SettingsPage';
import {
  canEditRates, canAccessSales, canAccessSupplier, canManageUsers, canAccessSettings,
  canAccessJobCards, canAccessLoom, canAccessPPUnit, canAccessGeneral, staffHome,
} from './lib/roles';
import type { UserRole } from './types';

// Client-side route guard. NOTE: this app has no authenticated backend (the
// server is a generic JSON key-value store), so this is the ONLY enforcement
// layer. Blocked routes send the user to their allowed home.
function Guard({ allow, home, children }: { allow: boolean; home: string; children: ReactElement }) {
  return allow ? children : <Navigate to={home} replace />;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  // Logged out → only the login screen, nothing else.
  if (!user) return <LoginPage />;

  const role: UserRole = user.role;
  // Process-scoped Staff land on (and are bounced back to) their allowed area.
  const home = staffHome(role) ?? '/';

  return (
    <Routes>
      <Route path="/" element={<AppLayout />}>
        {/* Dashboard/Alerts — hidden from process-scoped Staff */}
        <Route index         element={home !== '/' ? <Navigate to={home} replace /> : <DashboardPage />} />
        <Route path="alerts" element={<Guard allow={canAccessGeneral(role)} home={home}><AlertEnginePage /></Guard>} />
        {/* Production — Staff scoped to a job-card process */}
        <Route path="job-card"        element={<Guard allow={canAccessJobCards(role)} home={home}><JobCardListPage cardType="BOPP" /></Guard>} />
        <Route path="job-card/:id"    element={<Guard allow={canAccessJobCards(role)} home={home}><JobCardDetailPage /></Guard>} />
        <Route path="other"           element={<Guard allow={canAccessJobCards(role)} home={home}><JobCardListPage cardType="Other" /></Guard>} />
        <Route path="materials"       element={<Guard allow={canAccessGeneral(role)} home={home}><MaterialsPage /></Guard>} />
        {/* Inventory — hidden from process-scoped Staff */}
        <Route path="inventory/rolls"          element={<Guard allow={canAccessGeneral(role)} home={home}><InventoryRollsPage /></Guard>} />
        <Route path="inventory/raw-materials"  element={<Guard allow={canAccessGeneral(role)} home={home}><RawMaterialsPage /></Guard>} />
        <Route path="inventory/bopp-film"      element={<Guard allow={canAccessGeneral(role)} home={home}><BoppFilmPage /></Guard>} />
        <Route path="inventory/finished-rolls" element={<Guard allow={canAccessGeneral(role)} home={home}><FinishedRollsPage /></Guard>} />

        {/* Loom / P.P. Unit — a separate company, independent of the BOPP flow */}
        <Route path="loom-unit"            element={<Navigate to="/loom-unit/loom" replace />} />
        <Route path="loom-unit/loom"       element={<Guard allow={canAccessLoom(role)} home={home}><LoomUnitLayout><LoomProductionPage /></LoomUnitLayout></Guard>} />
        <Route path="loom-unit/pp-fabric"  element={<Guard allow={canAccessPPUnit(role)} home={home}><LoomUnitLayout><PPFabricPage /></LoomUnitLayout></Guard>} />
        <Route path="loom-unit/pp-granule" element={<Guard allow={canAccessPPUnit(role)} home={home}><LoomUnitLayout><PPGranuleStockPage /></LoomUnitLayout></Guard>} />
        <Route path="loom-unit/roll-count" element={<Guard allow={canAccessLoom(role) || canAccessPPUnit(role)} home={home}><LoomUnitLayout><RollCountPage /></LoomUnitLayout></Guard>} />
        <Route path="loom-unit/tape-stock" element={<Guard allow={canAccessLoom(role) || canAccessPPUnit(role)} home={home}><LoomUnitLayout><TapeStockPage /></LoomUnitLayout></Guard>} />
        {/* Old paths kept as redirects so existing links/bookmarks still work */}
        <Route path="loom"                 element={<Navigate to="/loom-unit/loom" replace />} />
        <Route path="pp-fabric"            element={<Navigate to="/loom-unit/pp-fabric" replace />} />
        <Route path="inventory/pp-granule" element={<Navigate to="/loom-unit/pp-granule" replace />} />

        {/* Sales — not Staff */}
        <Route path="orders"        element={<Guard allow={canAccessSales(role)} home={home}><OrdersPage /></Guard>} />
        <Route path="dispatch"      element={<Guard allow={canAccessSales(role)} home={home}><DispatchPage /></Guard>} />
        <Route path="dispatch/bags"  element={<Guard allow={canAccessSales(role)} home={home}><DispatchRegisterPage type="Bag" /></Guard>} />
        <Route path="dispatch/rolls" element={<Guard allow={canAccessSales(role)} home={home}><DispatchRegisterPage type="Roll" /></Guard>} />
        <Route path="vendors"       element={<Guard allow={canAccessSales(role)} home={home}><VendorsPage /></Guard>} />

        {/* Supplier — not Staff */}
        <Route path="suppliers"     element={<Guard allow={canAccessSupplier(role)} home={home}><SuppliersPage /></Guard>} />
        <Route path="grn"           element={<Guard allow={canAccessSupplier(role)} home={home}><GrnPage /></Guard>} />

        {/* Master */}
        <Route path="rate-master"   element={<Guard allow={canEditRates(role)} home={home}><RateMasterPage /></Guard>} />
        <Route path="machines"      element={<Guard allow={canEditRates(role)} home={home}><MachinesPage /></Guard>} />
        <Route path="users"         element={<Guard allow={canManageUsers(role)} home={home}><UsersPage /></Guard>} />
        <Route path="settings"      element={<Guard allow={canAccessSettings(role)} home={home}><SettingsPage /></Guard>} />
      </Route>
      <Route path="*" element={<Navigate to={home} replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AuthProvider>
        <AlertProvider>
          <UnitProvider>
            <AppRoutes />
          </UnitProvider>
        </AlertProvider>
      </AuthProvider>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1A1A70', color: '#fff',
            border: '1px solid rgba(94,94,232,0.3)', fontFamily: 'Inter', fontSize: '13px',
          },
          success: { iconTheme: { primary: '#12B76A', secondary: '#fff' } },
          error:   { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
        }}
      />
    </BrowserRouter>
  );
}
