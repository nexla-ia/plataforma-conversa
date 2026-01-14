import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { supabase, Company } from "../lib/supabase";
import { LogOut, Plus, Building, RefreshCw } from "lucide-react";

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
    api_key: "",
    createUser: true,
    user_id: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    setRefreshing(true);
    const { data, error } = await supabase
      .from("companies")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setCompanies(data);
    }
    setLoading(false);
    setRefreshing(false);
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError(null);

    try {
      let userId = formData.user_id;

      if (formData.createUser) {
        // Tentar criar usuário
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
        });

        if (signUpError) {
          if (signUpError.message.includes("User already registered")) {
            throw new Error("Usuário já existe. Desmarque 'Criar novo usuário' e insira o User ID manualmente.");
          }
          throw signUpError;
        }

        if (!signUpData.user) throw new Error("Falha ao criar usuário");

        userId = signUpData.user.id;

        // Confirmar email automaticamente
        await supabase.rpc('confirm_user_email', { user_id: userId }).catch(() => {
          console.log("Função confirm_user_email não existe ou falhou");
        });
      }

      // Inserir empresa
      const { data, error } = await supabase
        .from("companies")
        .insert({
          name: formData.name,
          email: formData.email,
          phone_number: formData.phone_number,
          api_key: formData.api_key,
          user_id: userId,
          is_super_admin: false,
        })
        .select()
        .single();

      if (error) throw error;

      setFormData({ email: "", password: "", name: "", phone_number: "", api_key: "", createUser: true, user_id: "" });
      setShowCreateForm(false);
      fetchCompanies();
    } catch (error: any) {
      console.error("Erro ao criar empresa:", error);
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
        <div className="grid gap-6">
          {companies.map((company) => (
            <div key={company.id} className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-800">{company.name}</h3>
                  <p className="text-slate-600">{company.email}</p>
                  <p className="text-sm text-slate-500">API Key: {company.api_key}</p>
                  <p className="text-sm text-slate-500">Telefone: {company.phone_number}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-500">
                    Criado em: {new Date(company.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Criar Nova Empresa</h2>
            {error && <p className="text-red-500 mb-4">{error}</p>}
            <form onSubmit={handleCreateCompany} className="space-y-4">
              <input
                type="email"
                placeholder="Email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                required
              />
              <input
                type="password"
                placeholder="Senha"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.createUser}
                  onChange={(e) => setFormData({ ...formData, createUser: e.target.checked })}
                  className="mr-2"
                />
                Criar novo usuário com este email
              </label>
              {!formData.createUser && (
                <input
                  type="text"
                  placeholder="User ID (do usuário existente)"
                  value={formData.user_id || ""}
                  onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  required={!formData.createUser}
                />
              )}
              <input
                type="text"
                placeholder="Nome da Empresa"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                required
              />
              <input
                type="text"
                placeholder="Telefone"
                value={formData.phone_number}
                onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                required
              />
              <input
                type="text"
                placeholder="API Key"
                value={formData.api_key}
                onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                required
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 bg-emerald-500 text-white py-2 rounded-lg hover:bg-emerald-600 disabled:opacity-50"
                >
                  {creating ? "Criando..." : "Criar"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="flex-1 bg-slate-300 text-slate-700 py-2 rounded-lg hover:bg-slate-400"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
