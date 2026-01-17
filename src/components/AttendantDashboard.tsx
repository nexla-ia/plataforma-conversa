import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { MessageCircle, LogOut, Send, User, Search, Menu, CheckCheck, Tag, Building2, Layers, ChevronDown } from 'lucide-react';

interface Message {
  id?: number;
  numero: string | null;
  sender?: string | null;
  pushname: string | null;
  tipomessage: string | null;
  message: string | null;
  timestamp: string | null;
  created_at: string;
  apikey_instancia?: string;
  sector_id?: string;
  department_id?: string;
  tag_id?: string;
  date_time?: string;
  'minha?'?: string;
}

interface Contact {
  phoneNumber: string;
  name: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  messages: Message[];
}

interface Sector {
  id: string;
  name: string;
}

interface Department {
  id: string;
  name: string;
}

interface TagItem {
  id: string;
  name: string;
  color: string;
}

export default function AttendantDashboard() {
  const { attendant, company, signOut } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sector, setSector] = useState<Sector | null>(null);
  const [selectedContact, setSelectedContact] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [openDropdownContact, setOpenDropdownContact] = useState<string | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [tags, setTags] = useState<TagItem[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [selectedSector, setSelectedSector] = useState<string>('');
  const [selectedTag, setSelectedTag] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (openDropdownContact && !target.closest('.dropdown-container')) {
        setOpenDropdownContact(null);
        setSelectedDepartment('');
        setSelectedSector('');
        setSelectedTag('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openDropdownContact]);

  useEffect(() => {
    if (attendant && company) {
      fetchSector();
      fetchMessages();
      fetchDepartments();
      fetchSectors();
      fetchTags();
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

  const fetchDepartments = async () => {
    if (!company?.id) return;

    try {
      const { data, error } = await supabase
        .from('departments')
        .select('id, name')
        .eq('company_id', company.id)
        .order('name');

      if (!error && data) {
        setDepartments(data);
      }
    } catch (error) {
      console.error('Erro ao carregar departamentos:', error);
    }
  };

  const fetchSectors = async () => {
    if (!company?.id) return;

    try {
      const { data, error } = await supabase
        .from('sectors')
        .select('id, name')
        .eq('company_id', company.id)
        .order('name');

      if (!error && data) {
        setSectors(data);
      }
    } catch (error) {
      console.error('Erro ao carregar setores:', error);
    }
  };

  const fetchTags = async () => {
    if (!company?.id) return;

    try {
      const { data, error } = await supabase
        .from('tags')
        .select('id, name, color')
        .eq('company_id', company.id)
        .order('name');

      if (!error && data) {
        setTags(data);
      }
    } catch (error) {
      console.error('Erro ao carregar tags:', error);
    }
  };

  const handleUpdateContactInfo = async () => {
    if (!openDropdownContact || !company?.api_key) return;

    try {
      const updates: any = {};

      if (selectedDepartment) {
        updates.department_id = selectedDepartment;
      }

      if (selectedSector) {
        updates.sector_id = selectedSector;
      }

      if (selectedTag) {
        updates.tag_id = selectedTag;
      }

      if (Object.keys(updates).length === 0) {
        alert('Selecione pelo menos uma opção para atualizar');
        return;
      }

      const { error } = await supabase
        .from('messages')
        .update(updates)
        .eq('apikey_instancia', company.api_key)
        .eq('numero', openDropdownContact);

      if (error) throw error;

      alert('Informações atualizadas com sucesso!');
      setOpenDropdownContact(null);
      setSelectedDepartment('');
      setSelectedSector('');
      setSelectedTag('');
      fetchMessages();
    } catch (error) {
      console.error('Erro ao atualizar informações:', error);
      alert('Erro ao atualizar informações');
    }
  };

  const fetchMessages = async () => {
    if (!company?.api_key) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      let receivedQuery = supabase
        .from('messages')
        .select('*')
        .eq('apikey_instancia', company.api_key);

      if (attendant?.sector_id) {
        receivedQuery = receivedQuery.or(`sector_id.eq.${attendant.sector_id},sector_id.is.null`);
      }

      const [receivedResult, sentResult] = await Promise.all([
        receivedQuery,
        supabase
          .from('sent_messages')
          .select('*')
          .eq('apikey_instancia', company.api_key)
      ]);

      if (receivedResult.error) throw receivedResult.error;
      if (sentResult.error) throw sentResult.error;

      const allMessages = [
        ...(receivedResult.data || []),
        ...(sentResult.data || [])
      ].sort((a, b) => {
        return getMessageTimestamp(a) - getMessageTimestamp(b);
      });

      setMessages(allMessages);
      setTimeout(scrollToBottom, 100);
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
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `apikey_instancia=eq.${company.api_key}`,
        },
        () => {
          fetchMessages();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sent_messages',
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
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !company?.api_key || !selectedContact) return;

    const newMessage: Partial<Message> = {
      numero: selectedContact,
      sender: selectedContact,
      pushname: attendant?.name || null,
      tipomessage: 'conversation',
      message: messageText.trim(),
      timestamp: Date.now().toString(),
      apikey_instancia: company.api_key,
      sector_id: attendant?.sector_id || undefined,
      date_time: new Date().toISOString(),
      'minha?': 'true',
    };

    try {
      const { error } = await supabase.from('sent_messages').insert([newMessage]);

      if (error) throw error;
      setMessageText('');
      setTimeout(scrollToBottom, 100);
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

  const getContactId = (msg: Message): string => {
    return msg.numero || msg.sender || 'Desconhecido';
  };

  const getPhoneNumber = (contactId: string): string => {
    if (contactId.includes('@')) {
      return contactId.split('@')[0];
    }
    return contactId;
  };

  const getContactName = (msg: Message): string => {
    return msg.pushname || getPhoneNumber(getContactId(msg));
  };

  const getMessageTimestamp = (msg: Message): number => {
    if (msg.timestamp && !isNaN(Number(msg.timestamp))) {
      return Number(msg.timestamp) * 1000;
    }
    if (msg.date_time) {
      return new Date(msg.date_time).getTime();
    }
    if (msg.created_at) {
      return new Date(msg.created_at).getTime();
    }
    return 0;
  };

  const groupMessagesByContact = (): Contact[] => {
    const contactsMap: { [key: string]: Contact } = {};

    messages.forEach((msg) => {
      const contactId = getContactId(msg);

      if (!contactsMap[contactId]) {
        contactsMap[contactId] = {
          phoneNumber: contactId,
          name: getContactName(msg),
          lastMessage: '',
          lastMessageTime: '',
          unreadCount: 0,
          messages: [],
        };
      }

      contactsMap[contactId].messages.push(msg);
    });

    const contacts = Object.values(contactsMap).map((contact) => {
      contact.messages.sort((a, b) => {
        return getMessageTimestamp(a) - getMessageTimestamp(b);
      });

      const lastMsg = contact.messages[contact.messages.length - 1];
      contact.lastMessage = lastMsg.message || 'Mensagem';

      const lastMsgTime = getMessageTimestamp(lastMsg);
      contact.lastMessageTime = lastMsgTime > 0 ? new Date(lastMsgTime).toISOString() : '';
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
    const displayPhone = getPhoneNumber(contact.phoneNumber);
    return (
      contact.name.toLowerCase().includes(searchLower) ||
      displayPhone.toLowerCase().includes(searchLower) ||
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

  const groupMessagesByDate = (msgs: Message[]) => {
    const groups: { [key: string]: Message[] } = {};
    msgs.forEach((msg) => {
      const date = formatDate(msg.created_at);
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(msg);
    });
    return groups;
  };

  if (loading) {
    return (
      <div className="h-screen flex bg-gradient-to-br from-slate-50 to-gray-100">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Carregando chat...</p>
          </div>
        </div>
      </div>
    );
  }

  const currentMessages = selectedContactData?.messages || [];
  const messageGroups = groupMessagesByDate(currentMessages);

  return (
    <div className="h-screen flex bg-gradient-to-br from-slate-50 to-gray-100 overflow-hidden">
      <div
        className={`${
          sidebarOpen ? 'flex' : 'hidden'
        } md:flex w-full md:w-[380px] bg-white/70 backdrop-blur-xl border-r border-gray-200/50 flex-col shadow-lg`}
      >
        <header className="bg-white/50 backdrop-blur-sm px-6 py-5 flex items-center justify-between border-b border-gray-200/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-2xl flex items-center justify-center shadow-md">
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-gray-900 font-bold text-base tracking-tight">{attendant?.name}</h2>
              <p className="text-xs text-gray-500">{sector ? `Setor: ${sector.name}` : company?.name}</p>
            </div>
          </div>
          <button
            onClick={signOut}
            className="p-2.5 text-gray-400 hover:text-blue-600 hover:bg-gray-100/50 rounded-xl transition-all"
            title="Sair"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </header>

        <div className="px-5 py-4 bg-white/30 backdrop-blur-sm border-b border-gray-200/50">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Pesquisar contato"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white/60 text-gray-900 text-sm pl-12 pr-4 py-3 rounded-xl border border-gray-200/50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white transition-all placeholder-gray-400"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-transparent">
          {filteredContacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-6">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full flex items-center justify-center mb-4">
                <MessageCircle className="w-10 h-10 text-blue-500" />
              </div>
              <p className="text-gray-500 text-sm text-center font-medium">
                {searchTerm ? 'Nenhum contato encontrado' : 'Nenhuma conversa ainda'}
              </p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {filteredContacts.map((contact) => (
                <div key={contact.phoneNumber} className="relative dropdown-container">
                  <div
                    className={`w-full px-4 py-3.5 flex items-center gap-3 rounded-xl transition-all ${
                      selectedContact === contact.phoneNumber
                        ? 'bg-gradient-to-r from-blue-50 to-blue-100/50 shadow-sm'
                        : 'hover:bg-white/40'
                    }`}
                  >
                    <button
                      onClick={() => {
                        setSelectedContact(contact.phoneNumber);
                        if (window.innerWidth < 768) {
                          setSidebarOpen(false);
                        }
                      }}
                      className="flex items-center gap-3 flex-1 min-w-0"
                    >
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md">
                        <User className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1 text-left overflow-hidden">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="text-gray-900 font-semibold text-sm truncate">{contact.name}</h3>
                          <span className="text-xs text-gray-400 ml-2">
                            {formatTime(contact.lastMessageTime, contact.lastMessageTime)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-gray-500 text-xs truncate flex-1">{contact.lastMessage}</p>
                          {contact.unreadCount > 0 && (
                            <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center ml-2">
                              <span className="text-[10px] font-bold text-white">{contact.unreadCount}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenDropdownContact(
                          openDropdownContact === contact.phoneNumber ? null : contact.phoneNumber
                        );
                      }}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-gray-100 rounded-lg transition-all flex-shrink-0"
                      title="Opções"
                    >
                      <ChevronDown className={`w-4 h-4 transition-transform ${
                        openDropdownContact === contact.phoneNumber ? 'rotate-180' : ''
                      }`} />
                    </button>
                  </div>

                  {openDropdownContact === contact.phoneNumber && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border border-gray-200 p-4 z-50 space-y-3">
                      <div>
                        <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 mb-2">
                          <Building2 className="w-3 h-3 text-blue-600" />
                          Departamento
                        </label>
                        <select
                          value={selectedDepartment}
                          onChange={(e) => setSelectedDepartment(e.target.value)}
                          className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 text-xs text-gray-900"
                        >
                          <option value="">Selecionar</option>
                          {departments.map((dept) => (
                            <option key={dept.id} value={dept.id}>
                              {dept.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 mb-2">
                          <Layers className="w-3 h-3 text-blue-600" />
                          Setor
                        </label>
                        <select
                          value={selectedSector}
                          onChange={(e) => setSelectedSector(e.target.value)}
                          className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 text-xs text-gray-900"
                        >
                          <option value="">Selecionar</option>
                          {sectors.map((sec) => (
                            <option key={sec.id} value={sec.id}>
                              {sec.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 mb-2">
                          <Tag className="w-3 h-3 text-blue-600" />
                          Tag
                        </label>
                        <select
                          value={selectedTag}
                          onChange={(e) => setSelectedTag(e.target.value)}
                          className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 text-xs text-gray-900"
                        >
                          <option value="">Selecionar</option>
                          {tags.map((tag) => (
                            <option key={tag.id} value={tag.id}>
                              {tag.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={() => {
                            setOpenDropdownContact(null);
                            setSelectedDepartment('');
                            setSelectedSector('');
                            setSelectedTag('');
                          }}
                          className="flex-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-all text-xs"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={handleUpdateContactInfo}
                          className="flex-1 px-3 py-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-medium rounded-lg shadow-md hover:shadow-lg transition-all text-xs"
                        >
                          Salvar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className={`flex-1 flex-col ${sidebarOpen ? 'hidden md:flex' : 'flex'}`}>
        {selectedContactData ? (
          <>
            <header className="bg-white/70 backdrop-blur-xl px-6 py-5 flex items-center gap-3 shadow-sm border-b border-gray-200/50">
              <button
                onClick={() => setSidebarOpen(true)}
                className="md:hidden p-2 text-gray-500 hover:text-blue-600 hover:bg-gray-100/50 rounded-xl transition-all"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="w-11 h-11 bg-gradient-to-br from-blue-400 to-blue-600 rounded-2xl flex items-center justify-center shadow-md">
                <User className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-gray-900 font-bold text-base tracking-tight">{selectedContactData.name}</h1>
                <p className="text-gray-500 text-xs">{getPhoneNumber(selectedContactData.phoneNumber)}</p>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto bg-transparent px-6 py-4">
              <div className="max-w-5xl mx-auto">
                {Object.entries(messageGroups).map(([date, msgs]) => (
                  <div key={date} className="mb-6">
                    <div className="flex justify-center mb-5">
                      <div className="bg-white/60 backdrop-blur-sm px-4 py-1.5 rounded-full shadow-sm border border-gray-200/50">
                        <p className="text-[11px] text-gray-600 font-semibold tracking-wide">{date}</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {msgs.map((msg) => {
                        const isSentMessage = msg['minha?'] === 'true';
                        const isFromCustomer = msg.numero && msg.numero.trim() !== '';

                        return (
                          <div
                            key={msg.id}
                            className={`flex ${isSentMessage || !isFromCustomer ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`max-w-[70%] rounded-2xl ${
                                isSentMessage || !isFromCustomer
                                  ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-br-md shadow-lg'
                                  : 'bg-white/80 backdrop-blur-sm text-gray-900 rounded-bl-md shadow-md border border-gray-200/50'
                              }`}
                            >
                              {isFromCustomer && !isSentMessage && (
                                <div className="px-3.5 pt-2">
                                  <span className="text-sm font-semibold text-blue-600">
                                    {msg.pushname || msg.numero}
                                  </span>
                                </div>
                              )}
                              {msg.tipomessage && msg.tipomessage !== 'text' && msg.tipomessage !== 'conversation' && (
                                <span
                                  className={`inline-block mx-3 mt-2 px-2 py-1 text-xs font-medium rounded ${
                                    isSentMessage || !isFromCustomer
                                      ? 'bg-white/20 text-white'
                                      : 'bg-blue-100 text-blue-700'
                                  }`}
                                >
                                  {msg.tipomessage}
                                </span>
                              )}
                              {msg.message && (
                                <div className="px-3.5 py-2">
                                  <p className="text-[14px] leading-[1.4] whitespace-pre-wrap break-words">
                                    {msg.message}
                                  </p>
                                </div>
                              )}
                              <div className="px-3.5 pb-1.5 flex items-center justify-end gap-1">
                                <span className={`text-[10px] ${isSentMessage || !isFromCustomer ? 'text-blue-100' : 'text-gray-400'}`}>
                                  {formatTime(msg.timestamp, msg.created_at)}
                                </span>
                                {(isSentMessage || !isFromCustomer) && (
                                  <CheckCheck className="w-3.5 h-3.5 text-blue-50" />
                                )}
                              </div>
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

            <div className="bg-white/70 backdrop-blur-xl px-6 py-4 border-t border-gray-200/50">
              <form onSubmit={handleSendMessage} className="flex items-center gap-3">
                <div className="flex-1 bg-white/60 rounded-2xl flex items-center px-5 py-3 border border-gray-200/50 focus-within:border-blue-400 focus-within:bg-white transition-all">
                  <input
                    type="text"
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder="Digite uma mensagem"
                    className="flex-1 bg-transparent text-gray-900 placeholder-gray-400 focus:outline-none text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!messageText.trim()}
                  className="p-3.5 bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 rounded-2xl transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
                  title="Enviar mensagem"
                >
                  <Send className="w-5 h-5 text-white" />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-transparent">
            <div className="text-center p-8">
              <div className="w-32 h-32 bg-gradient-to-br from-blue-100 to-blue-200 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                <MessageCircle className="w-16 h-16 text-blue-500" />
              </div>
              <h3 className="text-2xl font-bold text-gray-700 mb-3 tracking-tight">Nenhuma mensagem ainda</h3>
              <p className="text-gray-500 text-sm">As mensagens aparecerão aqui quando chegarem</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
