import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, Message } from '../lib/supabase';
import { MessageSquare, LogOut, MoreVertical, Search, RefreshCw, AlertCircle, Check, CheckCheck, FileText, Download } from 'lucide-react';

export default function CompanyDashboard() {
  const { company, signOut } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

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
        .order('created_at', { ascending: true });

      clearTimeout(timeout);

      if (error) {
        setError(`Erro ao carregar mensagens: ${error.message}`);
      } else if (data) {
        setMessages(data);
        setTimeout(scrollToBottom, 100);
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

  const formatTime = (dateString: string | null) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      if (date.toDateString() === today.toDateString()) {
        return 'Hoje';
      } else if (date.toDateString() === yesterday.toDateString()) {
        return 'Ontem';
      } else {
        return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
      }
    } catch {
      return '';
    }
  };

  if (loading && !error) {
    return (
      <div className="h-screen flex flex-col bg-[#0b141a]">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 text-teal-500 animate-spin mx-auto mb-2" />
            <p className="text-gray-300">Carregando mensagens...</p>
          </div>
        </div>
      </div>
    );
  }

  const groupMessagesByDate = () => {
    const groups: { [key: string]: Message[] } = {};
    messages.forEach((msg) => {
      const date = formatDate(msg.date_time || msg.created_at);
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(msg);
    });
    return groups;
  };

  const messageGroups = groupMessagesByDate();

  return (
    <div className="h-screen flex flex-col bg-[#0b141a]">
      <header className="bg-[#202c33] px-4 py-2.5 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 bg-teal-600 rounded-full flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-white font-medium">{company?.name}</h1>
            <p className="text-gray-400 text-sm">{messages.length} mensagens</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchMessages()}
            disabled={refreshing}
            className="p-2 text-gray-400 hover:text-white hover:bg-[#2a3942] rounded-full transition disabled:opacity-50"
            title="Atualizar"
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            className="p-2 text-gray-400 hover:text-white hover:bg-[#2a3942] rounded-full transition"
            title="Mais opções"
          >
            <MoreVertical className="w-5 h-5" />
          </button>
          <button
            onClick={() => signOut()}
            className="ml-2 px-3 py-1.5 text-sm text-gray-300 hover:text-white hover:bg-[#2a3942] rounded-lg transition"
          >
            Sair
          </button>
        </div>
      </header>

      {error && (
        <div className="bg-[#2a3942] border-b border-[#374248] px-4 py-3 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <p className="text-red-300 text-sm flex-1">{error}</p>
          <button
            onClick={fetchMessages}
            className="text-sm text-teal-400 hover:text-teal-300 underline"
          >
            Tentar novamente
          </button>
        </div>
      )}

      <div
        className="flex-1 overflow-y-auto bg-[#0b141a] px-4 py-6"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Cg fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Cpath opacity='.5' d='M96 95h4v1h-4v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9zm-1 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-9-10h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }}
      >
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <MessageSquare className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-300 mb-2">Nenhuma mensagem ainda</h3>
              <p className="text-gray-500">As mensagens aparecerão aqui</p>
            </div>
          </div>
        ) : (
          <div className="max-w-5xl mx-auto space-y-6">
            {Object.entries(messageGroups).map(([date, msgs]) => (
              <div key={date}>
                <div className="flex justify-center mb-4">
                  <div className="bg-[#202c33] px-3 py-1.5 rounded-lg shadow-sm">
                    <p className="text-xs text-gray-300 font-medium">{date}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {msgs.map((msg) => {
                    const isMyMessage = msg.minha === 'true';
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isMyMessage ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[65%] rounded-lg shadow-md ${
                            isMyMessage
                              ? 'bg-[#005c4b] text-white'
                              : 'bg-[#202c33] text-gray-100'
                          }`}
                        >
                          {!isMyMessage && (
                            <div className="px-3 pt-2 pb-1">
                              <p className="text-sm font-semibold text-teal-400">
                                {msg.pushname || msg.sender || msg.number || msg.numero || 'Desconhecido'}
                              </p>
                            </div>
                          )}

                          {msg.urlimagem && (
                            <div className="px-1 pt-1">
                              <img
                                src={msg.urlimagem}
                                alt="Imagem"
                                className="rounded-lg max-w-full h-auto"
                                style={{ maxHeight: '400px' }}
                              />
                            </div>
                          )}

                          {msg.urlpdf && (
                            <div className="px-3 py-2">
                              <a
                                href={msg.urlpdf}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`flex items-center gap-2 p-2 rounded-lg ${
                                  isMyMessage ? 'bg-[#004a3d]' : 'bg-[#2a3942]'
                                } hover:opacity-80 transition`}
                              >
                                <FileText className="w-10 h-10" />
                                <div className="flex-1">
                                  <p className="text-sm font-medium">Documento PDF</p>
                                  <p className="text-xs opacity-70">Clique para abrir</p>
                                </div>
                                <Download className="w-4 h-4" />
                              </a>
                            </div>
                          )}

                          {msg.message && (
                            <div className="px-3 py-2">
                              <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                            </div>
                          )}

                          <div className="px-3 pb-1.5 flex items-center justify-end gap-1">
                            <span className="text-xs opacity-60">
                              {formatTime(msg.date_time || msg.created_at)}
                            </span>
                            {isMyMessage && (
                              <CheckCheck className="w-4 h-4 text-blue-400" />
                            )}
                          </div>

                          {msg.idmessage && (
                            <div className="px-3 pb-2">
                              <span className="text-[10px] opacity-40 font-mono">
                                ID: {msg.idmessage.substring(0, 15)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>
    </div>
  );
}
