import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { LoginPage } from './auth/LoginPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { ItemsPage } from './pages/ItemsPage';
import { OperariosPage } from './pages/OperariosPage';
import { OrdenesProduccionPage } from './pages/OrdenesProduccionPage';
import { MovimientosPage } from './pages/MovimientosPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<ItemsPage />} />
            <Route path="/operarios" element={<OperariosPage />} />
            <Route path="/ordenes-produccion" element={<OrdenesProduccionPage />} />
            <Route path="/movimientos" element={<MovimientosPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
