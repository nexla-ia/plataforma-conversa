import { useState } from "react";
import { supabase } from "../lib/supabase";
import { Eye, EyeOff } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        if (error.message?.toLowerCase().includes("email not confirmed")) {
          setErrorMsg("Email não confirmado. Confirme o email ou desative a confirmação no Supabase (dev).");
        } else if (error.message?.toLowerCase().includes("invalid login credentials")) {
          setErrorMsg("Email ou senha inválidos.");
        } else {
          setErrorMsg(error.message);
        }
        setLoading(false);
        return;
      }

      // O AuthContext vai cuidar do loading de 5 segundos automaticamente
    } catch (err: any) {
      setErrorMsg(err?.message ?? "Erro inesperado ao fazer login.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 via-slate-50 to-slate-100 p-4 relative overflow-hidden">
      <style>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-20px);
          }
        }

        .float-shape {
          animation: float 6s ease-in-out infinite;
        }
      `}</style>

      {/* Decorative Background Shapes */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-teal-300 rounded-full opacity-40 blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-yellow-300 rounded-full opacity-40 blur-3xl translate-x-1/3 translate-y-1/3"></div>
      <div className="absolute bottom-20 right-20 w-64 h-64 bg-teal-400 rounded-full opacity-30 blur-2xl"></div>

      <div className="w-full max-w-5xl bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row relative z-10">
        {/* Left Side - Login Form */}
        <div className="w-full md:w-1/2 p-12 md:p-16 flex flex-col justify-center">
          <div>
            <h1 className="text-5xl font-bold text-teal-600 mb-12 tracking-tight">WELCOME</h1>

            {errorMsg && (
              <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2 tracking-wide uppercase">
                  Username
                </label>
                <input
                  type="email"
                  className="w-full border-b-2 border-gray-300 px-0 py-2 text-gray-600 placeholder-gray-400 outline-none focus:border-teal-500 transition-colors bg-transparent"
                  placeholder="usuario@exemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2 tracking-wide uppercase">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    className="w-full border-b-2 border-gray-300 px-0 py-2 pr-10 text-gray-600 placeholder-gray-400 outline-none focus:border-teal-500 transition-colors bg-transparent"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-0 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm pt-2">
                <label className="flex items-center gap-2 text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 accent-teal-600"
                  />
                  <span>Remember</span>
                </label>
                <button type="button" className="text-gray-500 hover:text-gray-700 font-medium">
                  Forgot Password?
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-yellow-400 text-gray-800 py-3 px-6 font-bold text-base hover:bg-yellow-500 disabled:opacity-60 shadow-md hover:shadow-lg transition-all transform hover:scale-[1.02] mt-8"
              >
                {loading ? "LOADING..." : "SUBMIT"}
              </button>
            </form>

            <p className="text-center text-xs text-gray-400 mt-8">
              Plataforma Multicanal de Atendimento
            </p>
          </div>
        </div>

        {/* Right Side - Illustration */}
        <div className="w-full md:w-1/2 p-12 md:p-16 flex items-center justify-center relative">
          <div className="relative">
            {/* Phone/Card Device */}
            <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-3xl p-6 shadow-2xl w-72 relative float-shape">
              {/* Three dots menu */}
              <div className="flex gap-2 mb-6">
                <div className="w-2 h-2 bg-white/60 rounded-full"></div>
                <div className="w-2 h-2 bg-white/60 rounded-full"></div>
                <div className="w-2 h-2 bg-white/60 rounded-full"></div>
              </div>

              {/* White card content */}
              <div className="bg-white rounded-2xl p-8 text-center shadow-lg">
                {/* Lock icon with background */}
                <div className="mx-auto w-24 h-24 bg-teal-100 rounded-2xl flex items-center justify-center mb-6">
                  <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                    <rect x="10" y="18" width="20" height="16" rx="2" fill="#14B8A6" stroke="#14B8A6" strokeWidth="2"/>
                    <path d="M14 18V12C14 8.68629 16.6863 6 20 6C23.3137 6 26 8.68629 26 12V18" stroke="#14B8A6" strokeWidth="2" strokeLinecap="round"/>
                    <circle cx="20" cy="26" r="2" fill="white"/>
                  </svg>
                </div>

                <h2 className="text-3xl font-bold text-teal-600 mb-2">WELCOME</h2>
                <p className="text-gray-500 text-sm">NEXLA Platform</p>
              </div>
            </div>

            {/* Yellow circle with monitor icon */}
            <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-yellow-400 rounded-full shadow-xl flex items-center justify-center">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <rect x="8" y="10" width="32" height="22" rx="2" fill="#1F2937" stroke="#1F2937" strokeWidth="2"/>
                <rect x="11" y="13" width="26" height="16" fill="#059669"/>
                <line x1="24" y1="32" x2="24" y2="38" stroke="#1F2937" strokeWidth="2"/>
                <line x1="16" y1="38" x2="32" y2="38" stroke="#1F2937" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
