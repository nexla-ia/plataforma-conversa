import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { MessageCircle, User, Clock, LogOut } from 'lucide-react';

interface Message {
  id: number;
  numero: string | null;
  pushname: string | null;
  tipomessage: string | null;
  message: string | null;
  timestamp: string | null;
  created_at: string;
}

export default function AttendantDashboard() {
  const { attendant, company, signOut } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (attendant && company) {
      fetchMessages();
      subscribeToMessages();
    }
  }, [attendant, company]);

  const fetchMessages = async () => {
    if (!company?.api_key) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('apikey_instancia', company.api_key)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToMessages = () => {
    if (!company?.api_key) return;

    const channel = supabase
      .channel('attendant-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `apikey_instancia=eq.${company.api_key}`,
        },
        (payload) => {
          setMessages((prev) => [payload.new as Message, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const formatDate = (timestamp: string | null, created_at: string) => {
    const dateStr = timestamp || created_at;
    if (!dateStr) return '';

    try {
      const date = new Date(parseInt(timestamp || '0') || created_at);
      return date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando mensagens...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200/50 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Bem-vindo, {attendant?.name}
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                {company?.name} - Atendente
              </p>
            </div>
            <button
              onClick={() => signOut()}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-br from-red-500 to-red-600 text-white rounded-xl hover:from-red-600 hover:to-red-700 transition-all shadow-md"
            >
              <LogOut className="w-5 h-5" />
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50">
            <div className="flex items-center gap-3 mb-4">
              <MessageCircle className="w-6 h-6 text-teal-600" />
              <h2 className="text-xl font-bold text-gray-900">
                Mensagens Recentes
              </h2>
            </div>

            {messages.length === 0 ? (
              <div className="text-center py-12">
                <MessageCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Nenhuma mensagem encontrada</p>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className="bg-white rounded-xl p-4 border border-gray-200/50 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <User className="w-5 h-5 text-gray-400" />
                        <span className="font-medium text-gray-900">
                          {msg.pushname || msg.numero || 'Desconhecido'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Clock className="w-3 h-3" />
                        {formatDate(msg.timestamp, msg.created_at)}
                      </div>
                    </div>

                    <div className="ml-7">
                      {msg.tipomessage && (
                        <span className="inline-block px-2 py-1 text-xs font-medium bg-teal-100 text-teal-700 rounded-lg mb-2">
                          {msg.tipomessage}
                        </span>
                      )}

                      {msg.message && (
                        <p className="text-gray-700 text-sm break-words">
                          {msg.message}
                        </p>
                      )}

                      {msg.numero && (
                        <p className="text-xs text-gray-500 mt-2">
                          Número: {msg.numero}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
