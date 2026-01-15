import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase"; // ✅ ajuste o caminho se necessário

type Company = {
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
  // Load user + companies
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

      await loadCompanies(session.user.id);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadCompanies = async (uid?: string) => {
    setErrorMsg(null);

    const query = supabase
      .from("companies")
      .select("api_key,name,phone_number,email,user_id,is_super_admin,created_at")
      .order("created_at", { ascending: false });

    // Se você quiser listar só as empresas do usuário logado:
    if (uid) query.eq("user_id", uid);

    const { data, error } = await query;

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

      const { data, error } = await supabase.functions.invoke("create-company", {
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

      if (error) {
        console.error("Erro create-company:", error);
        throw new Error(error.message || "Erro ao criar empresa.");
      }

      console.log("Empresa criada:", data);

      // limpa e fecha
      setShowForm(false);
      setName("");
      setPhoneNumber("");
      setApiKey("");
      setEmail("");
      setPassword("");

      // recarrega lista
      setLoading(true);
      await loadCompanies(session.user.id);
      setLoading(false);
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

  // =========================
  // UI
  // =========================
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-600">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200">
        <div>
          <div className="text-lg font-semibold text-slate-900">Super Admin</div>
          <div className="text-sm text-slate-500">Gerenciamento de Empresas</div>
          <div className="text-xs text-slate-400 mt-1">
            {userEmail} • {userId}
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="rounded-lg border border-slate-200 px-4 py-2 text-slate-700 hover:bg-slate-100"
        >
          Sair
        </button>
      </header>

      <main className="px-6 py-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-slate-900">Empresas Cadastradas</h2>

          <button
            onClick={() => setShowForm(true)}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-white font-medium hover:bg-emerald-700"
          >
            + Nova Empresa
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMsg}
          </div>
        )}

        {showForm && (
          <div className="mb-6 rounded-xl bg-white border border-slate-200 p-4">
            <h3 className="text-lg font-semibold text-slate-900 mb-3">
              Cadastrar Nova Empresa
            </h3>

            <form onSubmit={handleCreateCompany} className="grid gap-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-slate-700 mb-1">
                    Nome da Empresa
                  </label>
                  <input
                    required
                    className="w-full rounded-lg border border-slate-200 px-3 py-2"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Minha Empresa"
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-700 mb-1">
                    Número de Telefone
                  </label>
                  <input
                    required
                    type="tel"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2"
                    value={phone_number}
                    onChange={handlePhoneChange}
                    placeholder="(69) 99999-9999"
                    maxLength={15}
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-700 mb-1">
                    Chave API
                  </label>
                  <div className="flex gap-2">
                    <input
                      required
                      className="flex-1 rounded-lg border border-slate-200 px-3 py-2"
                      value={api_key}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="UUID/chave"
                    />
                    <button
                      type="button"
                      onClick={generateApiKey}
                      className="rounded-lg bg-slate-600 px-3 py-2 text-white text-sm hover:bg-slate-700"
                    >
                      Gerar
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-slate-700 mb-1">
                    Email
                  </label>
                  <input
                    required
                    type="email"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="empresa@dominio.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-700 mb-1">
                  Senha <span className="text-slate-500 text-xs">(mínimo 6 caracteres)</span>
                </label>
                <input
                  required
                  type="password"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="********"
                  minLength={6}
                />
              </div>

              <div className="flex items-center gap-2 mt-2">
                <button
                  type="submit"
                  disabled={creating}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-white font-medium hover:bg-emerald-700 disabled:opacity-60"
                >
                  {creating ? "Cadastrando..." : "Cadastrar Empresa"}
                </button>

                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-slate-700 hover:bg-slate-100"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {companies.length === 0 && (
            <div className="text-slate-500">Nenhuma empresa cadastrada.</div>
          )}

          {companies.map((c) => (
            <div
              key={c.api_key} // ✅ key única
              className="rounded-xl bg-white border border-slate-200 p-4"
            >
              <div className="flex items-start justify-between">
                <div className="text-lg font-semibold text-slate-900">{c.name}</div>
                {c.is_super_admin ? (
                  <span className="text-xs px-2 py-1 rounded bg-amber-100 text-amber-800">
                    Admin
                  </span>
                ) : null}
              </div>

              <div className="mt-3 text-sm text-slate-600 space-y-1">
                <div>📞 {c.phone_number}</div>
                <div>✉️ {c.email}</div>
                <div className="break-all">🔑 {c.api_key}</div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
