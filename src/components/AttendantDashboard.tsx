import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { MessageCircle, LogOut, Send, User, Search, Menu, CheckCheck, Tag, MoreVertical, X, Image as ImageIcon, Paperclip, FileText, Loader2 } from 'lucide-react';
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
  console.log('🔄 AttendantDashboard renderizou. Attendant:', attendant?.name, 'Company:', company?.name);

  const [messages, setMessages] = useState<Message[]>([]);
  const [contactsDB, setContactsDB] = useState<ContactDB[]>([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sector, setSector] = useState<Sector | null>(null);
  const [selectedContact, setSelectedContact] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showTagsModal, setShowTagsModal] = useState(false);
  const [modalContactPhone, setModalContactPhone] = useState<string | null>(null);
  const [tags, setTags] = useState<TagItem[]>([]);
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


  useEffect(() => {
    console.log('=== USEEFFECT PRINCIPAL ===');
    console.log('Attendant existe?', !!attendant);
    console.log('Company existe?', !!company);
    console.log('Company API Key:', company?.api_key);

    if (attendant && company) {
      console.log('✓ Attendant e Company carregados. Iniciando fetch...');
      fetchSector();
      fetchMessages();
      fetchContacts();
      fetchDepartments();
      fetchSectors();
      fetchTags();
      subscribeToMessages();
    } else {
      console.log('✗ Attendant ou Company não carregados ainda');
      setLoading(false);
    }
  }, [attendant, company]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchContacts = async () => {
    if (!company?.id) {
      console.log('fetchContacts: company.id não existe');
      return;
    }

    try {
      console.log('=== FETCH CONTACTS ===');
      console.log('Buscando contatos para company_id:', company.id);

      // Buscar TODOS os contatos da empresa
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('company_id', company.id)
        .order('last_message_time', { ascending: false });

      if (error) {
        console.error('Erro ao buscar contatos:', error);
        return;
      }

      if (!data) {
        console.log('Nenhum contato retornado');
        return;
      }

      console.log('Contatos (antes filtro):', data.length);

      // Filtrar no client-side baseado no departamento e setor do atendente
      let filteredContacts = data;
      if (attendant?.department_id || attendant?.sector_id) {
        filteredContacts = data.filter((contact) => {
          // Se o atendente tem departamento, o contato DEVE ter o mesmo departamento
          const deptMatch = !attendant?.department_id ||
                           contact.department_id === attendant.department_id;

          // Se o atendente tem setor, o contato DEVE ter o mesmo setor
          const sectorMatch = !attendant?.sector_id ||
                             contact.sector_id === attendant.sector_id;

          // Deve satisfazer AMBAS as condições
          return deptMatch && sectorMatch;
        });
      }

      console.log('Contatos (após filtro):', filteredContacts.length);

      // Buscar tags para cada contato
      const contactsWithTags = await Promise.all(
        filteredContacts.map(async (contact) => {
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

      console.log('✓ Salvando', contactsWithTags.length, 'contacts no state');
      setContactsDB(contactsWithTags);
    } catch (error) {
      console.error('❌ ERRO ao carregar contatos:', error);
    }
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
    if (!modalContactPhone || !company?.id) return;

    try {
      // Buscar tags atuais do contato para verificar se houve mudança
      const currentContact = contactsDB.find(c => c.phone_number === modalContactPhone);
      const currentTags = currentContact?.tag_ids || [];

      const tagsChanged =
        selectedTags.length !== currentTags.length ||
        !selectedTags.every(tag => currentTags.includes(tag));

      if (!tagsChanged) {
        setToastMessage('Nenhuma alteração foi feita');
        setShowToast(true);
        return;
      }

      // Buscar o ID do contato no banco
      const { data: contactData } = await supabase
        .from('contacts')
        .select('id')
        .eq('company_id', company.id)
        .eq('phone_number', modalContactPhone)
        .maybeSingle();

      if (!contactData) {
        throw new Error('Contato não encontrado');
      }

      const contactId = contactData.id;

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

        if (tagsError) throw tagsError;
      }

      setToastMessage('Tags atualizadas com sucesso!');
      setShowToast(true);
      setShowTagsModal(false);
      setModalContactPhone(null);
      setSelectedTags([]);
      fetchContacts();
    } catch (error) {
      console.error('Erro ao atualizar tags:', error);
      setToastMessage('Erro ao atualizar tags');
      setShowToast(true);
    }
  };

  const fetchMessages = async () => {
    console.log('=== INÍCIO FETCH MESSAGES ===');
    console.log('Company:', { id: company?.id, name: company?.name, api_key: company?.api_key });
    console.log('Attendant:', {
      id: attendant?.id,
      name: attendant?.name,
      dept: attendant?.department_id,
      sector: attendant?.sector_id
    });

    if (!company?.api_key) {
      console.log('ABORTAR: company.api_key não existe');
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      console.log('Buscando mensagens com apikey_instancia:', company.api_key);

      // Buscar TODAS as mensagens da empresa
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

      if (receivedResult.error) {
        console.error('Erro ao buscar mensagens recebidas:', receivedResult.error);
        throw receivedResult.error;
      }

      if (sentResult.error) {
        console.error('Erro ao buscar mensagens enviadas:', sentResult.error);
        throw sentResult.error;
      }

      console.log('Mensagens recebidas (antes filtro):', receivedResult.data?.length || 0);
      console.log('Mensagens enviadas (antes filtro):', sentResult.data?.length || 0);

      // Combinar todas as mensagens
      let allMessages = [
        ...(receivedResult.data || []),
        ...(sentResult.data || [])
      ];

      console.log('Total antes do filtro:', allMessages.length);

      // Mostrar amostra dos dados para debug
      if (allMessages.length > 0) {
        console.log('Exemplo de mensagem:', {
          numero: allMessages[0].numero,
          department_id: allMessages[0].department_id,
          sector_id: allMessages[0].sector_id,
          message: allMessages[0].message?.substring(0, 50)
        });
      }

      // Filtrar no client-side baseado no departamento e setor do atendente
      if (attendant?.department_id || attendant?.sector_id) {
        const beforeFilter = allMessages.length;
        allMessages = allMessages.filter((msg) => {
          // Se o atendente tem departamento, a mensagem DEVE ter o mesmo departamento
          const deptMatch = !attendant?.department_id ||
                           msg.department_id === attendant.department_id;

          // Se o atendente tem setor, a mensagem DEVE ter o mesmo setor
          const sectorMatch = !attendant?.sector_id ||
                             msg.sector_id === attendant.sector_id;

          // Deve satisfazer AMBAS as condições
          return deptMatch && sectorMatch;
        });
        console.log(`Filtro aplicado: ${beforeFilter} → ${allMessages.length} mensagens`);
      } else {
        console.log('Sem filtro (atendente sem dept/sector)');
      }

      console.log('Total de mensagens (após filtro):', allMessages.length);

      // Ordenar por timestamp
      allMessages.sort((a, b) => {
        return getMessageTimestamp(a) - getMessageTimestamp(b);
      });

      console.log('✓ Salvando', allMessages.length, 'mensagens no state');
      setMessages(allMessages);
      setTimeout(scrollToBottom, 100);
    } catch (error) {
      console.error('❌ ERRO ao carregar mensagens:', error);
    } finally {
      console.log('=== FIM FETCH MESSAGES ===');
      setLoading(false);
    }
  };

  const subscribeToMessages = () => {
    if (!company?.api_key || !company?.id) return;

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
      const departmentId = existingMessages?.[0]?.department_id || attendant?.department_id || null;
      const sectorId = existingMessages?.[0]?.sector_id || attendant?.sector_id || null;
      const tagId = existingMessages?.[0]?.tag_id || null;

      const newMessage = {
        numero: selectedContact,
        sender: selectedContact,
        'minha?': 'true',
        pushname: attendant?.name || company.name,
        apikey_instancia: company.api_key,
        date_time: new Date().toISOString(),
        instancia: instanciaValue,
        idmessage: generatedIdMessage,
        company_id: company.id,
        department_id: departmentId,
        sector_id: sectorId,
        tag_id: tagId,
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

        // Formatar mensagem quando for atendente: (Função) - (Nome)\nMensagem
        let formattedMessage = messageData.message || '';
        if (attendant && attendant.function && messageData.tipomessage === 'conversation') {
          formattedMessage = `(${attendant.function}) - ${attendant.name}\n${formattedMessage}`;
        }

        // Formatar caption para imagens/documentos quando for atendente
        let formattedCaption = messageData.caption || null;
        if (attendant && attendant.function && formattedCaption && messageData.tipomessage !== 'conversation') {
          formattedCaption = `(${attendant.function}) - ${attendant.name}\n${formattedCaption}`;
        }

        const webhookPayload = {
          numero: selectedContact,
          message: formattedMessage,
          tipomessage: messageData.tipomessage || 'conversation',
          base64: messageData.base64 || null,
          urlimagem: messageData.urlimagem || null,
          urlpdf: messageData.urlpdf || null,
          caption: formattedCaption,
          idmessage: generatedIdMessage,
          pushname: attendant?.name || company.name,
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
    // Normalizar: pegar sempre o 'numero' e remover @s.whatsapp.net
    const rawNumber = msg.numero || msg.sender || 'Desconhecido';
    const normalized = rawNumber.includes('@') ? rawNumber.split('@')[0] : rawNumber;
    return normalized;
  };

  const getPhoneNumber = (contactId: string): string => {
    // Já normalizado pela getContactId
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
    console.log('Agrupando mensagens por contato. Total de mensagens:', messages.length);
    console.log('ContactsDB disponíveis:', contactsDB.length);

    if (contactsDB.length > 0) {
      console.log('Exemplo contactDB phone_number:', contactsDB[0].phone_number);
    }

    const contactsMap: { [key: string]: Contact } = {};

    messages.forEach((msg, idx) => {
      const contactId = getContactId(msg); // já normalizado

      if (idx < 2) {
        console.log(`Mensagem ${idx} contactId normalizado:`, contactId, 'numero raw:', msg.numero);
      }

      if (!contactsMap[contactId]) {
        // Buscar informações do contato na tabela contacts
        // Normalizar o phone_number do contactDB para comparar
        const contactDB = contactsDB.find(c => {
          const normalizedPhone = c.phone_number.includes('@')
            ? c.phone_number.split('@')[0]
            : c.phone_number;
          return normalizedPhone === contactId;
        });

        if (idx < 2) {
          console.log(`ContactDB encontrado para ${contactId}:`, !!contactDB, contactDB?.name);
        }

        contactsMap[contactId] = {
          phoneNumber: contactId,
          name: getContactName(msg),
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

    console.log('Contatos agrupados:', contacts.length);
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
      {showToast && (
        <Toast
          message={toastMessage}
          onClose={() => setShowToast(false)}
        />
      )}
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
                      ? 'bg-gradient-to-r from-blue-50 to-blue-100/50 shadow-sm'
                      : 'hover:bg-white/40'
                  }`}
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
                    {contact.tag_ids && contact.tag_ids.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {contact.tag_ids.map((tagId) => {
                          const tag = tags.find(t => t.id === tagId);
                          return tag ? (
                            <span
                              key={tagId}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-white"
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
      </div>

      <div className={`flex-1 flex-col ${sidebarOpen ? 'hidden md:flex' : 'flex'}`}>
        {selectedContactData ? (
          <>
            <header className="bg-white/70 backdrop-blur-xl px-6 py-5 flex items-center justify-between shadow-sm border-b border-gray-200/50">
              <div className="flex items-center gap-3 flex-1">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="md:hidden p-2 text-gray-500 hover:text-blue-600 hover:bg-gray-100/50 rounded-xl transition-all"
                >
                  <Menu className="w-5 h-5" />
                </button>
                <div className="w-11 h-11 bg-gradient-to-br from-blue-400 to-blue-600 rounded-2xl flex items-center justify-center shadow-md">
                  <User className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h1 className="text-gray-900 font-bold text-base tracking-tight">{selectedContactData.name}</h1>
                  <p className="text-gray-500 text-xs mb-1">{getPhoneNumber(selectedContactData.phoneNumber)}</p>
                  <div className="flex flex-wrap gap-2">
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
                  const currentContact = contactsDB.find(c => c.phone_number === selectedContact);
                  setSelectedTags(currentContact?.tag_ids || []);
                  setModalContactPhone(selectedContact);
                  setShowTagsModal(true);
                }}
                className="p-2.5 text-gray-400 hover:text-blue-600 hover:bg-gray-100/50 rounded-xl transition-all"
                title="Adicionar tags"
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
                  className="p-3 text-gray-400 hover:text-blue-500 hover:bg-white/60 rounded-xl transition-all disabled:opacity-50"
                  title="Enviar imagem"
                >
                  <ImageIcon className="w-5 h-5" />
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={sending || !!selectedFile}
                  className="p-3 text-gray-400 hover:text-blue-500 hover:bg-white/60 rounded-xl transition-all disabled:opacity-50"
                  title="Enviar arquivo"
                >
                  <Paperclip className="w-5 h-5" />
                </button>

                <div className="flex-1 bg-white/60 rounded-2xl flex items-center px-5 py-3 border border-gray-200/50 focus-within:border-blue-400 focus-within:bg-white transition-all">
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
                </div>

                <button
                  onClick={handleSendMessage}
                  disabled={(!messageText.trim() && !selectedFile) || sending}
                  className="p-3.5 bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 rounded-2xl transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
                  title="Enviar mensagem"
                >
                  {sending ? (
                    <Loader2 className="w-5 h-5 text-white animate-spin" />
                  ) : (
                    <Send className="w-5 h-5 text-white" />
                  )}
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

      {showTagsModal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowTagsModal(false);
            }
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
