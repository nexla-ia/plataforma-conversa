import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, Message } from '../lib/supabase';
import { MessageSquare, LogOut, MoreVertical, Search, RefreshCw, AlertCircle, CheckCheck, FileText, Download, User, Menu, X } from 'lucide-react';

interface Contact {
  phoneNumber: string;
  name: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  messages: Message[];
}

export default function CompanyDashboard() {
  const { company, signOut } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedContact, setSelectedContact] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
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

  const getPhoneNumber = (msg: Message): string => {
    return msg.sender || msg.number || msg.numero || 'Desconhecido';
  };

  const getContactName = (msg: Message): string => {
    return msg.pushname || getPhoneNumber(msg);
  };

  const groupMessagesByContact = (): Contact[] => {
    const contactsMap: { [key: string]: Contact } = {};

    messages.forEach((msg) => {
      const phoneNumber = getPhoneNumber(msg);

      if (!contactsMap[phoneNumber]) {
        contactsMap[phoneNumber] = {
          phoneNumber,
          name: getContactName(msg),
          lastMessage: '',
          lastMessageTime: '',
          unreadCount: 0,
          messages: [],
        };
      }

      contactsMap[phoneNumber].messages.push(msg);
    });

    const contacts = Object.values(contactsMap).map((contact) => {
      contact.messages.sort((a, b) => {
        const dateA = new Date(a.date_time || a.created_at || 0).getTime();
        const dateB = new Date(b.date_time || b.created_at || 0).getTime();
        return dateA - dateB;
      });

      const lastMsg = contact.messages[contact.messages.length - 1];
      contact.lastMessage = lastMsg.message || (lastMsg.urlimagem ? 'Imagem' : (lastMsg.urlpdf ? 'Documento' : 'Mensagem'));
      contact.lastMessageTime = lastMsg.date_time || lastMsg.created_at || '';
      contact.name = getContactName(lastMsg);

      return contact;
    });

    contacts.sort((a, b) => {
      const dateA = new Date(a.lastMessageTime).getTime();
      const dateB = new Date(b.lastMessageTime).getTime();
      return dateB - dateA;
    });

    return contacts;
  };

  const contacts = groupMessagesByContact();

  const filteredContacts = contacts.filter((contact) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      contact.name.toLowerCase().includes(searchLower) ||
      contact.phoneNumber.toLowerCase().includes(searchLower)
    );
  });

  const selectedContactData = selectedContact
    ? contacts.find((c) => c.phoneNumber === selectedContact)
    : null;

  useEffect(() => {
    if (!selectedContact && contacts.length > 0) {
      setSelectedContact(contacts[0].phoneNumber);
    }
  }, [contacts.length, selectedContact]);

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

  const groupMessagesByDate = (msgs: Message[]) => {
    const groups: { [key: string]: Message[] } = {};
    msgs.forEach((msg) => {
      const date = formatDate(msg.date_time || msg.created_at);
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(msg);
    });
    return groups;
  };

  const currentMessages = selectedContactData?.messages || [];
  const messageGroups = groupMessagesByDate(currentMessages);

  return (
    <div className="h-screen flex bg-[#111b21] overflow-hidden">
      <div
        className={`${
          sidebarOpen ? 'flex' : 'hidden'
        } md:flex w-full md:w-[400px] bg-[#111b21] border-r border-[#2a3942] flex-col`}
      >
        <header className="bg-[#202c33] px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-600 rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-white font-medium text-sm">{company?.name}</h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchMessages()}
              disabled={refreshing}
              className="p-2 text-gray-400 hover:text-white hover:bg-[#2a3942] rounded-full transition disabled:opacity-50"
              title="Atualizar"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => signOut()}
              className="p-2 text-gray-400 hover:text-white hover:bg-[#2a3942] rounded-full transition"
              title="Sair"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {error && (
          <div className="bg-[#2a3942] border-b border-[#374248] px-4 py-2 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <p className="text-red-300 text-xs flex-1">{error}</p>
          </div>
        )}

        <div className="px-3 py-2 bg-[#111b21]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Pesquisar contato"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#202c33] text-gray-200 text-sm pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredContacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-4">
              <MessageSquare className="w-12 h-12 text-gray-600 mb-3" />
              <p className="text-gray-400 text-sm text-center">
                {searchTerm ? 'Nenhum contato encontrado' : 'Nenhuma conversa ainda'}
              </p>
            </div>
          ) : (
            <div>
              {filteredContacts.map((contact) => (
                <button
                  key={contact.phoneNumber}
                  onClick={() => {
                    setSelectedContact(contact.phoneNumber);
                    if (window.innerWidth < 768) {
                      setSidebarOpen(false);
                    }
                  }}
                  className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-[#2a3942] transition ${
                    selectedContact === contact.phoneNumber ? 'bg-[#2a3942]' : ''
                  }`}
                >
                  <div className="w-12 h-12 bg-teal-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <User className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1 text-left overflow-hidden">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-white font-medium text-sm truncate">{contact.name}</h3>
                      <span className="text-xs text-gray-500 ml-2">
                        {formatTime(contact.lastMessageTime)}
                      </span>
                    </div>
                    <p className="text-gray-400 text-xs truncate">{contact.lastMessage}</p>
                  </div>
                  {contact.unreadCount > 0 && (
                    <div className="w-5 h-5 bg-teal-600 rounded-full flex items-center justify-center">
                      <span className="text-xs text-white">{contact.unreadCount}</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className={`flex-1 flex-col ${sidebarOpen ? 'hidden md:flex' : 'flex'}`}>
        {selectedContactData ? (
          <>
            <header className="bg-[#202c33] px-4 py-3 flex items-center justify-between shadow-md">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="md:hidden p-2 text-gray-400 hover:text-white hover:bg-[#2a3942] rounded-full transition"
                >
                  <Menu className="w-5 h-5" />
                </button>
                <div className="w-10 h-10 bg-teal-600 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-white font-medium">{selectedContactData.name}</h1>
                  <p className="text-gray-400 text-xs">{selectedContactData.phoneNumber}</p>
                </div>
              </div>
              <button
                className="p-2 text-gray-400 hover:text-white hover:bg-[#2a3942] rounded-full transition"
                title="Mais opções"
              >
                <MoreVertical className="w-5 h-5" />
              </button>
            </header>

            <div
              className="flex-1 overflow-y-auto bg-[#0b141a] px-4 py-6"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Cg fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Cpath opacity='.5' d='M96 95h4v1h-4v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4h-9v4h-1v-4H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15v-9H0v-1h15V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h9V0h1v15h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9h4v1h-4v9zm-1 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-10 0v-9h-9v9h9zm-9-10h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9zm10 0h9v-9h-9v9z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
              }}
            >
              <div className="max-w-4xl mx-auto space-y-6">
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
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-[#0b141a]">
            <div className="text-center">
              <MessageSquare className="w-20 h-20 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-300 mb-2">WhatsApp Business</h3>
              <p className="text-gray-500">Selecione uma conversa para começar</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
