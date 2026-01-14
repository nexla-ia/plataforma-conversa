import { useState } from "react";
import { supabase } from "../lib/supabase"; // ajuste o caminho se seu projeto usa outro

export default function Login() {  // cometi akiri 

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!email || !password) {
      setErrorMsg("Preencha email e senha.");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        // Mensagens amigáveis
        if (error.message?.toLowerCase().includes("email not confirmed")) {
          setErrorMsg("Email não confirmado. Confirme o email ou desative a confirmação no Supabase (dev).");
        } else if (error.message?.toLowerCase().includes("invalid login credentials")) {
          setErrorMsg("Email ou senha inválidos.");
        } else {
          setErrorMsg(error.message);
        }
        return;
      }

      // Se logou
      if (data?.session) {
        window.location.href = "/"; // ajuste a rota pós-login (ex: "/super-admin" ou "/dashboard")
      } else {
        setErrorMsg("Não foi possível iniciar sessão. Tente novamente.");
      }
    } catch (err: any) {
      setErrorMsg(err?.message ?? "Erro inesperado ao fazer login.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow p-6">
        <div className="text-center mb-6">
          <div className="mx-auto mb-3 h-12 w-12 rounded-xl bg-emerald-100 flex items-center justify-center">
            <span className="text-emerald-700 text-xl">⤴</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">WhatsApp Manager</h1>
          <p className="text-slate-500 text-sm">Faça login para acessar o sistema</p>
        </div>

        {errorMsg && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              type="email"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-200"
              placeholder="seuemail@dominio.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Senha</label>
            <input
              type="password"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-200"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-emerald-600 text-white py-2 font-medium hover:bg-emerald-700 disabled:opacity-60"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        {/* ✅ REMOVIDO: botão "Criar Super Admin Temporário" */}
        {/* ✅ REMOVIDO: handleRegisterTemp / invoke create-super-admin */}
      </div>
    </div>
  );
}
