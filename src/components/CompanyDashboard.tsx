import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, Message } from '../lib/supabase';
import { MessageSquare, LogOut, MoreVertical, Search, AlertCircle, CheckCheck, FileText, Download, User, Menu, X, Send, Paperclip, Image as ImageIcon, Mic, Smile, Play, Pause, Loader2, Briefcase, FolderTree, UserCircle2, Tag } from 'lucide-react';
import DepartmentsManagement from './DepartmentsManagement';
import SectorsManagement from './SectorsManagement';
import AttendantsManagement from './AttendantsManagement';
import TagsManagement from './TagsManagement';

interface Contact {
  phoneNumber: string;
  name: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  messages: Message[];
}

interface Department {
  id: string;
  name: string;
}

interface Sector {
  id: string;
  name: string;
}

interface TagItem {
  id: string;
  name: string;
  color: string;
}

type TabType = 'mensagens' | 'departamentos' | 'setores' | 'atendentes' | 'tags';

export default function CompanyDashboard() {
  const { company, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('mensagens');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedContact, setSelectedContact] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [messageText, setMessageText] = useState('');
  const [imageCaption, setImageCaption] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [imageModalSrc, setImageModalSrc] = useState('');
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [tags, setTags] = useState<TagItem[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [selectedSector, setSelectedSector] = useState<string>('');
  const [selectedTag, setSelectedTag] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const detectBase64Type = (base64: string): 'image' | 'audio' | 'document' | null => {
    if (!base64) return null;

    if (base64.startsWith('data:image/') || base64.startsWith('/9j/') || base64.startsWith('iVBORw0KGgo')) {
      return 'image';
    }

    if (base64.startsWith('data:audio/') || base64.includes('audio/mpeg') || base64.includes('audio/ogg')) {
      return 'audio';
    }

    if (base64.startsWith('data:application/pdf') || base64.startsWith('JVBERi0')) {
      return 'document';
    }

    return 'document';
  };

  const getMessageTypeFromTipomessage = (tipomessage?: string): 'image' | 'audio' | 'document' | null => {
    if (!tipomessage) return null;

    const tipo = tipomessage.toLowerCase();

    if (tipo === 'imagemessage' || tipo === 'image') {
      return 'image';
    }

    if (tipo === 'audiomessage' || tipo === 'audio' || tipo === 'ptt') {
      return 'audio';
    }

    if (tipo === 'documentmessage' || tipo === 'document') {
      return 'document';
    }

    return null;
  };

  const normalizeBase64 = (base64: string, type: 'image' | 'audio' | 'document'): string => {
    if (base64.startsWith('data:')) {
      return base64;
    }

    const mimeTypes = {
      image: 'data:image/jpeg;base64,',
      audio: 'data:audio/mpeg;base64,',
      document: 'data:application/pdf;base64,'
    };

    return mimeTypes[type] + base64;
  };

  const handleAudioPlay = (messageId: string, base64Audio: string) => {
    if (playingAudio === messageId) {
      audioRef.current?.pause();
      setPlayingAudio(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }

      const audioSrc = normalizeBase64(base64Audio, 'audio');
      const audio = new Audio(audioSrc);
      audioRef.current = audio;

      audio.play();
      setPlayingAudio(messageId);

      audio.onended = () => {
        setPlayingAudio(null);
      };
    }
  };

  const downloadBase64File = (base64: string, filename: string) => {
    const link = document.createElement('a');
    link.href = base64.startsWith('data:') ? base64 : `data:application/octet-stream;base64,${base64}`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const openImageModal = (src: string) => {
    setImageModalSrc(src);
    setImageModalOpen(true);
  };

  const closeImageModal = () => {
    setImageModalOpen(false);
    setImageModalSrc('');
  };

  const getMessageTimestamp = (msg: any): number => {
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

  const fetchMessages = useCallback(async () => {
    if (!company) {
      setLoading(false);
      return;
    }

    setError(null);

    const timeout = setTimeout(() => {
      setLoading(false);
      setError('Tempo esgotado ao carregar mensagens');
    }, 10000);

    try {
      const [receivedResult, sentResult] = await Promise.all([
        supabase
          .from('messages')
          .select('*')
          .eq('apikey_instancia', company.api_key),
        supabase
          .from('sent_messages')
          .select('*')
          .eq('apikey_instancia', company.api_key)
      ]);

      clearTimeout(timeout);

      if (receivedResult.error) {
        setError(`Erro ao carregar mensagens recebidas: ${receivedResult.error.message}`);
        return;
      }

      if (sentResult.error) {
        setError(`Erro ao carregar mensagens enviadas: ${sentResult.error.message}`);
        return;
      }

      const allMessages = [
        ...(receivedResult.data || []),
        ...(sentResult.data || [])
      ].sort((a, b) => {
        return getMessageTimestamp(a) - getMessageTimestamp(b);
      });

      setMessages(allMessages);
      setTimeout(scrollToBottom, 100);
    } catch (err: any) {
      clearTimeout(timeout);
      setError(`Erro ao carregar mensagens: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [company]);

  const fetchDepartments = async () => {
    if (!company?.id) return;
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .eq('company_id', company.id)
        .order('name');

      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error('Erro ao carregar departamentos:', error);
    }
  };

  const fetchSectors = async () => {
    if (!company?.id) return;
    try {
      const { data, error } = await supabase
        .from('sectors')
        .select('*')
        .eq('company_id', company.id)
        .order('name');

      if (error) throw error;
      setSectors(data || []);
    } catch (error) {
      console.error('Erro ao carregar setores:', error);
    }
  };

  const fetchTags = async () => {
    if (!company?.id) return;
    try {
      const { data, error } = await supabase
        .from('tags')
        .select('*')
        .eq('company_id', company.id)
        .order('name');

      if (error) throw error;
      setTags(data || []);
    } catch (error) {
      console.error('Erro ao carregar tags:', error);
    }
  };

  const handleUpdateContactInfo = async () => {
    if (!selectedContact || !company?.api_key) return;

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

      const { data, error, count } = await supabase
        .from('messages')
        .update(updates)
        .eq('apikey_instancia', company.api_key)
        .eq('numero', selectedContact)
        .select();

      if (error) {
        console.error('Erro detalhado:', error);
        throw new Error(error.message || 'Erro ao atualizar informações');
      }

      console.log('Atualização bem-sucedida:', { data, count });
      alert('Informações atualizadas com sucesso!');
      setShowOptionsMenu(false);
      setSelectedDepartment('');
      setSelectedSector('');
      setSelectedTag('');
      fetchMessages();
    } catch (error: any) {
      console.error('Erro ao atualizar informações:', error);
      alert(`Erro: ${error.message || 'Não foi possível atualizar as informações'}`);
    }
  };

  useEffect(() => {
    fetchMessages();
    fetchDepartments();
    fetchSectors();
    fetchTags();

    if (!company?.api_key) return;

    const interval = setInterval(() => {
      fetchMessages();
    }, 1000);

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
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [company?.api_key, fetchMessages]);

  const formatTime = (msgOrTimestamp: any) => {
    if (!msgOrTimestamp) return '';
    try {
      let timestamp: number;

      if (typeof msgOrTimestamp === 'string' || typeof msgOrTimestamp === 'number') {
        timestamp = typeof msgOrTimestamp === 'number' ? msgOrTimestamp : new Date(msgOrTimestamp).getTime();
      } else {
        timestamp = getMessageTimestamp(msgOrTimestamp);
      }

      if (!timestamp || timestamp === 0) return '';
      const date = new Date(timestamp);
      return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const formatDate = (msgOrTimestamp: any) => {
    if (!msgOrTimestamp) return '';
    try {
      let timestamp: number;

      if (typeof msgOrTimestamp === 'string' || typeof msgOrTimestamp === 'number') {
        timestamp = typeof msgOrTimestamp === 'number' ? msgOrTimestamp : new Date(msgOrTimestamp).getTime();
      } else {
        timestamp = getMessageTimestamp(msgOrTimestamp);
      }

      if (!timestamp || timestamp === 0) return '';

      const date = new Date(timestamp);
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

  const getContactId = (msg: Message): string => {
    return msg.numero || msg.sender || msg.number || 'Desconhecido';
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
      contact.lastMessage = lastMsg.message || (lastMsg.urlimagem ? 'Imagem' : (lastMsg.urlpdf ? 'Documento' : 'Mensagem'));

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

  useEffect(() => {
    if (selectedContact) {
      setTimeout(() => {
        scrollToBottom();
      }, 100);
    }
  }, [selectedContact]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        scrollToBottom();
      }, 100);
    }
  }, [messages.length]);

  const sendMessage = async (messageData: Partial<Message>) => {
    if (!company || !selectedContact) return;

    setSending(true);
    try {
      const generatedIdMessage = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const { data: existingMessages } = await supabase
        .from('messages')
        .select('instancia')
        .eq('numero', selectedContact)
        .eq('apikey_instancia', company.api_key)
        .order('created_at', { ascending: false })
        .limit(1);

      const instanciaValue = existingMessages?.[0]?.instancia || company.name;

      const newMessage = {
        numero: selectedContact,
        sender: selectedContact,
        'minha?': 'true',
        pushname: company.name,
        apikey_instancia: company.api_key,
        date_time: new Date().toISOString(),
        instancia: instanciaValue,
        idmessage: generatedIdMessage,
        company_id: company.id,
        ...messageData,
      };

      const { error } = await supabase
        .from('sent_messages')
        .insert([newMessage]);

      if (error) {
        console.error('Erro ao enviar mensagem:', error);
        alert('Erro ao enviar mensagem');
        return;
      }

      try {
        const timestamp = new Date().toISOString();

        const webhookPayload = {
          numero: selectedContact,
          message: messageData.message || '',
          tipomessage: messageData.tipomessage || 'conversation',
          base64: messageData.base64 || null,
          urlimagem: messageData.urlimagem || null,
          urlpdf: messageData.urlpdf || null,
          caption: messageData.caption || null,
          idmessage: generatedIdMessage,
          pushname: company.name,
          timestamp: timestamp,
          instancia: instanciaValue,
          apikey_instancia: company.api_key,
        };

        const webhookResponse = await fetch('https://n8n.nexladesenvolvimento.com.br/webhook/EnvioMensagemOPS', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(webhookPayload),
        });

        if (!webhookResponse.ok) {
          console.error('Erro ao enviar para webhook:', webhookResponse.status);
        }
      } catch (webhookError) {
        console.error('Erro ao chamar webhook:', webhookError);
      }

      setMessageText('');
      setTimeout(scrollToBottom, 100);
    } catch (err) {
      console.error('Erro ao enviar mensagem:', err);
      alert('Erro ao enviar mensagem');
    } finally {
      setSending(false);
    }
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
          base64: base64,
        };

        if (isImage) {
          messageData.message = imageCaption || messageText.trim() || 'Imagem';
          if (imageCaption) {
            messageData.caption = imageCaption;
          }
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
    } catch (err) {
      console.error('Erro ao enviar:', err);
      alert('Erro ao enviar mensagem');
    } finally {
      setSending(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = () => {
        setFilePreview(reader.result as string);
      };
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


  if (loading && !error) {
    return (
      <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 to-gray-100">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-10 h-10 text-teal-500 animate-spin mx-auto mb-3" />
            <p className="text-gray-600 font-medium">Carregando mensagens...</p>
          </div>
        </div>
      </div>
    );
  }

  const groupMessagesByDate = (msgs: Message[]) => {
    const groups: { [key: string]: Message[] } = {};
    msgs.forEach((msg) => {
      const date = formatDate(msg);
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
    <div className="h-screen flex bg-gradient-to-br from-slate-50 to-gray-100 overflow-hidden">
      <div
        className={`${
          sidebarOpen ? 'flex' : 'hidden'
        } md:flex w-full md:w-[380px] bg-white/70 backdrop-blur-xl border-r border-gray-200/50 flex-col shadow-lg`}
      >
        <header className="bg-white/50 backdrop-blur-sm px-6 py-5 flex items-center justify-between border-b border-gray-200/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-teal-400 to-teal-600 rounded-2xl flex items-center justify-center shadow-md">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-gray-900 font-bold text-base tracking-tight">{company?.name}</h2>
              <p className="text-xs text-gray-500">Atendimento Multicanal</p>
            </div>
          </div>
          <button
            onClick={signOut}
            className="p-2.5 text-gray-400 hover:text-teal-600 hover:bg-gray-100/50 rounded-xl transition-all"
            title="Sair"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </header>

        <div className="px-4 py-3 bg-white/30 backdrop-blur-sm border-b border-gray-200/50">
          <div className="flex gap-2 overflow-x-auto">
            <button
              onClick={() => setActiveTab('mensagens')}
              className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl font-medium text-sm transition-all whitespace-nowrap ${
                activeTab === 'mensagens'
                  ? 'bg-gradient-to-br from-teal-500 to-teal-600 text-white shadow-md'
                  : 'bg-white/50 text-gray-600 hover:bg-white/70'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              Mensagens
            </button>
            <button
              onClick={() => setActiveTab('departamentos')}
              className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl font-medium text-sm transition-all whitespace-nowrap ${
                activeTab === 'departamentos'
                  ? 'bg-gradient-to-br from-teal-500 to-teal-600 text-white shadow-md'
                  : 'bg-white/50 text-gray-600 hover:bg-white/70'
              }`}
            >
              <Briefcase className="w-4 h-4" />
              Departamentos
            </button>
            <button
              onClick={() => setActiveTab('setores')}
              className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl font-medium text-sm transition-all whitespace-nowrap ${
                activeTab === 'setores'
                  ? 'bg-gradient-to-br from-teal-500 to-teal-600 text-white shadow-md'
                  : 'bg-white/50 text-gray-600 hover:bg-white/70'
              }`}
            >
              <FolderTree className="w-4 h-4" />
              Setores
            </button>
            <button
              onClick={() => setActiveTab('atendentes')}
              className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl font-medium text-sm transition-all whitespace-nowrap ${
                activeTab === 'atendentes'
                  ? 'bg-gradient-to-br from-teal-500 to-teal-600 text-white shadow-md'
                  : 'bg-white/50 text-gray-600 hover:bg-white/70'
              }`}
            >
              <UserCircle2 className="w-4 h-4" />
              Atendentes
            </button>
            <button
              onClick={() => setActiveTab('tags')}
              className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl font-medium text-sm transition-all whitespace-nowrap ${
                activeTab === 'tags'
                  ? 'bg-gradient-to-br from-teal-500 to-teal-600 text-white shadow-md'
                  : 'bg-white/50 text-gray-600 hover:bg-white/70'
              }`}
            >
              <Tag className="w-4 h-4" />
              Tags
            </button>
          </div>
        </div>

        {error && activeTab === 'mensagens' && (
          <div className="bg-red-50/80 backdrop-blur-sm border-b border-red-200/50 px-5 py-3 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-red-700 text-sm flex-1">{error}</p>
          </div>
        )}

        {activeTab === 'mensagens' && (
          <div className="px-5 py-4 bg-white/30 backdrop-blur-sm border-b border-gray-200/50">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Pesquisar contato"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white/60 text-gray-900 text-sm pl-12 pr-4 py-3 rounded-xl border border-gray-200/50 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:bg-white transition-all placeholder-gray-400"
            />
          </div>
        </div>
        )}

        {activeTab === 'mensagens' && (
        <div className="flex-1 overflow-y-auto bg-transparent">
          {filteredContacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-6">
              <div className="w-20 h-20 bg-gradient-to-br from-teal-100 to-teal-200 rounded-full flex items-center justify-center mb-4">
                <MessageSquare className="w-10 h-10 text-teal-500" />
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
                    if (window.innerWidth < 768) {
                      setSidebarOpen(false);
                    }
                  }}
                  className={`w-full px-4 py-3.5 flex items-center gap-3 rounded-xl transition-all ${
                    selectedContact === contact.phoneNumber
                      ? 'bg-gradient-to-r from-teal-50 to-teal-100/50 shadow-sm'
                      : 'hover:bg-white/40'
                  }`}
                >
                  <div className="w-12 h-12 bg-gradient-to-br from-teal-400 to-teal-600 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md">
                    <User className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1 text-left overflow-hidden">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-gray-900 font-semibold text-sm truncate">{contact.name}</h3>
                      <span className="text-xs text-gray-400 ml-2">
                        {formatTime(contact.lastMessageTime)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-gray-500 text-xs truncate flex-1">{contact.lastMessage}</p>
                      {contact.unreadCount > 0 && (
                        <div className="w-5 h-5 bg-teal-500 rounded-full flex items-center justify-center ml-2">
                          <span className="text-[10px] font-bold text-white">{contact.unreadCount}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        )}
      </div>

      <div className={`flex-1 flex-col ${sidebarOpen ? 'hidden md:flex' : 'flex'}`}>
        {activeTab === 'mensagens' && selectedContactData ? (
          <>
            <header className="bg-white/70 backdrop-blur-xl px-6 py-5 flex items-center justify-between shadow-sm border-b border-gray-200/50">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="md:hidden p-2 text-gray-500 hover:text-teal-600 hover:bg-gray-100/50 rounded-xl transition-all"
                >
                  <Menu className="w-5 h-5" />
                </button>
                <div className="w-11 h-11 bg-gradient-to-br from-teal-400 to-teal-600 rounded-2xl flex items-center justify-center shadow-md">
                  <User className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-gray-900 font-bold text-base tracking-tight">{selectedContactData.name}</h1>
                  <p className="text-gray-500 text-xs">{getPhoneNumber(selectedContactData.phoneNumber)}</p>
                </div>
              </div>
              <button
                onClick={() => setShowOptionsMenu(true)}
                className="p-2.5 text-gray-400 hover:text-teal-600 hover:bg-gray-100/50 rounded-xl transition-all relative z-10"
                title="Mais opções"
              >
                <MoreVertical className="w-5 h-5" />
              </button>
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
                        const base64Type = msg.base64 ? detectBase64Type(msg.base64) : null;
                        const tipoFromField = getMessageTypeFromTipomessage(msg.tipomessage);
                        const hasBase64Content = msg.base64 && base64Type;

                        return (
                          <div
                            key={msg.id}
                            className={`flex ${isSentMessage ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`max-w-[70%] rounded-2xl ${
                                isSentMessage
                                  ? 'bg-gradient-to-br from-teal-500 to-teal-600 text-white rounded-br-md shadow-lg'
                                  : 'bg-white/80 backdrop-blur-sm text-gray-900 rounded-bl-md shadow-md border border-gray-200/50'
                              }`}
                            >
                              {msg.urlimagem && !hasBase64Content && (
                                <div className="p-1">
                                  <img
                                    src={msg.urlimagem}
                                    alt="Imagem"
                                    className="rounded-xl max-w-full h-auto cursor-pointer hover:opacity-95 transition"
                                    style={{ maxHeight: '300px' }}
                                    onClick={() => openImageModal(msg.urlimagem!)}
                                  />
                                </div>
                              )}

                              {hasBase64Content && (base64Type === 'image' || tipoFromField === 'image') && (
                                <div className="p-1">
                                  <img
                                    src={normalizeBase64(msg.base64!, 'image')}
                                    alt="Imagem"
                                    className="rounded-xl max-w-full h-auto cursor-pointer hover:opacity-95 transition"
                                    style={{ maxHeight: '300px' }}
                                    onClick={() => openImageModal(normalizeBase64(msg.base64!, 'image'))}
                                  />
                                  {msg.caption && (
                                    <div className="mt-2 px-2 text-sm">
                                      {msg.caption}
                                    </div>
                                  )}
                                </div>
                              )}

                              {hasBase64Content && (base64Type === 'audio' || tipoFromField === 'audio') &&
                                base64Type !== 'image' && tipoFromField !== 'image' && (
                                <div className="p-3">
                                  <div className={`flex items-center gap-3 p-3 rounded-xl ${
                                    isSentMessage ? 'bg-teal-600' : 'bg-gray-50'
                                  }`}>
                                    <button
                                      onClick={() => handleAudioPlay(msg.id, msg.base64!)}
                                      className={`p-2 rounded-full ${
                                        isSentMessage ? 'bg-teal-700 hover:bg-teal-800' : 'bg-teal-500 hover:bg-teal-600'
                                      } transition`}
                                    >
                                      {playingAudio === msg.id ? (
                                        <Pause className="w-5 h-5 text-white" />
                                      ) : (
                                        <Play className="w-5 h-5 text-white" />
                                      )}
                                    </button>
                                    <div className="flex-1">
                                      <p className="text-sm font-medium">
                                        {msg.message || 'Áudio'}
                                      </p>
                                      <p className={`text-[11px] ${isSentMessage ? 'text-teal-100' : 'text-gray-500'}`}>
                                        Clique para {playingAudio === msg.id ? 'pausar' : 'reproduzir'}
                                      </p>
                                    </div>
                                    <Mic className={`w-5 h-5 ${isSentMessage ? 'text-teal-100' : 'text-teal-500'}`} />
                                  </div>
                                </div>
                              )}

                              {hasBase64Content && (base64Type === 'document' || tipoFromField === 'document') &&
                                base64Type !== 'audio' && tipoFromField !== 'audio' &&
                                base64Type !== 'image' && tipoFromField !== 'image' && (
                                <div className="p-2">
                                  <button
                                    onClick={() => downloadBase64File(msg.base64!, msg.message || 'documento.pdf')}
                                    className={`flex items-center gap-2 p-2.5 rounded-xl w-full ${
                                      isSentMessage ? 'bg-teal-600 hover:bg-teal-700' : 'bg-gray-50 hover:bg-gray-100'
                                    } transition`}
                                  >
                                    <FileText className="w-8 h-8 flex-shrink-0" />
                                    <div className="flex-1 min-w-0 text-left">
                                      <p className="text-sm font-medium truncate">
                                        {msg.message || 'Documento'}
                                      </p>
                                      <p className={`text-[11px] ${isSentMessage ? 'text-teal-100' : 'text-gray-500'}`}>
                                        Clique para baixar
                                      </p>
                                    </div>
                                    <Download className="w-5 h-5 flex-shrink-0" />
                                  </button>
                                </div>
                              )}

                              {msg.urlpdf && !hasBase64Content && (
                                <div className="p-2">
                                  <a
                                    href={msg.urlpdf}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`flex items-center gap-2 p-2.5 rounded-xl ${
                                      isSentMessage ? 'bg-teal-600' : 'bg-gray-50'
                                    } hover:opacity-90 transition`}
                                  >
                                    <FileText className="w-8 h-8 flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium truncate">
                                        {msg.message || 'Documento'}
                                      </p>
                                      <p className={`text-[11px] ${isSentMessage ? 'text-teal-100' : 'text-gray-500'}`}>
                                        Clique para abrir
                                      </p>
                                    </div>
                                  </a>
                                </div>
                              )}

                              {msg.message && !msg.urlpdf && !hasBase64Content && (
                                <div className="px-3.5 py-2">
                                  <p className="text-[14px] leading-[1.4] whitespace-pre-wrap break-words">
                                    {msg.message}
                                  </p>
                                </div>
                              )}

                              <div className="px-3.5 pb-1.5 flex items-center justify-end gap-1">
                                <span className={`text-[10px] ${isSentMessage ? 'text-teal-100' : 'text-gray-400'}`}>
                                  {formatTime(msg)}
                                </span>
                                {isSentMessage && (
                                  <CheckCheck className="w-3.5 h-3.5 text-teal-50" />
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
              {filePreview && (
                <div className="mb-3 px-4 py-3 bg-teal-50/80 backdrop-blur-sm border border-teal-200/50 rounded-xl">
                  <div className="flex items-start gap-3">
                    <img src={filePreview} alt="Preview" className="w-20 h-20 object-cover rounded-lg" />
                    <div className="flex-1">
                      <p className="text-xs text-teal-600 mb-1 font-medium">Imagem selecionada</p>
                      <p className="text-xs text-gray-600">{selectedFile?.name}</p>
                      <button
                        onClick={clearSelectedFile}
                        className="text-xs text-red-500 hover:text-red-700 mt-2 font-medium"
                      >
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
                    className="w-full px-4 py-2.5 text-sm bg-white/60 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400 focus:bg-white transition-all placeholder-gray-400"
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
                      <button
                        onClick={clearSelectedFile}
                        className="text-xs text-red-500 hover:text-red-700 mt-2 font-medium"
                      >
                        Remover arquivo
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <input
                  type="file"
                  ref={imageInputRef}
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".pdf,.doc,.docx,.txt"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                <button
                  onClick={() => imageInputRef.current?.click()}
                  disabled={sending || !!selectedFile}
                  className="p-3 text-gray-400 hover:text-teal-500 hover:bg-white/60 rounded-xl transition-all disabled:opacity-50"
                  title="Enviar imagem"
                >
                  <ImageIcon className="w-5 h-5" />
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={sending || !!selectedFile}
                  className="p-3 text-gray-400 hover:text-teal-500 hover:bg-white/60 rounded-xl transition-all disabled:opacity-50"
                  title="Enviar arquivo"
                >
                  <Paperclip className="w-5 h-5" />
                </button>

                <div className="flex-1 bg-white/60 rounded-2xl flex items-center px-5 py-3 border border-gray-200/50 focus-within:border-teal-400 focus-within:bg-white transition-all">
                  <input
                    type="text"
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder="Digite uma mensagem"
                    disabled={sending}
                    className="flex-1 bg-transparent text-gray-900 placeholder-gray-400 focus:outline-none disabled:opacity-50 text-sm"
                  />
                  <button
                    className="p-1.5 text-gray-400 hover:text-teal-500 transition-all ml-2"
                    title="Emoji"
                  >
                    <Smile className="w-5 h-5" />
                  </button>
                </div>

                <button
                  onClick={handleSendMessage}
                  disabled={(!messageText.trim() && !selectedFile) || sending}
                  className="p-3.5 bg-gradient-to-br from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 rounded-2xl transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
                  title="Enviar mensagem"
                >
                  {sending || uploadingFile ? (
                    <Loader2 className="w-5 h-5 text-white animate-spin" />
                  ) : (
                    <Send className="w-5 h-5 text-white" />
                  )}
                </button>
              </div>

              {uploadingFile && (
                <div className="mt-3 text-center">
                  <p className="text-sm text-gray-500 font-medium">Enviando arquivo...</p>
                </div>
              )}
            </div>
          </>
        ) : activeTab === 'mensagens' ? (
          <div className="flex-1 flex items-center justify-center bg-transparent">
            <div className="text-center p-8">
              <div className="w-32 h-32 bg-gradient-to-br from-teal-100 to-teal-200 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                <MessageSquare className="w-16 h-16 text-teal-500" />
              </div>
              <h3 className="text-2xl font-bold text-gray-700 mb-3 tracking-tight">Selecione uma conversa para começar</h3>
              <p className="text-gray-500 text-sm">Escolha um contato na lista à esquerda</p>
            </div>
          </div>
        ) : activeTab === 'departamentos' ? (
          <div className="flex-1 bg-transparent overflow-y-auto">
            <DepartmentsManagement />
          </div>
        ) : activeTab === 'setores' ? (
          <div className="flex-1 bg-transparent overflow-y-auto">
            <SectorsManagement />
          </div>
        ) : activeTab === 'atendentes' ? (
          <div className="flex-1 bg-transparent overflow-y-auto">
            <AttendantsManagement />
          </div>
        ) : activeTab === 'tags' ? (
          <div className="flex-1 bg-transparent overflow-y-auto">
            <TagsManagement />
          </div>
        ) : null}
      </div>

      {imageModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4"
          onClick={closeImageModal}
        >
          <div className="relative max-w-5xl max-h-[90vh]">
            <button
              onClick={closeImageModal}
              className="absolute -top-10 right-0 text-white hover:text-gray-300 transition"
              title="Fechar"
            >
              <X className="w-8 h-8" />
            </button>
            <img
              src={imageModalSrc}
              alt="Imagem ampliada"
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

      {showOptionsMenu && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowOptionsMenu(false);
            }
          }}
        >
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto relative z-[101]">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-5 flex items-center justify-between rounded-t-3xl">
              <h2 className="text-xl font-bold text-gray-900">Definir Informações</h2>
              <button
                onClick={() => {
                  setShowOptionsMenu(false);
                  setSelectedDepartment('');
                  setSelectedSector('');
                  setSelectedTag('');
                }}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                  <Briefcase className="w-4 h-4 text-teal-600" />
                  Departamento
                </label>
                <select
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400 focus:bg-white transition-all text-gray-900"
                >
                  <option value="">Selecione um departamento</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                  <FolderTree className="w-4 h-4 text-teal-600" />
                  Setor
                </label>
                <select
                  value={selectedSector}
                  onChange={(e) => setSelectedSector(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400 focus:bg-white transition-all text-gray-900"
                >
                  <option value="">Selecione um setor</option>
                  {sectors.map((sec) => (
                    <option key={sec.id} value={sec.id}>
                      {sec.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                  <Tag className="w-4 h-4 text-teal-600" />
                  Tag
                </label>
                <select
                  value={selectedTag}
                  onChange={(e) => setSelectedTag(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400 focus:bg-white transition-all text-gray-900"
                >
                  <option value="">Selecione uma tag</option>
                  {tags.map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      {tag.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowOptionsMenu(false);
                    setSelectedDepartment('');
                    setSelectedSector('');
                    setSelectedTag('');
                  }}
                  className="flex-1 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleUpdateContactInfo}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all"
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
