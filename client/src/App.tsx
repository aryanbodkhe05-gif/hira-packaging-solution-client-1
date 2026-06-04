import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { AlertProvider } from './context/AlertContext';
import { AppLayout } from './components/layout/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { MaterialsPage } from './pages/MaterialsPage';
import { OrdersPage } from './pages/OrdersPage';
import { DispatchPage } from './pages/DispatchPage';
import { seedDatabase } from './lib/seed';

// Seed localStorage with realistic data on first load
seedDatabase();

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AlertProvider>
          <Routes>
            <Route path="/" element={<AppLayout />}>
              <Route index          element={<DashboardPage />} />
              <Route path="materials" element={<MaterialsPage />} />
              <Route path="orders"    element={<OrdersPage />} />
              <Route path="dispatch"  element={<DispatchPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AlertProvider>
      </AuthProvider>
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
          error:   { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
        }}
      />
    </BrowserRouter>
  );
}
