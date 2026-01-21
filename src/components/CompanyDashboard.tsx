import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, Message } from '../lib/supabase';
import { MessageSquare, LogOut, MoreVertical, Search, AlertCircle, CheckCheck, FileText, Download, User, Menu, X, Send, Paperclip, Image as ImageIcon, Mic, Smile, Play, Pause, Loader2, Briefcase, FolderTree, UserCircle2, Tag } from 'lucide-react';
import DepartmentsManagement from './DepartmentsManagement';
import SectorsManagement from './SectorsManagement';
import AttendantsManagement from './AttendantsManagement';
import TagsManagement from './TagsManagement';
import Toast from './Toast';

interface Contact {
  phoneNumber: string;
  name: string;
  lastMessage: string;
  lastMessageTime: string;
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
  phone_number: string;
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

type TabType = 'mensagens' | 'departamentos' | 'setores' | 'atendentes' | 'tags';

export default function CompanyDashboard() {
  const { company, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('mensagens');
  const [messages, setMessages] = useState<Message[]>([]);
  const [contactsDB, setContactsDB] = useState<ContactDB[]>([]);
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
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const scrollToBottom = (smooth = true) => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({
        behavior: smooth ? 'smooth' : 'auto',
        block: 'end'
      });
    });
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

  const fetchContacts = async () => {
    if (!company?.id) return;

    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('company_id', company.id)
        .order('last_message_time', { ascending: false });

      if (!error && data) {
        // Buscar tags para cada contato
        const contactsWithTags = await Promise.all(
          data.map(async (contact) => {
            const { data: contactTags } = await supabase
              .from('contact_tags')
              .select('tag_id')
              .eq('contact_id', contact.id);

            return {
              ...contact,
              tag_ids: contactTags?.map(ct => ct.tag_id) || []
            };
          })
        );

        setContactsDB(contactsWithTags);
      }
    } catch (error) {
      console.error('Erro ao carregar contatos:', error);
    }
  };

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
    if (!selectedContact || !company?.api_key || !company?.id) return;

    try {
      const updates: any = {};

      if (selectedDepartment) {
        updates.department_id = selectedDepartment;
      }

      if (selectedSector) {
        updates.sector_id = selectedSector;
      }

      // Buscar tags atuais do contato para verificar se houve mudança
      const currentContact = contactsDB.find(c => normalizePhone(c.phone_number) === normalizePhone(selectedContact));
      const currentTags = currentContact?.tag_ids || [];

      const tagsChanged =
        selectedTags.length !== currentTags.length ||
        !selectedTags.every(tag => currentTags.includes(tag));

      if (Object.keys(updates).length === 0 && !tagsChanged) {
        setToastMessage('Nenhuma alteração foi feita');
        setShowToast(true);
        return;
      }

      // ✅ Usa o contato já carregado do estado (evita mismatch por @s.whatsapp.net)
      if (!currentContact?.id) {
        throw new Error('Contato não encontrado');
      }
      const contactId = currentContact.id;

      // Atualizar a tabela contacts
      if (Object.keys(updates).length > 0) {
        const { error: contactError } = await supabase
          .from('contacts')
          .update(updates)
          .eq('id', contactId);

        if (contactError) {
          console.error('Erro ao atualizar contato:', contactError);
          throw contactError;
        }
      }

      // Atualizar as tags do contato (sempre, mesmo se for vazio para permitir remoção)
      // Remover tags antigas
      await supabase
        .from('contact_tags')
        .delete()
        .eq('contact_id', contactId);

      // Adicionar novas tags (máximo 5) se houver
      if (selectedTags.length > 0) {
        const tagsToInsert = selectedTags.slice(0, 5).map(tagId => ({
          contact_id: contactId,
          tag_id: tagId
        }));

        const { error: tagsError } = await supabase
          .from('contact_tags')
          .insert(tagsToInsert);

        if (tagsError) {
          console.error('Erro ao atualizar tags:', tagsError);
          throw tagsError;
        }
      }

      // Atualizar ambas as tabelas: messages e sent_messages
      if (Object.keys(updates).length > 0) {
        const [messagesResult, sentMessagesResult] = await Promise.all([
          supabase
            .from('messages')
            .update(updates)
            .eq('apikey_instancia', company.api_key)
            .eq('numero', selectedContact),
          supabase
            .from('sent_messages')
            .update(updates)
            .eq('apikey_instancia', company.api_key)
            .eq('numero', selectedContact)
        ]);

        if (messagesResult.error) {
          console.error('Erro ao atualizar mensagens recebidas:', messagesResult.error);
        }

        if (sentMessagesResult.error) {
          console.error('Erro ao atualizar mensagens enviadas:', sentMessagesResult.error);
        }
      }

      console.log('Atualização bem-sucedida');
      setToastMessage('Informações atualizadas com sucesso!');
      setShowToast(true);
      setShowOptionsMenu(false);
      setSelectedDepartment('');
      setSelectedSector('');
      setSelectedTags([]);
      fetchMessages();
      fetchContacts();
    } catch (error: any) {
      console.error('Erro ao atualizar informações:', error);
      setToastMessage(`Erro: ${error.message || 'Não foi possível atualizar as informações'}`);
      setShowToast(true);
    }
  };

  useEffect(() => {
    fetchMessages();
    fetchContacts();
    fetchDepartments();
    fetchSectors();
    fetchTags();

    if (!company?.api_key) return;

    const interval = setInterval(() => {
      fetchMessages();
      fetchContacts();
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
          fetchContacts();
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
          fetchContacts();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'contacts',
          filter: `company_id=eq.${company.id}`,
        },
        () => {
          fetchContacts();
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
    return normalizePhone(msg.numero || msg.sender || msg.number || '');
  };

  const getPhoneNumber = (contactId: string): string => {
    return normalizePhone(contactId);
  };

  const getContactName = (msg: Message): string => {
    return msg.pushname || getPhoneNumber(getContactId(msg));
  };

  const groupMessagesByContact = (): Contact[] => {
    const contactsMap: { [key: string]: Contact } = {};

    messages.forEach((msg) => {
      const contactId = getContactId(msg);
      if (!contactId) return;

      if (!contactsMap[contactId]) {
        // Buscar informações do contato na tabela contacts
        const contactDB = contactsDB.find(c => normalizePhone(c.phone_number) === contactId);

        contactsMap[contactId] = {
          phoneNumber: contactId,
          name: contactDB?.name || getContactName(msg),
          lastMessage: '',
          lastMessageTime: '',
          unreadCount: 0,
          messages: [],
          department_id: contactDB?.department_id || undefined,
          sector_id: contactDB?.sector_id || undefined,
          tag_ids: contactDB?.tag_ids || [],
          contact_db_id: contactDB?.id || undefined,
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
      // Mantém nome do banco se existir
      const dbName = contactsDB.find(c => normalizePhone(c.phone_number) === contact.phoneNumber)?.name;
      contact.name = dbName || getContactName(lastMsg);

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
      scrollToBottom(false);
    }
  }, [selectedContact]);

  useEffect(() => {
    if (messages.length > 0) {
      const timer = setTimeout(() => {
        scrollToBottom(true);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [messages.length]);

  const sendMessage = async (messageData: Partial<Message>) => {
    if (!company || !selectedContact) return;

    setSending(true);
    try {
      const generatedIdMessage = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const { data: existingMessages } = await supabase
        .from('messages')
        .select('instancia, department_id, sector_id, tag_id')
        .eq('numero', selectedContact)
        .eq('apikey_instancia', company.api_key)
        .order('created_at', { ascending: false })
        .limit(1);

      const instanciaValue = existingMessages?.[0]?.instancia || company.name;
      const departmentId = existingMessages?.[0]?.department_id || null;
      const sectorId = existingMessages?.[0]?.sector_id || null;
      const tagId = existingMessages?.[0]?.tag_id || null;

      // ✅ Envio pelo painel da empresa: NÃO prefixar texto.
      // Envie apenas o conteúdo puro e deixe a padronização para o n8n.
      const attendantName = company.name;
      const rawMessage = messageData.message || '';
      const rawCaption = messageData.caption || null;

      const newMessage = {
        numero: selectedContact,
        sender: selectedContact,
        'minha?': 'true',
        pushname: attendantName,
        apikey_instancia: company.api_key,
        date_time: new Date().toISOString(),
        instancia: instanciaValue,
        idmessage: generatedIdMessage,
        company_id: company.id,
        department_id: departmentId,
        sector_id: sectorId,
        tag_id: tagId,
        ...messageData,
        // garante que o texto/caption salvos fiquem puros (sem prefixo)
        message: rawMessage,
        caption: rawCaption,
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
        
          // 🔹 FORÇADO
          department_name: 'Recepção',
        
          timestamp: new Date().toISOString(),
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
            <Loader2 className="w-10 h-10 text-blue-500 animate-spin mx-auto mb-3" />
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
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {showToast && (
        <Toast
          message={toastMessage}
          onClose={() => setShowToast(false)}
        />
      )}

      {/* Fixed Header with Navigation */}
      <header className="bg-white border-b border-gray-200 z-50">
        <div className="px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-sky-500 rounded-lg flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-gray-900 font-semibold text-base">{company?.name}</h1>
              <p className="text-xs text-gray-500">Atendimento Multicanal</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('mensagens')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                activeTab === 'mensagens'
                  ? 'bg-sky-500 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              Mensagens
            </button>
            <button
              onClick={() => setActiveTab('departamentos')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                activeTab === 'departamentos'
                  ? 'bg-sky-500 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Briefcase className="w-4 h-4" />
              Departamentos
            </button>
            <button
              onClick={() => setActiveTab('setores')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                activeTab === 'setores'
                  ? 'bg-sky-500 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <FolderTree className="w-4 h-4" />
              Setores
            </button>
            <button
              onClick={() => setActiveTab('atendentes')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                activeTab === 'atendentes'
                  ? 'bg-sky-500 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <UserCircle2 className="w-4 h-4" />
              Atendentes
            </button>
            <button
              onClick={() => setActiveTab('tags')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                activeTab === 'tags'
                  ? 'bg-sky-500 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Tag className="w-4 h-4" />
              Tags
            </button>
            <button
              onClick={signOut}
              className="ml-2 p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
              title="Sair"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Contacts List */}
        <div
          className={`${
            sidebarOpen ? 'flex' : 'hidden'
          } md:flex w-full md:w-[320px] bg-white border-r border-gray-200 flex-col`}
        >

        {error && activeTab === 'mensagens' && (
          <div className="bg-red-50/80 backdrop-blur-sm border-b border-red-200/50 px-5 py-3 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-red-700 text-sm flex-1">{error}</p>
          </div>
        )}

        {activeTab === 'mensagens' && (
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
        )}

        {activeTab === 'mensagens' && (
        <div className="flex-1 overflow-y-auto bg-transparent">
          {filteredContacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-6">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full flex items-center justify-center mb-4">
                <MessageSquare className="w-10 h-10 text-blue-500" />
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
                      <span className="text-xs text-gray-400 ml-2">
                        {formatTime(contact.lastMessageTime)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-gray-500 text-xs truncate flex-1">{contact.lastMessage}</p>
                      {contact.unreadCount > 0 && (
                        <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center ml-2">
                          <span className="text-[10px] font-bold text-white">{contact.unreadCount}</span>
                        </div>
                      )}
                    </div>
                    {contact.tag_ids && contact.tag_ids.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {contact.tag_ids.map((tagId) => {
                          const tag = tags.find(t => t.id === tagId);
                          return tag ? (
                            <span
                              key={tagId}
                              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium text-white"
                              style={{ backgroundColor: tag.color }}
                            >
                              <Tag className="w-2.5 h-2.5" />
                              {tag.name}
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
        )}
      </div>

      <div className={`flex-1 flex-col ${sidebarOpen ? 'hidden md:flex' : 'flex'} bg-white`}>
        {activeTab === 'mensagens' && selectedContactData ? (
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
                  <p className="text-gray-500 text-xs mb-1">{getPhoneNumber(selectedContactData.phoneNumber)}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedContactData.department_id && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-sky-100 text-sky-700 rounded text-xs font-medium">
                        <Briefcase className="w-3 h-3" />
                        {departments.find(d => d.id === selectedContactData.department_id)?.name || 'Departamento'}
                      </span>
                    )}
                    {selectedContactData.sector_id && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                        <FolderTree className="w-3 h-3" />
                        {sectors.find(s => s.id === selectedContactData.sector_id)?.name || 'Setor'}
                      </span>
                    )}
                    {selectedContactData.tag_ids && selectedContactData.tag_ids.length > 0 && (
                      <>
                        {selectedContactData.tag_ids.map((tagId) => {
                          const tag = tags.find(t => t.id === tagId);
                          return tag ? (
                            <span
                              key={tagId}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white"
                              style={{ backgroundColor: tag.color }}
                            >
                              <Tag className="w-3 h-3" />
                              {tag.name}
                            </span>
                          ) : null;
                        })}
                      </>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  // Carregar informações atuais do contato
                  const currentContact = contactsDB.find(c => normalizePhone(c.phone_number) === normalizePhone(selectedContact));
                  setSelectedDepartment(currentContact?.department_id || '');
                  setSelectedSector(currentContact?.sector_id || '');
                  setSelectedTags(currentContact?.tag_ids || []);
                  setShowOptionsMenu(true);
                }}
                className="p-2.5 text-gray-400 hover:text-blue-600 hover:bg-gray-100/50 rounded-xl transition-all relative z-10"
                title="Mais opções"
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
                        const isSentMessage = msg['minha?'] === 'true';
                        const senderLabel = isSentMessage ? (msg.pushname || company?.name || 'Atendente') : (msg.pushname || getPhoneNumber(getContactId(msg)));
                        const deptName = msg.department_id ? (departments.find((d) => d.id === msg.department_id)?.name || null) : null;
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
                                  ? 'bg-sky-500 text-white rounded-br-sm'
                                  : 'bg-white text-gray-900 rounded-bl-sm border border-gray-200'
                              }`}
                            >
                              {/* TOPO DO BALÃO: NOME + (DEPARTAMENTO/SETOR) */}
                              <div className="px-3 pt-2 flex items-center justify-between gap-2">
                                <span className={`text-xs font-semibold ${isSentMessage ? 'text-white' : 'text-gray-900'}`}>
                                  {senderLabel}
                                </span>

                                <div className="flex items-center gap-1.5">
                                  {deptName && (
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${isSentMessage ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}>
                                      {deptName}
                                    </span>
                                  )}
                                  {/* Setor padronizado como Recepção */}
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${isSentMessage ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}>
                                    Recepção
                                  </span>
                                </div>
                              </div>

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
                                    isSentMessage ? 'bg-blue-600' : 'bg-gray-50'
                                  }`}>
                                    <button
                                      onClick={() => handleAudioPlay(msg.id, msg.base64!)}
                                      className={`p-2 rounded-full ${
                                        isSentMessage ? 'bg-blue-700 hover:bg-blue-800' : 'bg-blue-500 hover:bg-blue-600'
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
                                      <p className={`text-[11px] ${isSentMessage ? 'text-blue-100' : 'text-gray-500'}`}>
                                        Clique para {playingAudio === msg.id ? 'pausar' : 'reproduzir'}
                                      </p>
                                    </div>
                                    <Mic className={`w-5 h-5 ${isSentMessage ? 'text-blue-100' : 'text-blue-500'}`} />
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
                                      isSentMessage ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-50 hover:bg-gray-100'
                                    } transition`}
                                  >
                                    <FileText className="w-8 h-8 flex-shrink-0" />
                                    <div className="flex-1 min-w-0 text-left">
                                      <p className="text-sm font-medium truncate">
                                        {msg.message || 'Documento'}
                                      </p>
                                      <p className={`text-[11px] ${isSentMessage ? 'text-blue-100' : 'text-gray-500'}`}>
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
                                      isSentMessage ? 'bg-blue-600' : 'bg-gray-50'
                                    } hover:opacity-90 transition`}
                                  >
                                    <FileText className="w-8 h-8 flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium truncate">
                                        {msg.message || 'Documento'}
                                      </p>
                                      <p className={`text-[11px] ${isSentMessage ? 'text-blue-100' : 'text-gray-500'}`}>
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
                                <span className={`text-[10px] ${isSentMessage ? 'text-blue-100' : 'text-gray-400'}`}>
                                  {formatTime(msg)}
                                </span>
                                {isSentMessage && (
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

            <div className="bg-white px-6 py-4 border-t border-gray-200">
              {filePreview && (
                <div className="mb-3 px-4 py-3 bg-blue-50/80 backdrop-blur-sm border border-blue-200/50 rounded-xl">
                  <div className="flex items-start gap-3">
                    <img src={filePreview} alt="Preview" className="w-20 h-20 object-cover rounded-lg" />
                    <div className="flex-1">
                      <p className="text-xs text-blue-600 mb-1 font-medium">Imagem selecionada</p>
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
                    className="p-1.5 text-gray-400 hover:text-sky-500 transition-all"
                    title="Emoji"
                  >
                    <Smile className="w-5 h-5" />
                  </button>
                </div>

                <button
                  onClick={handleSendMessage}
                  disabled={(!messageText.trim() && !selectedFile) || sending}
                  className="p-3 bg-sky-500 hover:bg-sky-600 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
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
              <div className="w-32 h-32 bg-gradient-to-br from-blue-100 to-blue-200 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                <MessageSquare className="w-16 h-16 text-blue-500" />
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
                  setSelectedTags([]);
                }}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                  <Briefcase className="w-4 h-4 text-blue-600" />
                  Departamento
                </label>
                <select
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white transition-all text-gray-900"
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
                  <FolderTree className="w-4 h-4 text-blue-600" />
                  Setor
                </label>
                <select
                  value={selectedSector}
                  onChange={(e) => setSelectedSector(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white transition-all text-gray-900"
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
                  <Tag className="w-4 h-4 text-blue-600" />
                  Tags (máx. 5)
                </label>
                <div className="space-y-2 max-h-60 overflow-y-auto bg-gray-50 border border-gray-200 rounded-xl p-3">
                  {tags.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-3">Nenhuma tag disponível</p>
                  ) : (
                    tags.map((tag) => (
                      <label
                        key={tag.id}
                        className="flex items-center gap-3 p-3 hover:bg-white rounded-lg cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={selectedTags.includes(tag.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              if (selectedTags.length < 5) {
                                setSelectedTags([...selectedTags, tag.id]);
                              } else {
                                setToastMessage('Você pode selecionar no máximo 5 tags');
                                setShowToast(true);
                              }
                            } else {
                              setSelectedTags(selectedTags.filter(id => id !== tag.id));
                            }
                          }}
                          className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          disabled={!selectedTags.includes(tag.id) && selectedTags.length >= 5}
                        />
                        <span
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-white flex-1"
                          style={{ backgroundColor: tag.color }}
                        >
                          <Tag className="w-4 h-4" />
                          {tag.name}
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowOptionsMenu(false);
                    setSelectedDepartment('');
                    setSelectedSector('');
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
