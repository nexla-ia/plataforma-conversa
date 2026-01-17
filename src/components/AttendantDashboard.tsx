import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { MessageCircle, LogOut, Send, User, Search } from 'lucide-react';

interface Message {
  id?: number;
  numero: string | null;
  pushname: string | null;
  tipomessage: string | null;
  message: string | null;
  timestamp: string | null;
  created_at: string;
  apikey_instancia?: string;
}

interface Contact {
  numero: string;
  pushname: string | null;
  lastMessage: string | null;
  lastMessageTime: string;
  unreadCount: number;
}

export default function AttendantDashboard() {
  const { attendant, company, signOut } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (attendant && company) {
      fetchMessages();
      subscribeToMessages();
    }
  }, [attendant, company]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, selectedContact]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchMessages = async () => {
    if (!company?.api_key) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('apikey_instancia', company.api_key)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
      processContacts(data || []);
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
    } finally {
      setLoading(false);
    }
  };

  const processContacts = (msgs: Message[]) => {
    const contactMap = new Map<string, Contact>();

    msgs.forEach((msg) => {
      const numero = msg.numero || 'unknown';
      const existing = contactMap.get(numero);

      if (!existing || new Date(msg.created_at) > new Date(existing.lastMessageTime)) {
        contactMap.set(numero, {
          numero,
          pushname: msg.pushname,
          lastMessage: msg.message,
          lastMessageTime: msg.created_at,
          unreadCount: 0,
        });
      }
    });

    const sortedContacts = Array.from(contactMap.values()).sort(
      (a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()
    );

    setContacts(sortedContacts);
    if (sortedContacts.length > 0 && !selectedContact) {
      setSelectedContact(sortedContacts[0].numero);
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
          setMessages((prev) => [...prev, newMsg]);
          processContacts([...messages, newMsg]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !selectedContact || !company?.api_key) return;

    const newMessage: Partial<Message> = {
      numero: selectedContact,
      pushname: contacts.find((c) => c.numero === selectedContact)?.pushname || null,
      tipomessage: 'text',
      message: messageText.trim(),
      timestamp: Date.now().toString(),
      apikey_instancia: company.api_key,
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

  const filteredContacts = contacts.filter(
    (contact) =>
      (contact.pushname?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (contact.numero?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  const selectedContactMessages = messages.filter((msg) => msg.numero === selectedContact);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando chat...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200/50 px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl flex items-center justify-center shadow-md">
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">{attendant?.name}</h1>
              <p className="text-xs text-gray-500">{company?.name}</p>
            </div>
          </div>
          <button
            onClick={() => signOut()}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-br from-red-500 to-red-600 text-white rounded-xl hover:from-red-600 hover:to-red-700 transition-all shadow-md"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-80 bg-white/60 backdrop-blur-sm border-r border-gray-200/50 flex flex-col">
          <div className="p-4 border-b border-gray-200/50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar contato..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white/60 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400 focus:bg-white transition-all"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {filteredContacts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-6">
                <User className="w-12 h-12 text-gray-300 mb-3" />
                <p className="text-gray-500 text-sm">Nenhum contato encontrado</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200/50">
                {filteredContacts.map((contact) => (
                  <button
                    key={contact.numero}
                    onClick={() => setSelectedContact(contact.numero)}
                    className={`w-full p-4 text-left hover:bg-white/60 transition-all ${
                      selectedContact === contact.numero ? 'bg-white/80' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md">
                        <User className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="font-semibold text-gray-900 truncate">
                            {contact.pushname || contact.numero}
                          </h3>
                          <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                            {formatTime(null, contact.lastMessageTime)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 truncate">
                          {contact.lastMessage || 'Sem mensagens'}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          {selectedContact ? (
            <>
              <div className="bg-white/60 backdrop-blur-sm border-b border-gray-200/50 px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center shadow-md">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="font-bold text-gray-900">
                      {contacts.find((c) => c.numero === selectedContact)?.pushname || selectedContact}
                    </h2>
                    <p className="text-xs text-gray-500">{selectedContact}</p>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {selectedContactMessages.map((msg, index) => {
                  const showDate =
                    index === 0 ||
                    formatDate(selectedContactMessages[index - 1].created_at) !==
                      formatDate(msg.created_at);

                  return (
                    <div key={msg.id}>
                      {showDate && (
                        <div className="flex justify-center mb-4">
                          <span className="px-3 py-1 bg-white/60 backdrop-blur-sm rounded-full text-xs text-gray-600 shadow-sm">
                            {formatDate(msg.created_at)}
                          </span>
                        </div>
                      )}
                      <div className="flex items-end gap-2">
                        <div className="max-w-xl bg-white rounded-2xl rounded-bl-md p-4 shadow-md">
                          {msg.tipomessage && msg.tipomessage !== 'text' && (
                            <span className="inline-block px-2 py-1 text-xs font-medium bg-teal-100 text-teal-700 rounded-lg mb-2">
                              {msg.tipomessage}
                            </span>
                          )}
                          <p className="text-gray-900 text-sm break-words">{msg.message}</p>
                          <span className="text-xs text-gray-500 mt-1 block">
                            {formatTime(msg.timestamp, msg.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              <div className="bg-white/60 backdrop-blur-sm border-t border-gray-200/50 p-4">
                <form onSubmit={handleSendMessage} className="flex gap-3">
                  <input
                    type="text"
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder="Digite sua mensagem..."
                    className="flex-1 px-4 py-3 bg-white border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400 transition-all"
                  />
                  <button
                    type="submit"
                    disabled={!messageText.trim()}
                    className="px-6 py-3 bg-gradient-to-br from-teal-500 to-teal-600 text-white rounded-xl hover:from-teal-600 hover:to-teal-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md flex items-center gap-2"
                  >
                    <Send className="w-5 h-5" />
                    Enviar
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageCircle className="w-20 h-20 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Selecione um contato
                </h3>
                <p className="text-gray-500 text-sm">
                  Escolha um contato na lista para iniciar uma conversa
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
