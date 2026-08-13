import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { LoginPage } from './auth/LoginPage';
import { RegistroPage } from './auth/RegistroPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { ResumenPage } from './pages/ResumenPage';
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
          <Route path="/registro" element={<RegistroPage />} />
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<ResumenPage />} />
            <Route path="/items" element={<ItemsPage />} />
            <Route path="/operarios" element={<OperariosPage />} />
            <Route path="/ordenes-produccion" element={<OrdenesProduccionPage />} />
            <Route path="/movimientos" element={<MovimientosPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
