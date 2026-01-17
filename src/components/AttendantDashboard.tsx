import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { MessageCircle, LogOut, Send } from 'lucide-react';

interface Message {
  id?: number;
  numero: string | null;
  pushname: string | null;
  tipomessage: string | null;
  message: string | null;
  timestamp: string | null;
  created_at: string;
  apikey_instancia?: string;
  sector_id?: string;
}

interface Sector {
  id: string;
  name: string;
}

export default function AttendantDashboard() {
  const { attendant, company, signOut } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sector, setSector] = useState<Sector | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (attendant && company) {
      fetchSector();
      fetchMessages();
      subscribeToMessages();
    } else {
      setLoading(false);
    }
  }, [attendant, company]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchSector = async () => {
    if (!attendant?.sector_id) return;

    try {
      const { data, error } = await supabase
        .from('sectors')
        .select('id, name')
        .eq('id', attendant.sector_id)
        .maybeSingle();

      if (!error && data) {
        setSector(data);
      }
    } catch (error) {
      console.error('Erro ao carregar setor:', error);
    }
  };

  const fetchMessages = async () => {
    if (!company?.api_key) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      let query = supabase
        .from('messages')
        .select('*')
        .eq('apikey_instancia', company.api_key);

      if (attendant?.sector_id) {
        query = query.or(`sector_id.eq.${attendant.sector_id},sector_id.is.null`);
      }

      const { data, error } = await query.order('created_at', { ascending: true });

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
          const newMsg = payload.new as Message;

          if (attendant?.sector_id && newMsg.sector_id && newMsg.sector_id !== attendant.sector_id) {
            return;
          }

          setMessages((prev) => [...prev, newMsg]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !company?.api_key) return;

    const newMessage: Partial<Message> = {
      numero: null,
      pushname: attendant?.name || null,
      tipomessage: 'text',
      message: messageText.trim(),
      timestamp: Date.now().toString(),
      apikey_instancia: company.api_key,
      sector_id: attendant?.sector_id || undefined,
    };

    try {
      const { error } = await supabase.from('messages').insert([newMessage]);

      if (error) throw error;
      setMessageText('');
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      alert('Erro ao enviar mensagem');
    }
  };

  const formatTime = (timestamp: string | null, created_at: string) => {
    const dateStr = timestamp || created_at;
    if (!dateStr) return '';

    try {
      const date = new Date(parseInt(timestamp || '0') || created_at);
      return date.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      if (date.toDateString() === today.toDateString()) {
        return 'Hoje';
      } else if (date.toDateString() === yesterday.toDateString()) {
        return 'Ontem';
      } else {
        return date.toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });
      }
    } catch {
      return '';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando chat...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
              <MessageCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">{attendant?.name}</h1>
              <p className="text-sm text-gray-600">
                {sector ? `Setor: ${sector.name}` : company?.name}
              </p>
            </div>
          </div>
          <button
            onClick={() => signOut()}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors shadow-sm"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </header>

      <div className="flex-1 flex flex-col overflow-hidden max-w-6xl mx-auto w-full">
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <MessageCircle className="w-20 h-20 text-gray-300 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Nenhuma mensagem ainda
              </h3>
              <p className="text-gray-500">
                As mensagens aparecerão aqui quando chegarem
              </p>
            </div>
          ) : (
            messages.map((msg, index) => {
              const showDate =
                index === 0 ||
                formatDate(messages[index - 1].created_at) !== formatDate(msg.created_at);

              const isFromCustomer = msg.numero && msg.numero.trim() !== '';

              return (
                <div key={msg.id}>
                  {showDate && (
                    <div className="flex justify-center mb-4">
                      <span className="px-4 py-1.5 bg-gray-200 rounded-full text-sm font-medium text-gray-700">
                        {formatDate(msg.created_at)}
                      </span>
                    </div>
                  )}
                  <div className={`flex ${isFromCustomer ? 'justify-start' : 'justify-end'}`}>
                    <div
                      className={`max-w-2xl rounded-2xl p-4 shadow-md ${
                        isFromCustomer
                          ? 'bg-white border border-gray-200'
                          : 'bg-gradient-to-br from-blue-500 to-blue-600 text-white'
                      }`}
                    >
                      {isFromCustomer && (
                        <div className="mb-1">
                          <span className="text-sm font-semibold text-blue-600">
                            {msg.pushname || msg.numero}
                          </span>
                        </div>
                      )}
                      {msg.tipomessage && msg.tipomessage !== 'text' && (
                        <span
                          className={`inline-block px-2 py-1 text-xs font-medium rounded mb-2 ${
                            isFromCustomer
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-white/20 text-white'
                          }`}
                        >
                          {msg.tipomessage}
                        </span>
                      )}
                      <p className={`text-base break-words ${isFromCustomer ? 'text-gray-900' : 'text-white'}`}>
                        {msg.message}
                      </p>
                      <span
                        className={`text-xs mt-2 block ${
                          isFromCustomer ? 'text-gray-500' : 'text-white/80'
                        }`}
                      >
                        {formatTime(msg.timestamp, msg.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="bg-white border-t border-gray-200 p-4 shadow-lg">
          <form onSubmit={handleSendMessage} className="flex gap-3 max-w-5xl mx-auto">
            <input
              type="text"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Digite sua mensagem..."
              className="flex-1 px-5 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
            />
            <button
              type="submit"
              disabled={!messageText.trim()}
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-medium rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-md"
            >
              <Send className="w-5 h-5" />
              Enviar
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
