import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AlertProvider } from './context/AlertContext';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { InventoryPage } from './pages/InventoryPage';
import { OrdersPage } from './pages/OrdersPage';
import { AlertsPage } from './pages/AlertsPage';
import { PlaceholderPage } from './pages/PlaceholderPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-accent/20 border-t-accent rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AlertProvider>
              <AppLayout />
            </AlertProvider>
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="dispatch" element={<PlaceholderPage title="Dispatch Tracker" description="One-click dispatch with auto WhatsApp to clients. Module 3 — coming next." />} />
        <Route path="production" element={<PlaceholderPage title="Production Monitor" description="Machine registry, job queue, and downtime logging. Module 4." />} />
        <Route path="crm" element={<PlaceholderPage title="Sales CRM" description="Lead pipeline, follow-up reminders, and won client history. Module 5." />} />
        <Route path="finance" element={<PlaceholderPage title="Finance & Billing" description="GST invoices, outstanding payments, P&L summary. Module 6." />} />
        <Route path="vendors" element={<PlaceholderPage title="Vendor & Purchase" description="Vendor database, PO automation, supplier comparison. Module 7." />} />
        <Route path="alerts" element={<AlertsPage />} />
        <Route path="settings" element={<PlaceholderPage title="Settings" description="Company info, WhatsApp config, thresholds, and staff accounts." />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#1A1A70',
              color: '#fff',
              border: '1px solid rgba(94, 94, 232, 0.3)',
              fontFamily: 'Inter, sans-serif',
              fontSize: '13px',
            },
            success: { iconTheme: { primary: '#12B76A', secondary: '#fff' } },
            error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  );
}
