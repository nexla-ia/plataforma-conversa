import { useEffect, useState, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import { supabase, Company } from "../lib/supabase";
import { LogOut, Plus, Building, RefreshCw } from "lucide-react";

const generateApiKey = () => {
  return crypto.randomUUID().toUpperCase().replace(/-/g, '');
};

const generatePassword = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&*';
  let password = '';
  for (let i = 0; i < 16; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

export default function SuperAdminDashboard() {
  const { signOut, user } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
    phone_number: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const fetchCompanies = useCallback(async () => {
    setRefreshing(true);
    try {
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        setError(`Erro ao carregar empresas: ${error.message}`);
      } else if (data) {
        setCompanies(data);
      }
    } catch (err: any) {
      setError(`Erro ao carregar empresas: ${err.message}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError(null);

    try {
      const password = formData.password || generatePassword();
      const apiKey = generateApiKey();

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: password,
      });

      if (signUpError) {
        throw new Error(signUpError.message);
      }

      if (!signUpData.user) throw new Error("Falha ao criar usuário");

      await supabase.rpc('confirm_user_email', { user_id: signUpData.user.id }).catch(() => {});

      const { error } = await supabase
        .from("companies")
        .insert({
          name: formData.name,
          email: formData.email,
          phone_number: formData.phone_number,
          api_key: apiKey,
          user_id: signUpData.user.id,
          is_super_admin: false,
        })
        .select()
        .single();

      if (error) throw error;

      setFormData({ email: "", password: "", name: "", phone_number: "" });
      setShowCreateForm(false);
      fetchCompanies();
    } catch (error: any) {
      setError(error.message || "Erro ao criar empresa");
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin mx-auto mb-2" />
          <p className="text-slate-600">Carregando empresas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-500 p-2 rounded-lg">
                <Building className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-800">Super Admin</h1>
                <p className="text-sm text-slate-600">Gerenciamento de Empresas</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowCreateForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition"
              >
                <Plus className="w-4 h-4" />
                Criar Empresa
              </button>
              <button
                onClick={() => fetchCompanies()}
                disabled={refreshing}
                className="flex items-center gap-2 px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                Atualizar
              </button>
              <button
                onClick={signOut}
                className="flex items-center gap-2 px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition"
              >
                <LogOut className="w-4 h-4" />
                Sair
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && !showCreateForm && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700">{error}</p>
          </div>
        )}
        <div className="grid gap-6">
          {companies.length === 0 && !error ? (
            <div className="text-center py-12">
              <Building className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">Nenhuma empresa cadastrada</p>
            </div>
          ) : (
            companies.map((company) => (
              <div key={company.id} className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800">{company.name}</h3>
                    <p className="text-slate-600">{company.email}</p>
                    <p className="text-sm text-slate-500">
                      API Key: {company.api_key.slice(0, 8)}...{company.api_key.slice(-4)}
                    </p>
                    <p className="text-sm text-slate-500">Telefone: {company.phone_number}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-500">
                      Criado em: {new Date(company.created_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Criar Nova Empresa</h2>
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}
            <form onSubmit={handleCreateCompany} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  placeholder="empresa@exemplo.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Senha (opcional)
                </label>
                <input
                  type="password"
                  placeholder="Deixe vazio para gerar automaticamente"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Uma senha forte será gerada automaticamente se não fornecida
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Nome da Empresa *
                </label>
                <input
                  type="text"
                  placeholder="Nome da Empresa"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Telefone *
                </label>
                <input
                  type="text"
                  placeholder="(00) 00000-0000"
                  value={formData.phone_number}
                  onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div className="pt-2 border-t border-slate-200">
                <p className="text-xs text-slate-500 mb-3">
                  Uma API Key única será gerada automaticamente para esta empresa
                </p>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={creating}
                    className="flex-1 bg-emerald-500 text-white py-2 rounded-lg hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium"
                  >
                    {creating ? "Criando..." : "Criar Empresa"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateForm(false);
                      setError(null);
                      setFormData({ email: "", password: "", name: "", phone_number: "" });
                    }}
                    className="flex-1 bg-slate-200 text-slate-700 py-2 rounded-lg hover:bg-slate-300 transition font-medium"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
