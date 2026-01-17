import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { MessageCircle, LogOut, Send, User, Search, Tag, X } from 'lucide-react';

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

interface Contact {
  numero: string;
  pushname: string | null;
  lastMessage: string | null;
  lastMessageTime: string;
  tags: ContactTag[];
}

interface ContactTag {
  id: string;
  name: string;
  color: string;
}

interface TagOption {
  id: string;
  name: string;
  color: string;
}

interface Sector {
  id: string;
  name: string;
}

export default function AttendantDashboard() {
  const { attendant, company, signOut } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [availableTags, setAvailableTags] = useState<TagOption[]>([]);
  const [showTagMenu, setShowTagMenu] = useState(false);
  const [sector, setSector] = useState<Sector | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (attendant && company) {
      fetchSector();
      fetchTags();
      fetchMessages();
      subscribeToMessages();
    } else {
      setLoading(false);
    }
  }, [attendant, company]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, selectedContact]);

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

  const fetchTags = async () => {
    if (!company?.id) return;

    try {
      const { data, error } = await supabase
        .from('tags')
        .select('id, name, color')
        .eq('company_id', company.id)
        .order('name');

      if (!error && data) {
        setAvailableTags(data);
      }
    } catch (error) {
      console.error('Erro ao carregar tags:', error);
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
      await processContacts(data || []);
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
    } finally {
      setLoading(false);
    }
  };

  const processContacts = async (msgs: Message[]) => {
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
          tags: [],
        });
      }
    });

    const contactsList = Array.from(contactMap.values());

    for (const contact of contactsList) {
      const tags = await fetchContactTags(contact.numero);
      contact.tags = tags;
    }

    const sortedContacts = contactsList.sort(
      (a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()
    );

    setContacts(sortedContacts);
    if (sortedContacts.length > 0 && !selectedContact) {
      setSelectedContact(sortedContacts[0].numero);
    }
  };

  const fetchContactTags = async (numero: string): Promise<ContactTag[]> => {
    try {
      const { data, error } = await supabase
        .from('message_tags')
        .select('tag_id, tags(id, name, color)')
        .eq('message_numero', numero);

      if (error) throw error;

      return (data || [])
        .filter(item => item.tags)
        .map(item => {
          const tag = Array.isArray(item.tags) ? item.tags[0] : item.tags;
          return {
            id: tag.id,
            name: tag.name,
            color: tag.color,
          };
        });
    } catch (error) {
      console.error('Erro ao carregar tags do contato:', error);
      return [];
    }
  };

  const addTagToContact = async (tagId: string) => {
    if (!selectedContact || !attendant?.user_id) return;

    try {
      const { error } = await supabase
        .from('message_tags')
        .insert({
          message_numero: selectedContact,
          tag_id: tagId,
          created_by: attendant.user_id,
        });

      if (error) throw error;

      const tags = await fetchContactTags(selectedContact);
      setContacts(prev =>
        prev.map(c =>
          c.numero === selectedContact ? { ...c, tags } : c
        )
      );
      setShowTagMenu(false);
    } catch (error) {
      console.error('Erro ao adicionar tag:', error);
    }
  };

  const removeTagFromContact = async (tagId: string) => {
    if (!selectedContact) return;

    try {
      const { error } = await supabase
        .from('message_tags')
        .delete()
        .eq('message_numero', selectedContact)
        .eq('tag_id', tagId);

      if (error) throw error;

      const tags = await fetchContactTags(selectedContact);
      setContacts(prev =>
        prev.map(c =>
          c.numero === selectedContact ? { ...c, tags } : c
        )
      );
    } catch (error) {
      console.error('Erro ao remover tag:', error);
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

  const filteredContacts = contacts.filter(
    (contact) =>
      (contact.pushname?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (contact.numero?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  const selectedContactMessages = messages.filter((msg) => msg.numero === selectedContact);
  const selectedContactData = contacts.find((c) => c.numero === selectedContact);
  const selectedContactTags = selectedContactData?.tags || [];
  const availableTagsToAdd = availableTags.filter(
    tag => !selectedContactTags.some(ct => ct.id === tag.id)
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando chat...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-gray-900">{attendant?.name}</h1>
              <p className="text-xs text-gray-500">
                {sector ? `Setor: ${sector.name}` : company?.name}
              </p>
            </div>
          </div>
          <button
            onClick={() => signOut()}
            className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-3 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar contato..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
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
              <div className="divide-y divide-gray-100">
                {filteredContacts.map((contact) => (
                  <button
                    key={contact.numero}
                    onClick={() => setSelectedContact(contact.numero)}
                    className={`w-full p-3 text-left hover:bg-gray-50 transition-colors ${
                      selectedContact === contact.numero ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                        <User className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="font-medium text-gray-900 text-sm truncate">
                            {contact.pushname || contact.numero}
                          </h3>
                          <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                            {formatTime(null, contact.lastMessageTime)}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 truncate mb-1">
                          {contact.lastMessage || 'Sem mensagens'}
                        </p>
                        {contact.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {contact.tags.map((tag) => (
                              <span
                                key={tag.id}
                                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                                style={{
                                  backgroundColor: tag.color + '20',
                                  color: tag.color,
                                }}
                              >
                                {tag.name}
                              </span>
                            ))}
                          </div>
                        )}
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
              <div className="bg-white border-b border-gray-200 px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                      <User className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h2 className="font-semibold text-gray-900 text-sm">
                        {selectedContactData?.pushname || selectedContact}
                      </h2>
                      <p className="text-xs text-gray-500">{selectedContact}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {selectedContactTags.map((tag) => (
                      <div
                        key={tag.id}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium"
                        style={{
                          backgroundColor: tag.color + '20',
                          color: tag.color,
                        }}
                      >
                        {tag.name}
                        <button
                          onClick={() => removeTagFromContact(tag.id)}
                          className="hover:opacity-70"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}

                    {availableTagsToAdd.length > 0 && (
                      <div className="relative">
                        <button
                          onClick={() => setShowTagMenu(!showTagMenu)}
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Adicionar tag"
                        >
                          <Tag className="w-4 h-4 text-gray-600" />
                        </button>

                        {showTagMenu && (
                          <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[150px]">
                            {availableTagsToAdd.map((tag) => (
                              <button
                                key={tag.id}
                                onClick={() => addTagToContact(tag.id)}
                                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg flex items-center gap-2"
                              >
                                <span
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: tag.color }}
                                />
                                {tag.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {selectedContactMessages.map((msg, index) => {
                  const showDate =
                    index === 0 ||
                    formatDate(selectedContactMessages[index - 1].created_at) !==
                      formatDate(msg.created_at);

                  return (
                    <div key={msg.id}>
                      {showDate && (
                        <div className="flex justify-center mb-3">
                          <span className="px-3 py-1 bg-gray-200 rounded-full text-xs text-gray-600">
                            {formatDate(msg.created_at)}
                          </span>
                        </div>
                      )}
                      <div className="flex items-end gap-2">
                        <div className="max-w-xl bg-white rounded-lg p-3 shadow-sm border border-gray-100">
                          {msg.tipomessage && msg.tipomessage !== 'text' && (
                            <span className="inline-block px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded mb-1">
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

              <div className="bg-white border-t border-gray-200 p-3">
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <input
                    type="text"
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder="Digite sua mensagem..."
                    className="flex-1 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                  <button
                    type="submit"
                    disabled={!messageText.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
                  >
                    <Send className="w-4 h-4" />
                    Enviar
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageCircle className="w-16 h-16 text-gray-300 mx-auto mb-3" />
                <h3 className="text-base font-semibold text-gray-900 mb-1">
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
