import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, Message } from '../lib/supabase';
import { MessageSquare, LogOut, Image, FileText, User, Clock, Phone, RefreshCw } from 'lucide-react';

export default function CompanyDashboard() {
  const { company, signOut } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchMessages();

    const channel = supabase
      .channel('messages-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `apikey_instancia=eq.${company?.api_key}`,
        },
        () => {
          fetchMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [company?.api_key]);

  const fetchMessages = async () => {
    if (!company) return;

    setRefreshing(true);
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('apikey_instancia', company.api_key)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setMessages(data);
    }
    setLoading(false);
    setRefreshing(false);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleString('pt-BR');
    } catch {
      return dateString;
    }
  };

  const getMessageTypeIcon = (type: string | null) => {
    if (type?.includes('image')) return <Image className="w-4 h-4" />;
    if (type?.includes('document') || type?.includes('pdf')) return <FileText className="w-4 h-4" />;
    return <MessageSquare className="w-4 h-4" />;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin mx-auto mb-2" />
          <p className="text-slate-600">Carregando mensagens...</p>
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
                <MessageSquare className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-800">{company?.name}</h1>
                <p className="text-sm text-slate-600">Mensagens do WhatsApp</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => fetchMessages()}
                disabled={refreshing}
                className="flex items-center gap-2 px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                Atualizar
              </button>
              <button
                onClick={() => signOut()}
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
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-4 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-slate-800">{messages.length}</p>
                <p className="text-sm text-slate-600">Total de Mensagens</p>
              </div>
              <div className="h-12 w-px bg-slate-200"></div>
              <div className="text-sm text-slate-600">
                <p><strong>Empresa:</strong> {company?.name}</p>
                <p><strong>API Key:</strong> <span className="font-mono text-xs">{company?.api_key}</span></p>
              </div>
            </div>
          </div>
        </div>

        {messages.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
            <MessageSquare className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Nenhuma mensagem encontrada</h3>
            <p className="text-slate-600">As mensagens do WhatsApp aparecerão aqui quando chegarem</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 hover:shadow-md transition"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${msg.minha === 'true' ? 'bg-emerald-100' : 'bg-blue-100'}`}>
                      {getMessageTypeIcon(msg.tipomessage)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-slate-800">{msg.pushname || 'Desconhecido'}</h3>
                        <span className={`text-xs px-2 py-1 rounded ${msg.minha === 'true' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                          {msg.minha === 'true' ? 'Enviada' : 'Recebida'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-600 mt-1">
                        <Phone className="w-3 h-3" />
                        {msg.sender || msg.number || msg.numero}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Clock className="w-4 h-4" />
                    {formatDate(msg.date_time || msg.created_at)}
                  </div>
                </div>

                {msg.message && (
                  <div className="bg-slate-50 rounded-lg p-4 mb-3">
                    <p className="text-slate-700 whitespace-pre-wrap">{msg.message}</p>
                  </div>
                )}

                {msg.urlimagem && (
                  <div className="mb-3">
                    <img
                      src={msg.urlimagem}
                      alt="Imagem da mensagem"
                      className="rounded-lg max-w-sm max-h-64 object-cover"
                    />
                  </div>
                )}

                {msg.urlpdf && (
                  <div className="mb-3">
                    <a
                      href={msg.urlpdf}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-emerald-600 hover:text-emerald-700 font-medium"
                    >
                      <FileText className="w-4 h-4" />
                      Ver PDF
                    </a>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                  {msg.tipomessage && (
                    <span className="bg-slate-100 px-2 py-1 rounded">Tipo: {msg.tipomessage}</span>
                  )}
                  {msg.instancia && (
                    <span className="bg-slate-100 px-2 py-1 rounded">Instância: {msg.instancia}</span>
                  )}
                  {msg.idmessage && (
                    <span className="bg-slate-100 px-2 py-1 rounded font-mono">ID: {msg.idmessage.substring(0, 20)}...</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
