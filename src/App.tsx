import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import SuperAdminDashboard from './components/SuperAdminDashboard';
import CompanyDashboard from './components/CompanyDashboard';
import { Loader2 } from 'lucide-react';

function AppContent() {
  const { user, company, isSuperAdmin, loading, showWelcome, showGoodbye } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-gray-100">
        <div className="text-center">
          <Loader2 className="w-16 h-16 text-teal-500 animate-spin mx-auto mb-6" />
          <p className="text-gray-600 font-medium">Carregando...</p>
        </div>
      </div>
    );
  }

  if (showGoodbye) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-gray-100">
        <div className="text-center">
          <Loader2 className="w-16 h-16 text-teal-500 animate-spin mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Saindo...</h2>
          <p className="text-gray-600 font-medium">Até logo!</p>
        </div>
      </div>
    );
  }

  if (showWelcome) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-gray-100">
        <div className="text-center">
          <Loader2 className="w-16 h-16 text-teal-500 animate-spin mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Bem-vindo!</h2>
          <p className="text-gray-600 font-medium">Carregando seu painel...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  if (company?.is_super_admin || isSuperAdmin) {
    return <SuperAdminDashboard />;
  }

  return <CompanyDashboard />;
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
