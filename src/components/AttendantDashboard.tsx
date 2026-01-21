import { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  MessageCircle,
  LogOut,
  Send,
  User,
  Search,
  Menu,
  CheckCheck,
  Tag,
  MoreVertical,
  X,
  Image as ImageIcon,
  Paperclip,
  FileText,
  Loader2,
} from 'lucide-react';
import Toast from './Toast';

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
  sector_id?: string | null;
  department_id?: string | null;
  tag_id?: string | null;
  date_time?: string | null;
  instancia?: string | null;
  idmessage?: string | null;
  mimetype?: string | null;
  base64?: string | null;
  urlpdf?: string | null;
  urlimagem?: string | null;
  caption?: string | null;
  company_id?: string | null;
  'minha?'?: string | null;
}

interface Contact {
  phoneNumber: string; // normalizado (somente dígitos)
  name: string;
  lastMessage: string;
  lastMessageTime: string; // ISO
  unreadCount: number;
  messages: Message[];
  department_id?: string;
  sector_id?: string;
  tag_ids?: string[];
  contact_db_id?: string;
}

interface ContactDB {
  id: string;
  company_id: string;
  phone_number: string; // pode vir com @s.whatsapp.net
  name: string;
  department_id: string | null;
  sector_id: string | null;
  tag_id: string | null;
  last_message: string | null;
  last_message_time: string | null;
  created_at: string;
  updated_at: string;
  tag_ids?: string[];
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

function normalizePhone(input?: string | null): string {
  if (!input) return '';
  const noJid = input.includes('@') ? input.split('@')[0] : input;
  return noJid.replace(/\D/g, '');
}

function safeISO(dateStr?: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? '' : d.toISOString();
}

export default function AttendantDashboard() {
  const { attendant, company, signOut } = useAuth();

  const [messages, setMessages] = useState<Message[]>([]);
  const [contactsDB, setContactsDB] = useState<ContactDB[]>([]);

  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);

  const [sector, setSector] = useState<Sector | null>(null);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [tags, setTags] = useState<TagItem[]>([]);

  const [selectedContact, setSelectedContact] = useState<string | null>(null); // phone normalizado
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [showTagsModal, setShowTagsModal] = useState(false);
  const [modalContactPhone, setModalContactPhone] = useState<string | null>(null); // phone normalizado
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const [imageCaption, setImageCaption] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = (smooth = true) => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({
        behavior: smooth ? 'smooth' : 'auto',
        block: 'end'
      });
    });
  };

  useEffect(() => {
    if (!attendant || !company) {
      setLoading(false);
      return;
    }

    console.log('AttendantDashboard init:', {
      attendant: attendant?.name,
      attendant_id: attendant?.id,
      dept: attendant?.department_id,
      sector: attendant?.sector_id,
      company: company?.name,
      company_id: company?.id,
      api_key: company?.api_key,
    });

    let unsub: (() => void) | undefined;

    (async () => {
      setLoading(true);
      await Promise.all([
        fetchSector(),
        fetchDepartments(),
        fetchSectors(),
        fetchTags(),
        fetchContacts(),
        fetchMessages(),
      ]);
      unsub = subscribeToRealtime();
      setLoading(false);
    })();

    return () => {
      if (unsub) unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attendant?.id, company?.id, company?.api_key]);

  useEffect(() => {
    if (messages.length > 0) {
      const timer = setTimeout(() => {
        scrollToBottom(true);
      }, 50);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  useEffect(() => {
    if (selectedContact) {
      scrollToBottom(false);
    }
  }, [selectedContact]);

  // ✅ FILTRO ESTRITO: NÃO deixa passar NULL
  function matchAttendantScope(item: { department_id?: string | null; sector_id?: string | null }) {
    const attDept = attendant?.department_id ?? null;
    const attSector = attendant?.sector_id ?? null;

    // se atendente não tem dept/setor, não mostra nada
    if (!attDept || !attSector) return false;

    // item precisa ter dept/setor preenchidos e bater exatamente
    if (!item.department_id || !item.sector_id) return false;

    return item.department_id === attDept && item.sector_id === attSector;
  }

  const fetchSector = async () => {
    if (!attendant?.sector_id) return;
    try {
      const { data, error } = await supabase
        .from('sectors')
        .select('id, name')
        .eq('id', attendant.sector_id)
        .maybeSingle();

      if (!error && data) setSector(data);
    } catch (e) {
      console.error('Erro ao carregar setor:', e);
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

      if (!error && data) setDepartments(data);
    } catch (e) {
      console.error('Erro ao carregar departamentos:', e);
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

      if (!error && data) setSectors(data);
    } catch (e) {
      console.error('Erro ao carregar setores:', e);
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

      if (!error && data) setTags(data);
    } catch (e) {
      console.error('Erro ao carregar tags:', e);
    }
  };

  const fetchContacts = async () => {
    if (!company?.id) return;

    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('company_id', company.id)
        .order('last_message_time', { ascending: false });

      if (error) throw error;

      const raw = (data || []) as ContactDB[];
      const filtered = raw.filter(matchAttendantScope);

      const withTags = await Promise.all(
        filtered.map(async (c) => {
          const { data: contactTags } = await supabase.from('contact_tags').select('tag_id').eq('contact_id', c.id);
          return { ...c, tag_ids: contactTags?.map((ct: any) => ct.tag_id) || [] };
        })
      );

      setContactsDB(withTags);
    } catch (e) {
      console.error('Erro ao buscar contatos:', e);
    }
  };

  const getMessageTimestamp = (msg: Message): number => {
    if (msg.timestamp && !isNaN(Number(msg.timestamp))) return Number(msg.timestamp) * 1000;
    if (msg.date_time) {
      const t = new Date(msg.date_time).getTime();
      if (!isNaN(t)) return t;
    }
    if (msg.created_at) {
      const t = new Date(msg.created_at).getTime();
      if (!isNaN(t)) return t;
    }
    return 0;
  };

  const fetchMessages = async () => {
    if (!company?.api_key) {
      setMessages([]);
      return;
    }

    try {
      const [received, sent] = await Promise.all([
        supabase.from('messages').select('*').eq('apikey_instancia', company.api_key),
        supabase.from('sent_messages').select('*').eq('apikey_instancia', company.api_key),
      ]);

      if (received.error) throw received.error;
      if (sent.error) throw sent.error;

      let all: Message[] = [...(received.data || []), ...(sent.data || [])];

      // ✅ filtro estrito
      all = all.filter(matchAttendantScope);

      all.sort((a, b) => getMessageTimestamp(a) - getMessageTimestamp(b));

      setMessages(all);
      setTimeout(scrollToBottom, 50);
    } catch (e) {
      console.error('Erro ao carregar mensagens:', e);
      setMessages([]);
    }
  };

  const subscribeToRealtime = () => {
    if (!company?.api_key || !company?.id) return;

    const channel = supabase
      .channel('attendant-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `apikey_instancia=eq.${company.api_key}` },
        () => {
          fetchMessages();
          fetchContacts();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sent_messages', filter: `apikey_instancia=eq.${company.api_key}` },
        () => {
          fetchMessages();
          fetchContacts();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'contacts', filter: `company_id=eq.${company.id}` },
        () => {
          fetchContacts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        resolve(base64.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // ======= AGRUPA CONTATOS PELAS MENSAGENS (normalizado) =======
  const contacts: Contact[] = useMemo(() => {
    const map = new Map<string, Contact>();

    for (const msg of messages) {
      const phone = normalizePhone(msg.numero || msg.sender || '');
      if (!phone) continue;

      if (!map.has(phone)) {
        const contactDB = contactsDB.find((c) => normalizePhone(c.phone_number) === phone);

        map.set(phone, {
          phoneNumber: phone,
          name: contactDB?.name || msg.pushname || phone,
          lastMessage: '',
          lastMessageTime: '',
          unreadCount: 0,
          messages: [],
          department_id: contactDB?.department_id || undefined,
          sector_id: contactDB?.sector_id || undefined,
          tag_ids: contactDB?.tag_ids || [],
          contact_db_id: contactDB?.id || undefined,
        });
      }

      map.get(phone)!.messages.push(msg);
    }

    const arr = Array.from(map.values()).map((c) => {
      c.messages.sort((a, b) => getMessageTimestamp(a) - getMessageTimestamp(b));
      const last = c.messages[c.messages.length - 1];
      c.lastMessage = last?.message || 'Mensagem';
      c.lastMessageTime = safeISO(last?.date_time || last?.created_at || null);
      c.name =
        contactsDB.find((db) => normalizePhone(db.phone_number) === c.phoneNumber)?.name ||
        last?.pushname ||
        c.phoneNumber;
      return c;
    });

    arr.sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime());
    return arr;
  }, [messages, contactsDB]);

  const filteredContacts = useMemo(() => {
    const s = searchTerm.toLowerCase().trim();
    if (!s) return contacts;
    return contacts.filter((c) => c.name.toLowerCase().includes(s) || c.phoneNumber.toLowerCase().includes(s));
  }, [contacts, searchTerm]);

  const selectedContactData = selectedContact ? contacts.find((c) => c.phoneNumber === selectedContact) : null;

  useEffect(() => {
    if (!selectedContact && contacts.length > 0) setSelectedContact(contacts[0].phoneNumber);
  }, [contacts, selectedContact]);

  const formatTime = (timestamp: string | null, createdAt: string) => {
    const base = timestamp || createdAt;
    if (!base) return '';
    try {
      const d = new Date(base);
      if (!isNaN(d.getTime())) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

      const num = parseInt(timestamp || '0', 10);
      if (!isNaN(num) && num > 0)
        return new Date(num * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

      return '';
    } catch {
      return '';
    }
  };

  const formatDateLabel = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const today = new Date();
      const y = new Date();
      y.setDate(today.getDate() - 1);

      if (d.toDateString() === today.toDateString()) return 'Hoje';
      if (d.toDateString() === y.toDateString()) return 'Ontem';

      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return '';
    }
  };

  const groupMessagesByDate = (msgs: Message[]) => {
    const groups: Record<string, Message[]> = {};
    for (const m of msgs) {
      const t = getMessageTimestamp(m);
      const iso = t ? new Date(t).toISOString() : m.created_at || new Date().toISOString();
      const label = formatDateLabel(iso);
      if (!groups[label]) groups[label] = [];
      groups[label].push(m);
    }
    return groups;
  };

  // ✅ NOME DO DEPARTAMENTO PARA MOSTRAR NO BALÃO
  const getDeptName = (deptId?: string | null) => {
    if (!deptId) return null;
    return departments.find((d) => d.id === deptId)?.name || null;
  };

  // ======= ATUALIZAR TAGS DO CONTATO =======
  const handleUpdateContactInfo = async () => {
    if (!modalContactPhone || !company?.id) return;

    try {
      const contactDB = contactsDB.find((c) => normalizePhone(c.phone_number) === modalContactPhone);
      if (!contactDB) throw new Error('Contato não encontrado no DB');

      const currentTags = contactDB.tag_ids || [];
      const changed = selectedTags.length !== currentTags.length || !selectedTags.every((t) => currentTags.includes(t));

      if (!changed) {
        setToastMessage('Nenhuma alteração foi feita');
        setShowToast(true);
        return;
      }

      await supabase.from('contact_tags').delete().eq('contact_id', contactDB.id);

      if (selectedTags.length > 0) {
        const payload = selectedTags.slice(0, 5).map((tagId) => ({ contact_id: contactDB.id, tag_id: tagId }));
        const { error } = await supabase.from('contact_tags').insert(payload);
        if (error) throw error;
      }

      setToastMessage('Tags atualizadas com sucesso!');
      setShowToast(true);
      setShowTagsModal(false);
      setModalContactPhone(null);
      setSelectedTags([]);
      fetchContacts();
    } catch (e) {
      console.error('Erro ao atualizar tags:', e);
      setToastMessage('Erro ao atualizar tags');
      setShowToast(true);
    }
  };

  // ======= ENVIO DE MENSAGEM + WEBHOOK COM DEPARTAMENTO =======
  const sendMessage = async (messageData: Partial<Message>) => {
    if (!company || !company.api_key || !selectedContact) return;

    setSending(true);
    try {
      const generatedIdMessage = `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

      const { data: lastMsg } = await supabase
        .from('messages')
        .select('instancia, department_id, sector_id, tag_id')
        .eq('apikey_instancia', company.api_key)
        .eq('numero', selectedContact)
        .order('created_at', { ascending: false })
        .limit(1);

      const instanciaValue = lastMsg?.[0]?.instancia || company.name;
      const departmentId = lastMsg?.[0]?.department_id ?? attendant?.department_id ?? null;
      const sectorId = lastMsg?.[0]?.sector_id ?? attendant?.sector_id ?? null;
      const tagId = lastMsg?.[0]?.tag_id ?? null;

      const nowIso = new Date().toISOString();

      const rowToInsert: Message = {
        numero: selectedContact,
        sender: selectedContact,
        'minha?': 'true',
        pushname: attendant?.name || company.name,
        apikey_instancia: company.api_key,
        date_time: nowIso,
        instancia: instanciaValue,
        idmessage: generatedIdMessage,
        company_id: company.id,
        department_id: departmentId,
        sector_id: sectorId,
        tag_id: tagId,
        created_at: nowIso,
        tipomessage: messageData.tipomessage || 'conversation',
        message: messageData.message || '',
        mimetype: messageData.mimetype || null,
        base64: messageData.base64 || null,
        urlpdf: messageData.urlpdf || null,
        urlimagem: messageData.urlimagem || null,
        caption: messageData.caption || null,
      };

      const { error } = await supabase.from('sent_messages').insert([rowToInsert]);
      if (error) throw error;

      // formatação do conteúdo (mantive)
      let formattedMessage = rowToInsert.message || '';
      if (attendant?.function && rowToInsert.tipomessage === 'conversation') {
        formattedMessage = `(${attendant.function}) - ${attendant.name}\n${formattedMessage}`;
      }

      let formattedCaption = rowToInsert.caption || null;
      if (attendant?.function && formattedCaption && rowToInsert.tipomessage !== 'conversation') {
        formattedCaption = `(${attendant.function}) - ${attendant.name}\n${formattedCaption}`;
      }

      // ✅ JSON pro n8n com DEPARTAMENTO (id + nome)
      const webhookPayload = {
        numero: selectedContact,
        message: formattedMessage,
        tipomessage: rowToInsert.tipomessage || 'conversation',
        base64: rowToInsert.base64 || null,
        urlimagem: rowToInsert.urlimagem || null,
        urlpdf: rowToInsert.urlpdf || null,
        caption: formattedCaption,
        idmessage: generatedIdMessage,
        pushname: attendant?.name || company.name,
        timestamp: nowIso,
        instancia: instanciaValue,
        apikey_instancia: company.api_key,

        sender_type: 'attendant',
        attendant_id: attendant?.id || null,
        attendant_name: attendant?.name || null,

        department_id: attendant?.department_id || null,
        department_name: departments.find((d) => d.id === attendant?.department_id)?.name || null,

        sector_id: attendant?.sector_id || null,
        sector_name: sectors.find((s) => s.id === attendant?.sector_id)?.name || null,

        company_id: company.id,
        company_name: company.name,
      };

      try {
        const res = await fetch('https://n8n.nexladesenvolvimento.com.br/webhook/EnvioMensagemOPS', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(webhookPayload),
        });

        if (!res.ok) console.error('Webhook falhou:', res.status);
      } catch (e) {
        console.error('Erro ao chamar webhook:', e);
      }

      setMessageText('');
      setTimeout(scrollToBottom, 50);
      fetchMessages();
      fetchContacts();
    } catch (e) {
      console.error('Erro ao enviar mensagem:', e);
      alert('Erro ao enviar mensagem');
    } finally {
      setSending(false);
    }
  };

  const handleSendMessage = async () => {
    if (sending) return;
    if (!messageText.trim() && !selectedFile) return;

    setSending(true);
    try {
      if (selectedFile) {
        const base64 = await fileToBase64(selectedFile);
        const isImage = selectedFile.type.startsWith('image/');
        const isAudio = selectedFile.type.startsWith('audio/');

        const messageData: Partial<Message> = {
          tipomessage: isImage ? 'imageMessage' : isAudio ? 'audioMessage' : 'documentMessage',
          mimetype: selectedFile.type,
          base64,
        };

        if (isImage) {
          messageData.message = imageCaption || messageText.trim() || 'Imagem';
          if (imageCaption) messageData.caption = imageCaption;
        } else if (isAudio) {
          messageData.message = messageText.trim() || 'Áudio';
        } else {
          messageData.message = messageText.trim() || selectedFile.name;
        }

        await sendMessage(messageData);
        setSelectedFile(null);
        setFilePreview(null);
        setImageCaption('');
      } else {
        await sendMessage({
          message: messageText.trim(),
          tipomessage: 'conversation',
        });
      }
    } finally {
      setSending(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = () => setFilePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setFilePreview(null);
    }
    e.target.value = '';
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
    setImageCaption('');
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
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {showToast && <Toast message={toastMessage} onClose={() => setShowToast(false)} />}

      {/* Fixed Header */}
      <header className="bg-white border-b border-gray-200 z-50">
        <div className="px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-sky-500 rounded-lg flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-gray-900 font-semibold text-base">{attendant?.name}</h1>
              <p className="text-xs text-gray-500">{sector ? `Setor: ${sector.name}` : company?.name}</p>
            </div>
          </div>

          <button
            onClick={signOut}
            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
            title="Sair"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* SIDEBAR */}
        <div
          className={`${sidebarOpen ? 'flex' : 'hidden'} md:flex w-full md:w-[320px] bg-white border-r border-gray-200 flex-col`}
        >
          <div className="px-4 py-3 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Pesquisar contato"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-gray-50 text-gray-900 text-sm pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:border-sky-500 focus:bg-white transition-all placeholder-gray-400"
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
                <button
                  key={contact.phoneNumber}
                  onClick={() => {
                    setSelectedContact(contact.phoneNumber);
                    if (window.innerWidth < 768) setSidebarOpen(false);
                  }}
                  className={`w-full px-3 py-3 flex items-center gap-3 rounded-lg transition-all ${
                    selectedContact === contact.phoneNumber
                      ? 'bg-sky-50 border border-sky-400'
                      : 'hover:bg-gray-50 border border-transparent'
                  }`}
                >
                  <div className="w-11 h-11 bg-sky-500 rounded-lg flex items-center justify-center flex-shrink-0">
                    <User className="w-5 h-5 text-white" />
                  </div>

                  <div className="flex-1 text-left overflow-hidden">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-gray-900 font-semibold text-sm truncate">{contact.name}</h3>
                      <span className="text-xs text-gray-400 ml-2">{formatTime(contact.lastMessageTime, contact.lastMessageTime)}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <p className="text-gray-500 text-xs truncate flex-1">{contact.lastMessage}</p>
                      {contact.unreadCount > 0 && (
                        <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center ml-2">
                          <span className="text-[10px] font-bold text-white">{contact.unreadCount}</span>
                        </div>
                      )}
                    </div>

                    {contact.tag_ids && contact.tag_ids.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {contact.tag_ids.map((tagId) => {
                          const t = tags.find((x) => x.id === tagId);
                          return t ? (
                            <span
                              key={tagId}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-white"
                              style={{ backgroundColor: t.color }}
                            >
                              <Tag className="w-2.5 h-2.5" />
                              {t.name}
                            </span>
                          ) : null;
                        })}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* CHAT */}
      <div className={`flex-1 flex-col ${sidebarOpen ? 'hidden md:flex' : 'flex'} bg-white`}>
        {selectedContactData ? (
          <>
            <header className="bg-white px-6 py-4 flex items-center justify-between border-b border-gray-200">
              <div className="flex items-center gap-3 flex-1">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="md:hidden p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all"
                >
                  <Menu className="w-5 h-5" />
                </button>

                <div className="w-10 h-10 bg-sky-500 rounded-lg flex items-center justify-center">
                  <User className="w-5 h-5 text-white" />
                </div>

                <div className="flex-1">
                  <h1 className="text-gray-900 font-bold text-base tracking-tight">{selectedContactData.name}</h1>
                  <p className="text-gray-500 text-xs mb-1">{selectedContactData.phoneNumber}</p>

                  <div className="flex flex-wrap gap-1.5">
                    {selectedContactData.tag_ids?.map((tagId) => {
                      const t = tags.find((x) => x.id === tagId);
                      return t ? (
                        <span
                          key={tagId}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium text-white"
                          style={{ backgroundColor: t.color }}
                        >
                          <Tag className="w-3 h-3" />
                          {t.name}
                        </span>
                      ) : null;
                    })}
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  const cdb = contactsDB.find((c) => normalizePhone(c.phone_number) === selectedContactData.phoneNumber);
                  setSelectedTags(cdb?.tag_ids || []);
                  setModalContactPhone(selectedContactData.phoneNumber);
                  setShowTagsModal(true);
                }}
                className="p-2.5 text-gray-400 hover:text-blue-600 hover:bg-gray-100/50 rounded-xl transition-all"
                title="Adicionar tags"
              >
                <MoreVertical className="w-5 h-5" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto bg-gray-50 px-6 py-4">
              <div className="max-w-4xl mx-auto">
                {Object.entries(messageGroups).map(([date, msgs]) => (
                  <div key={date} className="mb-6">
                    <div className="flex justify-center mb-4">
                      <div className="bg-white px-3 py-1 rounded-full border border-gray-200">
                        <p className="text-xs text-gray-600 font-medium">{date}</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {msgs.map((msg) => {
                        const isSent = msg['minha?'] === 'true';
                        const deptName = getDeptName(msg.department_id);

                        return (
                          <div
                            key={`${msg.id || msg.idmessage || `${msg.created_at}-${Math.random()}`}`}
                            className={`flex ${isSent ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`max-w-[70%] rounded-2xl ${
                                isSent
                                  ? 'bg-sky-500 text-white rounded-br-sm'
                                  : 'bg-white text-gray-900 rounded-bl-sm border border-gray-200'
                              }`}
                            >
                              {/* TOPO DO BALÃO: NOME + DEPARTAMENTO */}
                              <div className="px-3 pt-2 flex items-center justify-between gap-2">
                                <span className={`text-xs font-semibold ${isSent ? 'text-white' : 'text-gray-900'}`}>
                                  {isSent ? attendant?.name || company?.name : msg.pushname || msg.numero}
                                </span>

                                {deptName && (
                                  <span
                                    className={`text-[10px] px-1.5 py-0.5 rounded ${
                                      isSent ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                                    }`}
                                  >
                                    {deptName}
                                  </span>
                                )}
                              </div>

                              {msg.tipomessage && msg.tipomessage !== 'text' && msg.tipomessage !== 'conversation' && (
                                <span
                                  className={`inline-block mx-3 mt-2 px-2 py-1 text-xs font-medium rounded ${
                                    isSent ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700'
                                  }`}
                                >
                                  {msg.tipomessage}
                                </span>
                              )}

                              {msg.message && (
                                <div className="px-3.5 py-2">
                                  <p className="text-[14px] leading-[1.4] whitespace-pre-wrap break-words">{msg.message}</p>
                                </div>
                              )}

                              <div className="px-3.5 pb-1.5 flex items-center justify-end gap-1">
                                <span className={`text-[10px] ${isSent ? 'text-blue-100' : 'text-gray-400'}`}>
                                  {formatTime(msg.timestamp, msg.created_at)}
                                </span>
                                {isSent && <CheckCheck className="w-3.5 h-3.5 text-blue-50" />}
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

            {/* INPUT */}
            <div className="bg-white px-6 py-4 border-t border-gray-200">
              {filePreview && (
                <div className="mb-3 px-4 py-3 bg-blue-50/80 backdrop-blur-sm border border-blue-200/50 rounded-xl">
                  <div className="flex items-start gap-3">
                    <img src={filePreview} alt="Preview" className="w-20 h-20 object-cover rounded-lg" />
                    <div className="flex-1">
                      <p className="text-xs text-blue-600 mb-1 font-medium">Imagem selecionada</p>
                      <p className="text-xs text-gray-600">{selectedFile?.name}</p>
                      <button onClick={clearSelectedFile} className="text-xs text-red-500 hover:text-red-700 mt-2 font-medium">
                        Remover imagem
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {selectedFile && selectedFile.type.startsWith('image/') && (
                <div className="mb-3">
                  <input
                    type="text"
                    value={imageCaption}
                    onChange={(e) => setImageCaption(e.target.value)}
                    placeholder="Legenda para imagem (opcional)"
                    className="w-full px-4 py-2.5 text-sm bg-white/60 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white transition-all placeholder-gray-400"
                  />
                </div>
              )}

              {selectedFile && !selectedFile.type.startsWith('image/') && (
                <div className="mb-3 px-4 py-3 bg-gray-50/80 backdrop-blur-sm border border-gray-200/50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <FileText className="w-8 h-8 text-gray-400" />
                    <div className="flex-1">
                      <p className="text-xs text-gray-600 mb-1 font-medium">Arquivo selecionado</p>
                      <p className="text-xs text-gray-600">{selectedFile?.name}</p>
                      <button onClick={clearSelectedFile} className="text-xs text-red-500 hover:text-red-700 mt-2 font-medium">
                        Remover arquivo
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
                <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.txt" onChange={handleFileSelect} className="hidden" />

                <button
                  onClick={() => imageInputRef.current?.click()}
                  disabled={sending || !!selectedFile}
                  className="p-2.5 text-gray-400 hover:text-sky-500 hover:bg-gray-50 rounded-lg transition-all disabled:opacity-50"
                  title="Enviar imagem"
                >
                  <ImageIcon className="w-5 h-5" />
                </button>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={sending || !!selectedFile}
                  className="p-2.5 text-gray-400 hover:text-sky-500 hover:bg-gray-50 rounded-lg transition-all disabled:opacity-50"
                  title="Enviar arquivo"
                >
                  <Paperclip className="w-5 h-5" />
                </button>

                <div className="flex-1 bg-gray-50 rounded-lg flex items-center px-4 py-2.5 border border-gray-200 focus-within:border-sky-500 focus-within:bg-white transition-all">
                  <input
                    type="text"
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder="Digite uma mensagem"
                    disabled={sending}
                    className="flex-1 bg-transparent text-gray-900 placeholder-gray-400 focus:outline-none disabled:opacity-50 text-sm"
                  />
                </div>

                <button
                  onClick={handleSendMessage}
                  disabled={(!messageText.trim() && !selectedFile) || sending}
                  className="p-3 bg-sky-500 hover:bg-sky-600 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Enviar mensagem"
                >
                  {sending ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <Send className="w-5 h-5 text-white" />}
                </button>
              </div>
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

      {/* MODAL TAGS */}
      {showTagsModal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowTagsModal(false);
          }}
        >
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto relative z-[101]">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-5 flex items-center justify-between rounded-t-3xl">
              <h2 className="text-xl font-bold text-gray-900">Adicionar Tags</h2>
              <button
                onClick={() => {
                  setShowTagsModal(false);
                  setModalContactPhone(null);
                  setSelectedTags([]);
                }}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                  <Tag className="w-4 h-4 text-blue-600" />
                  Tags (máx. 5)
                </label>

                <div className="space-y-2 max-h-60 overflow-y-auto bg-gray-50 border border-gray-200 rounded-xl p-3">
                  {tags.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-3">Nenhuma tag disponível</p>
                  ) : (
                    tags.map((t) => (
                      <label key={t.id} className="flex items-center gap-3 p-3 hover:bg-white rounded-lg cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={selectedTags.includes(t.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              if (selectedTags.length < 5) setSelectedTags([...selectedTags, t.id]);
                              else {
                                setToastMessage('Você pode selecionar no máximo 5 tags');
                                setShowToast(true);
                              }
                            } else {
                              setSelectedTags(selectedTags.filter((id) => id !== t.id));
                            }
                          }}
                          className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          disabled={!selectedTags.includes(t.id) && selectedTags.length >= 5}
                        />

                        <span
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-white flex-1"
                          style={{ backgroundColor: t.color }}
                        >
                          <Tag className="w-4 h-4" />
                          {t.name}
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-6">
                <button
                  onClick={() => {
                    setShowTagsModal(false);
                    setModalContactPhone(null);
                    setSelectedTags([]);
                  }}
                  className="flex-1 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleUpdateContactInfo}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all"
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
