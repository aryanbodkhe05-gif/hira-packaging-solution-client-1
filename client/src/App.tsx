import { ReactElement } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AlertProvider } from './context/AlertContext';
import { AppLayout } from './components/layout/AppLayout';
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
import { SuppliersPage }     from './pages/SuppliersPage';
import { GrnPage }           from './pages/GrnPage';
import { OrdersPage }       from './pages/OrdersPage';
import { DispatchPage }     from './pages/DispatchPage';
import { VendorsPage }      from './pages/VendorsPage';
import { AlertEnginePage }  from './pages/AlertEnginePage';
import { SettingsPage }     from './pages/SettingsPage';
import { canEditRates, canAccessSales, canAccessSupplier, canManageUsers, canAccessSettings } from './lib/roles';
import { migrateStorage, purgeBusinessDataOnce } from './lib/db';
import type { UserRole } from './types';

// Handover build: no demo data. Migrate legacy keys, then one-time-purge any
// existing business/demo data (keeping only the Users & Roles login accounts).
migrateStorage();
purgeBusinessDataOnce();

// Client-side route guard. This is convenience UX layered on top of backend
// RBAC — the server independently returns 403 for protected APIs.
function Guard({ allow, children }: { allow: boolean; children: ReactElement }) {
  return allow ? children : <Navigate to="/" replace />;
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

  return (
    <Routes>
      <Route path="/" element={<AppLayout />}>
        {/* Everyone */}
        <Route index             element={<DashboardPage />} />
        <Route path="alerts"     element={<AlertEnginePage />} />
        {/* Production — everyone */}
        <Route path="job-card"        element={<JobCardListPage cardType="BOPP" />} />
        <Route path="job-card/:id"    element={<JobCardDetailPage />} />
        <Route path="other"           element={<JobCardListPage cardType="Other" />} />
        <Route path="loom"            element={<LoomProductionPage />} />
        <Route path="pp-fabric"       element={<PPFabricPage />} />
        <Route path="materials"       element={<MaterialsPage />} />
        {/* Inventory — everyone */}
        <Route path="inventory/rolls"          element={<InventoryRollsPage />} />
        <Route path="inventory/raw-materials"  element={<RawMaterialsPage />} />
        <Route path="inventory/bopp-film"      element={<BoppFilmPage />} />
        <Route path="inventory/finished-rolls" element={<FinishedRollsPage />} />
        <Route path="inventory/pp-granule"     element={<PPGranuleStockPage />} />

        {/* Sales — not Staff */}
        <Route path="orders"        element={<Guard allow={canAccessSales(role)}><OrdersPage /></Guard>} />
        <Route path="dispatch"      element={<Guard allow={canAccessSales(role)}><DispatchPage /></Guard>} />
        <Route path="dispatch/bags"  element={<Guard allow={canAccessSales(role)}><DispatchRegisterPage type="Bag" /></Guard>} />
        <Route path="dispatch/rolls" element={<Guard allow={canAccessSales(role)}><DispatchRegisterPage type="Roll" /></Guard>} />
        <Route path="vendors"       element={<Guard allow={canAccessSales(role)}><VendorsPage /></Guard>} />

        {/* Supplier — not Staff */}
        <Route path="suppliers"     element={<Guard allow={canAccessSupplier(role)}><SuppliersPage /></Guard>} />
        <Route path="grn"           element={<Guard allow={canAccessSupplier(role)}><GrnPage /></Guard>} />

        {/* Master */}
        <Route path="rate-master"   element={<Guard allow={canEditRates(role)}><RateMasterPage /></Guard>} />
        <Route path="users"         element={<Guard allow={canManageUsers(role)}><UsersPage /></Guard>} />
        <Route path="settings"      element={<Guard allow={canAccessSettings(role)}><SettingsPage /></Guard>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AuthProvider>
        <AlertProvider>
          <AppRoutes />
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
