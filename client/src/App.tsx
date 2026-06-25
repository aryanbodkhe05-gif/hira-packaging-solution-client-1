import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { AlertProvider } from './context/AlertContext';
import { AppLayout } from './components/layout/AppLayout';
import { DashboardPage }    from './pages/DashboardPage';
import { MaterialsPage }    from './pages/MaterialsPage';
import { ProductionPage }   from './pages/ProductionPage';
import { PPFabricPage }     from './pages/PPFabricPage';
import { LoomProductionPage } from './pages/LoomProductionPage';
import { JobCardListPage }   from './pages/JobCardListPage';
import { JobCardDetailPage } from './pages/JobCardDetailPage';
import { RateMasterPage }    from './pages/RateMasterPage';
import { PlaceholderPage }   from './pages/PlaceholderPage';
import { OrdersPage }       from './pages/OrdersPage';
import { DispatchPage }     from './pages/DispatchPage';
import { CRMPage }          from './pages/CRMPage';
import { FinancePage }      from './pages/FinancePage';
import { VendorsPage }      from './pages/VendorsPage';
import { AlertEnginePage }  from './pages/AlertEnginePage';
import { SettingsPage }     from './pages/SettingsPage';
import { seedDatabase }     from './lib/seed';
import { migrateStorage }   from './lib/db';

// Migrate any legacy nicoflex_* keys to packflow_* (one-time, no data loss),
// then seed demo data on first ever load.
migrateStorage();
seedDatabase();

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AuthProvider>
        <AlertProvider>
          <Routes>
            <Route path="/" element={<AppLayout />}>
              <Route index             element={<DashboardPage />} />
              <Route path="materials"  element={<MaterialsPage />} />
              <Route path="production" element={<ProductionPage />} />
              <Route path="pp-fabric"  element={<PPFabricPage />} />
              <Route path="loom"       element={<LoomProductionPage />} />
              <Route path="job-card"        element={<JobCardListPage />} />
              <Route path="job-card/:id"    element={<JobCardDetailPage />} />
              <Route path="rate-master"     element={<RateMasterPage />} />
              <Route path="orders"     element={<OrdersPage />} />
              <Route path="dispatch"   element={<DispatchPage />} />
              <Route path="crm"        element={<CRMPage />} />
              <Route path="finance"    element={<FinancePage />} />
              <Route path="vendors"    element={<VendorsPage />} />
              <Route path="alerts"     element={<AlertEnginePage />} />
              <Route path="settings"   element={<SettingsPage />} />

              {/* ── New 6-section routes — placeholders until each section is built ── */}
              <Route path="dispatch/bags"  element={<PlaceholderPage title="Dispatch – Bags" description="Finished-bag dispatch register. Being built." />} />
              <Route path="dispatch/rolls" element={<PlaceholderPage title="Dispatch – Rolls" description="Finished-roll dispatch register. Being built." />} />
              <Route path="normal-bag"     element={<PlaceholderPage title="Normal Bag" description="Normal bag job card (Printing → Cutting → Dispatch). Being built." />} />
              <Route path="normal-bag/:id" element={<PlaceholderPage title="Normal Bag" description="Normal bag job card. Being built." />} />
              <Route path="inventory/raw-materials"  element={<PlaceholderPage title="Raw Materials" description="Consumables + 1-click restock. Being built." />} />
              <Route path="inventory/finished-rolls" element={<PlaceholderPage title="Finished Rolls" description="Finished rolls (Normal + BOPP). Being built." />} />
              <Route path="inventory/bopp-film"      element={<PlaceholderPage title="BOPP Film Stock" description="Incoming BOPP film raw stock. Being built." />} />
              <Route path="suppliers"       element={<PlaceholderPage title="Suppliers" description="Supplier master. Being built." />} />
              <Route path="purchase-orders" element={<PlaceholderPage title="Purchase Orders" description="Raise POs to suppliers. Being built." />} />
              <Route path="grn"             element={<PlaceholderPage title="GRN" description="Goods Receipt Note — receive against a PO. Being built." />} />
              <Route path="cylinders"       element={<PlaceholderPage title="Cylinder Register" description="Gravure cylinder master. Being built." />} />
              <Route path="users"           element={<PlaceholderPage title="Users & Roles" description="User & role management. Being built." />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
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
