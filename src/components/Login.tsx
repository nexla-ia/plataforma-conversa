import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);

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
        if (error.message?.toLowerCase().includes("email not confirmed")) {
          setErrorMsg("Email não confirmado. Confirme o email ou desative a confirmação no Supabase (dev).");
        } else if (error.message?.toLowerCase().includes("invalid login credentials")) {
          setErrorMsg("Email ou senha inválidos.");
        } else {
          setErrorMsg(error.message);
        }
        return;
      }

      if (data?.session) {
        window.location.href = "/";
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 p-4 relative overflow-hidden">
      <style>{`
        @keyframes paperPlane {
          0% {
            transform: translate(0, 0) rotate(-15deg);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          50% {
            transform: translate(300px, -150px) rotate(5deg);
          }
          90% {
            opacity: 1;
          }
          100% {
            transform: translate(600px, -80px) rotate(25deg);
            opacity: 0;
          }
        }

        @keyframes floatPerson1 {
          0%, 100% {
            transform: translateY(0px) rotate(-2deg);
          }
          50% {
            transform: translateY(-8px) rotate(2deg);
          }
        }

        @keyframes floatPerson2 {
          0%, 100% {
            transform: translateY(0px) rotate(1deg);
          }
          50% {
            transform: translateY(-6px) rotate(-1deg);
          }
        }

        @keyframes floatGear {
          0%, 100% {
            transform: translateY(0px) rotate(0deg);
          }
          50% {
            transform: translateY(-10px) rotate(180deg);
          }
        }

        @keyframes floatPlant {
          0%, 100% {
            transform: translateX(0px) scale(1);
          }
          50% {
            transform: translateX(5px) scale(1.05);
          }
        }

        .paper-plane {
          animation: paperPlane 4s ease-in-out infinite;
        }

        .person-1 {
          animation: floatPerson1 3s ease-in-out infinite;
        }

        .person-2 {
          animation: floatPerson2 3.5s ease-in-out infinite;
        }

        .float-gear {
          animation: floatGear 4s ease-in-out infinite;
        }

        .float-plant {
          animation: floatPlant 2.5s ease-in-out infinite;
        }

        .dashed-path {
          stroke-dasharray: 8 8;
        }
      `}</style>

      <div className="w-full max-w-6xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row">
        {/* Left Side - Login Form */}
        <div className="w-full md:w-1/2 bg-gradient-to-br from-cyan-500 via-cyan-400 to-blue-400 p-12 flex flex-col justify-center relative">
          <div className="relative z-10">
            <h1 className="text-5xl font-bold text-white mb-2 tracking-tight">WELCOME</h1>
            <p className="text-cyan-50 mb-8 text-sm">Entre com suas credenciais</p>

            {errorMsg && (
              <div className="mb-6 rounded-xl bg-red-500/20 backdrop-blur-sm border border-red-300/30 px-4 py-3 text-sm text-white">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <input
                  type="email"
                  className="w-full rounded-full bg-white px-6 py-4 text-slate-800 placeholder-slate-400 outline-none focus:ring-4 focus:ring-white/30 transition-all text-center font-medium"
                  placeholder="Username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>

              <div>
                <input
                  type="password"
                  className="w-full rounded-full bg-white px-6 py-4 text-slate-800 placeholder-slate-400 outline-none focus:ring-4 focus:ring-white/30 transition-all text-center font-medium tracking-widest"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>

              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 text-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded accent-cyan-600"
                  />
                  <span>Remember</span>
                </label>
                <button type="button" className="text-cyan-900 hover:text-cyan-950 font-medium">
                  Forgot Password ?
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-full bg-gradient-to-r from-emerald-400 to-green-500 text-white py-4 font-bold text-lg hover:from-emerald-500 hover:to-green-600 disabled:opacity-60 shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
              >
                {loading ? "LOADING..." : "SUBMIT"}
              </button>
            </form>
          </div>
        </div>

        {/* Right Side - Illustration */}
        <div className="w-full md:w-1/2 bg-gradient-to-br from-slate-50 to-slate-100 p-12 flex items-center justify-center relative overflow-hidden">
          {/* Paper Plane with Dashed Path */}
          <svg className="absolute top-20 left-10 paper-plane" width="60" height="60" viewBox="0 0 60 60" fill="none">
            <path d="M10 30L50 10L40 50L30 35L10 30Z" fill="#06B6D4" stroke="#0891B2" strokeWidth="2"/>
          </svg>

          {/* Dashed Trail Path */}
          <svg className="absolute top-16 left-0 w-full h-full pointer-events-none" viewBox="0 0 600 800">
            <path
              className="dashed-path"
              d="M 100 180 Q 250 80, 450 150"
              stroke="#94A3B8"
              strokeWidth="3"
              fill="none"
            />
          </svg>

          {/* Gear Elements */}
          <svg className="absolute top-32 right-20 float-gear opacity-20" width="50" height="50" viewBox="0 0 50 50" fill="#64748B">
            <circle cx="25" cy="25" r="8" fill="#64748B"/>
            <path d="M25 5 L28 15 L25 20 L22 15 Z M45 25 L35 28 L30 25 L35 22 Z M25 45 L22 35 L25 30 L28 35 Z M5 25 L15 22 L20 25 L15 28 Z" fill="#64748B"/>
          </svg>

          <svg className="absolute bottom-32 left-20 float-gear opacity-20" width="40" height="40" viewBox="0 0 50 50" fill="#64748B">
            <circle cx="25" cy="25" r="6" fill="#64748B"/>
            <path d="M25 8 L27 18 L25 22 L23 18 Z M42 25 L32 27 L28 25 L32 23 Z M25 42 L23 32 L25 28 L27 32 Z M8 25 L18 23 L22 25 L18 27 Z" fill="#64748B"/>
          </svg>

          {/* Main Illustration Container */}
          <div className="relative w-full max-w-md">
            {/* Phone Frame */}
            <div className="relative">
              <div className="bg-slate-800 rounded-3xl p-4 shadow-2xl border-8 border-slate-900">
                <div className="bg-gradient-to-br from-cyan-400 to-blue-500 rounded-2xl p-8 aspect-[3/4] flex flex-col items-center justify-center">
                  {/* User Icon */}
                  <div className="bg-white rounded-full p-6 mb-6 shadow-lg">
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                      <circle cx="24" cy="16" r="8" fill="#334155"/>
                      <path d="M8 40C8 31 15 28 24 28C33 28 40 31 40 40" fill="#334155"/>
                    </svg>
                  </div>

                  {/* Password Fields */}
                  <div className="w-full space-y-3 mb-8">
                    <div className="bg-white rounded-lg py-3 px-4 flex items-center justify-center">
                      <div className="flex gap-1">
                        {Array(6).fill(0).map((_, i) => (
                          <div key={i} className="w-2 h-2 bg-slate-800 rounded-full"></div>
                        ))}
                      </div>
                    </div>
                    <div className="bg-white rounded-lg py-3 px-4 flex items-center justify-center">
                      <div className="flex gap-1">
                        {Array(8).fill(0).map((_, i) => (
                          <div key={i} className="w-2 h-2 bg-slate-800 rounded-full"></div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="w-full bg-gradient-to-r from-emerald-400 to-green-500 rounded-lg py-3 shadow-lg"></div>
                </div>
              </div>
            </div>

            {/* Person 1 - Standing */}
            <div className="absolute -left-16 bottom-12 person-1">
              <svg width="80" height="120" viewBox="0 0 80 120" fill="none">
                {/* Body */}
                <ellipse cx="40" cy="95" rx="15" ry="8" fill="#334155"/>
                <rect x="32" y="60" width="16" height="35" rx="8" fill="#334155"/>
                {/* Shirt */}
                <path d="M25 55 L40 50 L55 55 L55 75 L25 75 Z" fill="#10B981"/>
                {/* Arms */}
                <rect x="18" y="55" width="8" height="25" rx="4" fill="#10B981"/>
                <rect x="54" y="55" width="8" height="25" rx="4" fill="#10B981"/>
                {/* Hand pointing */}
                <circle cx="58" cy="70" r="5" fill="#F5C6A5"/>
                <circle cx="22" cy="70" r="5" fill="#F5C6A5"/>
                {/* Head */}
                <circle cx="40" cy="35" r="18" fill="#F5C6A5"/>
                {/* Hair */}
                <path d="M25 25 Q40 15 55 25 L55 35 Q40 30 25 35 Z" fill="#1F2937"/>
              </svg>
            </div>

            {/* Person 2 - Sitting */}
            <div className="absolute -right-12 bottom-4 person-2">
              <svg width="90" height="100" viewBox="0 0 90 100" fill="none">
                {/* Legs crossed */}
                <ellipse cx="45" cy="85" rx="25" ry="10" fill="#334155"/>
                <rect x="30" y="65" width="12" height="20" rx="6" fill="#334155"/>
                <rect x="48" y="65" width="12" height="20" rx="6" fill="#334155"/>
                {/* Body sitting */}
                <rect x="35" y="40" width="20" height="30" rx="10" fill="#10B981"/>
                {/* Arms */}
                <rect x="25" y="45" width="8" height="20" rx="4" fill="#10B981"/>
                <rect x="57" y="45" width="8" height="20" rx="4" fill="#10B981"/>
                {/* Hands */}
                <circle cx="29" cy="62" r="5" fill="#F5C6A5"/>
                <circle cx="61" cy="62" r="5" fill="#F5C6A5"/>
                {/* Head */}
                <circle cx="45" cy="25" r="15" fill="#F5C6A5"/>
                {/* Hair */}
                <path d="M32 18 Q45 10 58 18 L58 28 Q45 24 32 28 Z" fill="#1F2937"/>
              </svg>
            </div>

            {/* Plant Decoration */}
            <div className="absolute -right-8 bottom-0 float-plant">
              <svg width="60" height="80" viewBox="0 0 60 80" fill="none">
                <rect x="25" y="50" width="10" height="30" fill="#94A3B8"/>
                <ellipse cx="30" cy="50" rx="15" ry="20" fill="#059669"/>
                <ellipse cx="20" cy="45" rx="12" ry="18" fill="#10B981"/>
                <ellipse cx="40" cy="45" rx="12" ry="18" fill="#10B981"/>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
