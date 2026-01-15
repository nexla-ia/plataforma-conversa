import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, Message } from '../lib/supabase';
import { MessageSquare, LogOut, Image, FileText, User, Clock, Phone, RefreshCw, AlertCircle, MessageCircle } from 'lucide-react';
import ChatView from './ChatView';

export default function CompanyDashboard() {
  const { company, signOut } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'chat'>('chat');

  const fetchMessages = useCallback(async () => {
    if (!company) {
      setLoading(false);
      return;
    }

    setRefreshing(true);
    setError(null);

    const timeout = setTimeout(() => {
      setLoading(false);
      setRefreshing(false);
      setError('Tempo esgotado ao carregar mensagens');
    }, 10000);

    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('apikey_instancia', company.api_key)
        .order('created_at', { ascending: false });

      clearTimeout(timeout);

      if (error) {
        setError(`Erro ao carregar mensagens: ${error.message}`);
      } else if (data) {
        setMessages(data);
      }
    } catch (err: any) {
      clearTimeout(timeout);
      setError(`Erro ao carregar mensagens: ${err.message}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [company]);

  useEffect(() => {
    fetchMessages();

    if (!company?.api_key) return;

    const channel = supabase
      .channel('messages-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `apikey_instancia=eq.${company.api_key}`,
        },
        () => {
          fetchMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [company?.api_key, fetchMessages]);

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

  if (loading && !error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin mx-auto mb-2" />
          <p className="text-slate-600">Carregando mensagens...</p>
          <button
            onClick={signOut}
            className="mt-4 text-sm text-slate-500 hover:text-slate-700 underline"
          >
            Sair
          </button>
        </div>
      </div>
    );
  }

  if (error && messages.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="max-w-md w-full mx-4">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-800 mb-2">Erro ao Carregar</h2>
            <p className="text-slate-600 mb-6">{error}</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={fetchMessages}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition"
              >
                <RefreshCw className="w-4 h-4" />
                Tentar Novamente
              </button>
              <button
                onClick={signOut}
                className="flex items-center gap-2 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition"
              >
                <LogOut className="w-4 h-4" />
                Sair
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (viewMode === 'chat') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <header className="bg-white border-b border-slate-200">
          <div className="px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-500 p-2 rounded-lg">
                  <MessageCircle className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-800">{company?.name}</h1>
                  <p className="text-sm text-slate-600">Chat de Conversas</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setViewMode('list')}
                  className="flex items-center gap-2 px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition"
                >
                  <MessageSquare className="w-4 h-4" />
                  Ver Lista
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
        <div className="flex-1">
          <ChatView />
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
                <p className="text-sm text-slate-600">Lista de Mensagens</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setViewMode('chat')}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition"
              >
                <MessageCircle className="w-4 h-4" />
                Ver Chat
              </button>
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
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-red-700">{error}</p>
            </div>
            <button
              onClick={fetchMessages}
              className="text-sm text-red-700 hover:text-red-800 underline"
            >
              Tentar novamente
            </button>
          </div>
        )}

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
            <p className="text-slate-600 mb-6">As mensagens do WhatsApp aparecerão aqui quando chegarem</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={fetchMessages}
                disabled={refreshing}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                Atualizar
              </button>
            </div>
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
