import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { Menu, X, Building2, Plus, LogOut } from "lucide-react";

type Company = {
  id: string;
  api_key: string;
  name: string;
  phone_number: string;
  email: string;
  user_id: string | null;
  is_super_admin?: boolean | null;
  created_at?: string;
};

export default function SuperAdminDashboard() {
  const [userEmail, setUserEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);

  // form
  const [name, setName] = useState("");
  const [phone_number, setPhoneNumber] = useState("");
  const [api_key, setApiKey] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // =========================
  // Formatação de Telefone
  // =========================
  const formatPhoneNumber = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 10) {
      return numbers
        .replace(/(\d{2})(\d)/, "($1) $2")
        .replace(/(\d{4})(\d)/, "$1-$2");
    }
    return numbers
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{5})(\d)/, "$1-$2")
      .slice(0, 15);
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhoneNumber(formatted);
  };

  const generateApiKey = () => {
    const uuid = crypto.randomUUID();
    setApiKey(uuid);
  };

  // =========================
  // Load user + companies + messages
  // =========================
  useEffect(() => {
    (async () => {
      setLoading(true);
      setErrorMsg(null);

      const {
        data: { session },
        error: sessErr,
      } = await supabase.auth.getSession();

      if (sessErr) {
        setErrorMsg(sessErr.message);
        setLoading(false);
        return;
      }

      if (!session?.user) {
        setErrorMsg("Sem sessão. Faça login novamente.");
        setLoading(false);
        return;
      }

      setUserEmail(session.user.email ?? "");
      setUserId(session.user.id);

      await loadCompanies();
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const companiesInterval = setInterval(() => {
      loadCompanies();
    }, 1000);

    const companiesChannel = supabase
      .channel('super-admin-companies')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'companies',
        },
        () => {
          loadCompanies();
        }
      )
      .subscribe();

    return () => {
      clearInterval(companiesInterval);
      supabase.removeChannel(companiesChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadCompanies = async () => {
    setErrorMsg(null);

    const { data, error } = await supabase
      .from("companies")
      .select("id,api_key,name,phone_number,email,user_id,is_super_admin,created_at")
      .order("created_at", { ascending: false });

    if (error) {
      setErrorMsg(error.message);
      setCompanies([]);
      return;
    }

    setCompanies((data as Company[]) || []);
  };

  // =========================
  // Create company
  // =========================
  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (
      !name.trim() ||
      !phone_number.trim() ||
      !api_key.trim() ||
      !email.trim() ||
      !password.trim()
    ) {
      setErrorMsg("Preencha todos os campos.");
      return;
    }

    const phoneNumbers = phone_number.replace(/\D/g, "");
    if (phoneNumbers.length < 10) {
      setErrorMsg("Telefone deve ter pelo menos 10 dígitos.");
      return;
    }

    if (password.length < 6) {
      setErrorMsg("Senha deve ter no mínimo 6 caracteres.");
      return;
    }

    setCreating(true);

    try {
      const {
        data: { session },
        error: sessErr,
      } = await supabase.auth.getSession();

      if (sessErr) throw sessErr;
      if (!session?.access_token) {
        throw new Error("Sem token. Faça login novamente.");
      }

      console.log("SESSION:", session);
      console.log("ACCESS_TOKEN:", session?.access_token?.slice(0, 30));

      const response = await supabase.functions.invoke("create-company", {
        body: {
          email: email.trim().toLowerCase(),
          password,
          name: name.trim(),
          phone_number: phone_number.trim(),
          api_key: api_key.trim(),
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      console.log("Response completo:", response);

      if (response.error) {
        console.error("Erro create-company:", response.error);
        const errorDetails = response.data?.error || response.data?.details || response.error.message;
        throw new Error(errorDetails || "Erro ao criar empresa.");
      }

      console.log("Empresa criada:", response.data);

      // limpa e fecha
      setShowForm(false);
      setName("");
      setPhoneNumber("");
      setApiKey("");
      setEmail("");
      setPassword("");

      // recarrega lista
      await loadCompanies();
    } catch (err: any) {
      console.error("handleCreateCompany:", err);
      setErrorMsg(err?.message ?? "Erro inesperado.");
    } finally {
      setCreating(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  const handleDeleteCompany = async (companyId: string, companyName: string) => {
    if (!confirm(`Tem certeza que deseja deletar a empresa "${companyName}"? Esta ação não pode ser desfeita.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('companies')
        .delete()
        .eq('id', companyId);

      if (error) {
        console.error('Erro ao deletar empresa:', error);
        setErrorMsg('Erro ao deletar empresa: ' + error.message);
        return;
      }

      await loadCompanies();
    } catch (err: any) {
      console.error('Erro ao deletar empresa:', err);
      setErrorMsg('Erro ao deletar empresa: ' + err.message);
    }
  };
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-gray-100">
        <div className="text-center">
          <div className="text-4xl font-bold bg-gradient-to-r from-teal-500 to-teal-600 bg-clip-text text-transparent mb-4">
            NEXLA
          </div>
          <div className="text-gray-600 animate-pulse">Carregando...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 flex">
      <aside
        className={`${
          sidebarOpen ? "w-64" : "w-20"
        } bg-white/80 backdrop-blur-xl border-r border-gray-200/50 transition-all duration-300 flex flex-col relative shadow-lg`}
      >
        <div className="p-6 border-b border-gray-200/50">
          <div className="flex items-center justify-between">
            {sidebarOpen ? (
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-teal-500 to-teal-600 bg-clip-text text-transparent">
                  NEXLA
                </h1>
                <p className="text-xs text-gray-500 mt-1">Admin Portal</p>
              </div>
            ) : (
              <div className="text-2xl font-bold bg-gradient-to-r from-teal-500 to-teal-600 bg-clip-text text-transparent">
                N
              </div>
            )}
          </div>
        </div>

        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute -right-3 top-20 bg-white border border-teal-400/40 rounded-full p-1.5 text-teal-500 hover:bg-teal-50 transition-colors shadow-md"
        >
          {sidebarOpen ? <X size={16} /> : <Menu size={16} />}
        </button>

        <nav className="flex-1 p-4 space-y-2">
          <button
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 bg-gradient-to-r from-teal-50 to-teal-100/50 text-teal-600 border border-teal-200 shadow-sm"
          >
            <Building2 size={20} />
            {sidebarOpen && (
              <div className="flex-1 text-left">
                <div className="font-medium">Empresas</div>
                <div className="text-xs opacity-70">{companies.length} cadastradas</div>
              </div>
            )}
          </button>
        </nav>

        <div className="p-4 border-t border-gray-200/50">
          <div className={`${sidebarOpen ? "" : "flex justify-center"}`}>
            {sidebarOpen && (
              <div className="mb-3">
                <div className="text-xs text-gray-500 mb-1">Logado como</div>
                <div className="text-sm text-gray-700 truncate">{userEmail}</div>
              </div>
            )}
            <button
              onClick={handleLogout}
              className={`${
                sidebarOpen ? "w-full" : ""
              } flex items-center gap-2 px-4 py-2 rounded-lg text-gray-600 hover:text-red-500 hover:bg-red-50 border border-gray-200 hover:border-red-200 transition-all`}
            >
              <LogOut size={18} />
              {sidebarOpen && <span>Sair</span>}
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="p-8">
          {errorMsg && (
            <div className="mb-6 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 backdrop-blur-sm">
              {errorMsg}
            </div>
          )}

          {activeTab === "empresas" && (
            <>
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-2">Empresas Cadastradas</h2>
                  <p className="text-gray-600">Gerencie todas as empresas do sistema</p>
                </div>

                <button
                  onClick={() => setShowForm(true)}
                  className="flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-teal-500 to-teal-600 text-white font-medium hover:from-teal-600 hover:to-teal-700 transition-all shadow-lg"
                >
                  <Plus size={20} />
                  Nova Empresa
                </button>
              </div>

              {showForm && (
                <div className="mb-8 rounded-2xl bg-white/80 border border-teal-200/50 p-6 backdrop-blur-sm shadow-lg">
                  <h3 className="text-xl font-semibold text-gray-900 mb-6">
                    Cadastrar Nova Empresa
                  </h3>

                  <form onSubmit={handleCreateCompany} className="grid gap-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-700 mb-2">
                          Nome da Empresa
                        </label>
                        <input
                          required
                          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Ex: Minha Empresa"
                        />
                      </div>

                      <div>
                        <label className="block text-sm text-gray-700 mb-2">
                          Número de Telefone
                        </label>
                        <input
                          required
                          type="tel"
                          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                          value={phone_number}
                          onChange={handlePhoneChange}
                          placeholder="(69) 99999-9999"
                          maxLength={15}
                        />
                      </div>

                      <div>
                        <label className="block text-sm text-gray-700 mb-2">
                          Chave API
                        </label>
                        <div className="flex gap-2">
                          <input
                            required
                            className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 font-mono text-sm"
                            value={api_key}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="UUID/chave"
                          />
                          <button
                            type="button"
                            onClick={generateApiKey}
                            className="rounded-lg bg-gray-100 px-4 py-2 text-gray-700 text-sm hover:bg-gray-200 border border-gray-300 transition-colors"
                          >
                            Gerar
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm text-gray-700 mb-2">
                          Email
                        </label>
                        <input
                          required
                          type="email"
                          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="empresa@dominio.com"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm text-gray-700 mb-2">
                        Senha <span className="text-gray-500 text-xs">(mínimo 6 caracteres)</span>
                      </label>
                      <input
                        required
                        type="password"
                        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="********"
                        minLength={6}
                      />
                    </div>

                    <div className="flex items-center gap-3 mt-4">
                      <button
                        type="submit"
                        disabled={creating}
                        className="rounded-lg bg-gradient-to-r from-teal-500 to-teal-600 px-6 py-2.5 text-white font-medium hover:from-teal-600 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
                      >
                        {creating ? "Cadastrando..." : "Cadastrar Empresa"}
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowForm(false)}
                        className="rounded-lg border border-gray-300 px-6 py-2.5 text-gray-700 hover:bg-gray-100 transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {companies.length === 0 && (
                  <div className="col-span-full text-center py-16 text-gray-500">
                    Nenhuma empresa cadastrada.
                  </div>
                )}

                {companies.map((c, index) => (
                  <div
                    key={c.id}
                    className="group rounded-xl bg-white/80 border border-teal-200/50 p-6 hover:border-teal-300 hover:shadow-lg transition-all backdrop-blur-sm hover:scale-105 animate-fadeIn"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="text-xl font-semibold text-gray-900">{c.name}</div>
                      <div className="flex items-center gap-2">
                        {c.is_super_admin && (
                          <span className="text-xs px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-100 to-orange-100 text-amber-700 border border-amber-300 font-medium">
                            Admin
                          </span>
                        )}
                        {!c.is_super_admin && (
                          <button
                            onClick={() => handleDeleteCompany(c.id, c.name)}
                            className="p-2 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Deletar empresa"
                          >
                            <X size={18} />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3 text-sm">
                      <div className="flex items-center gap-3 text-gray-700">
                        <span className="text-teal-600">📞</span>
                        <span>{c.phone_number}</span>
                      </div>
                      <div className="flex items-center gap-3 text-gray-700">
                        <span className="text-teal-600">✉️</span>
                        <span className="break-all">{c.email}</span>
                      </div>
                      <div className="flex items-start gap-3 mt-4 pt-4 border-t border-gray-200">
                        <span className="text-teal-600">🔑</span>
                        <span className="break-all text-xs font-mono text-gray-600 bg-gray-50 px-2 py-1 rounded">
                          {c.api_key}
                        </span>
                      </div>
                      {c.user_id && (
                        <div className="flex items-start gap-3 pt-2 border-t border-gray-200">
                          <span className="text-teal-600">👤</span>
                          <span className="break-all text-xs font-mono text-gray-600">
                            {c.user_id}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
