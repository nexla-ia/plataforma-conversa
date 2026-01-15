import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, Message } from '../lib/supabase';
import { MessageSquare, LogOut, MoreVertical, Search, RefreshCw, AlertCircle, CheckCheck, FileText, Download, User, Menu, X, Send, Paperclip, Image as ImageIcon, Mic, Smile, Play, Pause } from 'lucide-react';

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
  const [messageText, setMessageText] = useState('');
  const [imageCaption, setImageCaption] = useState('');
  const [sending, setSending] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [imageModalSrc, setImageModalSrc] = useState('');
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
        const dateA = new Date(a.date_time || a.timestamp || a.created_at || 0).getTime();
        const dateB = new Date(b.date_time || b.timestamp || b.created_at || 0).getTime();
        return dateA - dateB;
      });

      setMessages(allMessages);
      setTimeout(scrollToBottom, 100);
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
        const dateA = new Date(a.date_time || a.timestamp || a.created_at || 0).getTime();
        const dateB = new Date(b.date_time || b.timestamp || b.created_at || 0).getTime();
        return dateA - dateB;
      });

      const lastMsg = contact.messages[contact.messages.length - 1];
      contact.lastMessage = lastMsg.message || (lastMsg.urlimagem ? 'Imagem' : (lastMsg.urlpdf ? 'Documento' : 'Mensagem'));
      contact.lastMessageTime = lastMsg.date_time || lastMsg.timestamp || lastMsg.created_at || '';
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

  const handleSendMessage = async () => {
    if (!messageText.trim() || sending) return;

    await sendMessage({
      message: messageText.trim(),
      tipomessage: 'conversation',
    });
  };

  const handleFileUpload = async (file: File, type: 'image' | 'document' | 'audio') => {
    if (!company || !selectedContact) return;

    setUploadingFile(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
      const filePath = `${company.api_key}/${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('message-files')
        .upload(filePath, file);

      if (uploadError) {
        console.error('Erro ao fazer upload:', uploadError);
        alert('Erro ao fazer upload do arquivo');
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('message-files')
        .getPublicUrl(filePath);

      const messageData: Partial<Message> = {
        tipomessage: type === 'image' ? 'imageMessage' : type === 'audio' ? 'audioMessage' : 'documentMessage',
        mimetype: file.type,
      };

      if (type === 'image') {
        messageData.urlimagem = publicUrl;
        messageData.message = imageCaption || 'Imagem';
        if (imageCaption) {
          messageData.caption = imageCaption;
        }
      } else if (type === 'document') {
        messageData.urlpdf = publicUrl;
        messageData.message = file.name;
      } else if (type === 'audio') {
        messageData.urlpdf = publicUrl;
        messageData.message = 'Áudio';
      }

      await sendMessage(messageData);
      setImageCaption('');
    } catch (err) {
      console.error('Erro ao fazer upload:', err);
      alert('Erro ao fazer upload do arquivo');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file, 'image');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file, 'document');
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
    <div className="h-screen flex bg-gray-50 overflow-hidden">
      <div
        className={`${
          sidebarOpen ? 'flex' : 'hidden'
        } md:flex w-full md:w-[380px] bg-white border-r border-gray-200 flex-col`}
      >
        <header className="bg-white px-5 py-4 flex items-center justify-between border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-teal-500 rounded-full flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-gray-900 font-semibold text-base">{company?.name}</h2>
              <p className="text-xs text-gray-500">Atendimento Multicanal</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => fetchMessages()}
              disabled={refreshing}
              className="p-2 text-gray-500 hover:text-teal-600 hover:bg-gray-100 rounded-full transition disabled:opacity-50"
              title="Atualizar"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => signOut()}
              className="p-2 text-gray-500 hover:text-teal-600 hover:bg-gray-100 rounded-full transition"
              title="Sair"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {error && (
          <div className="bg-red-50 border-b border-red-200 px-4 py-2 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <p className="text-red-700 text-xs flex-1">{error}</p>
          </div>
        )}

        <div className="px-4 py-3 bg-white border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Pesquisar contato"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-50 text-gray-900 text-sm pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-gray-50">
          {filteredContacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-4">
              <MessageSquare className="w-12 h-12 text-gray-300 mb-3" />
              <p className="text-gray-500 text-sm text-center">
                {searchTerm ? 'Nenhum contato encontrado' : 'Nenhuma conversa ainda'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredContacts.map((contact) => (
                <button
                  key={contact.phoneNumber}
                  onClick={() => {
                    setSelectedContact(contact.phoneNumber);
                    if (window.innerWidth < 768) {
                      setSidebarOpen(false);
                    }
                  }}
                  className={`w-full px-4 py-4 flex items-center gap-3 hover:bg-white transition ${
                    selectedContact === contact.phoneNumber ? 'bg-teal-50 border-r-4 border-teal-500' : 'bg-gray-50'
                  }`}
                >
                  <div className="w-11 h-11 bg-gradient-to-br from-teal-400 to-teal-600 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 text-left overflow-hidden">
                    <div className="flex items-center justify-between mb-0.5">
                      <h3 className="text-gray-900 font-semibold text-sm truncate">{contact.name}</h3>
                      <span className="text-xs text-gray-400 ml-2 font-medium">
                        {formatTime(contact.lastMessageTime)}
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
              ))}
            </div>
          )}
        </div>
      </div>

      <div className={`flex-1 flex-col ${sidebarOpen ? 'hidden md:flex' : 'flex'}`}>
        {selectedContactData ? (
          <>
            <header className="bg-white px-5 py-4 flex items-center justify-between shadow-sm border-b border-gray-200">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="md:hidden p-2 text-gray-500 hover:text-teal-600 hover:bg-gray-100 rounded-full transition"
                >
                  <Menu className="w-5 h-5" />
                </button>
                <div className="w-10 h-10 bg-gradient-to-br from-teal-400 to-teal-600 rounded-full flex items-center justify-center shadow-sm">
                  <User className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-gray-900 font-semibold text-base">{selectedContactData.name}</h1>
                  <p className="text-gray-500 text-xs">{getPhoneNumber(selectedContactData.phoneNumber)}</p>
                </div>
              </div>
              <button
                className="p-2 text-gray-500 hover:text-teal-600 hover:bg-gray-100 rounded-full transition"
                title="Mais opções"
              >
                <MoreVertical className="w-5 h-5" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto bg-gray-50 px-6 py-4">
              <div className="max-w-5xl mx-auto">
                {Object.entries(messageGroups).map(([date, msgs]) => (
                  <div key={date} className="mb-6">
                    <div className="flex justify-center mb-4">
                      <div className="bg-white px-3 py-1 rounded-full shadow-sm">
                        <p className="text-[11px] text-gray-500 font-medium">{date}</p>
                      </div>
                    </div>
                    <div className="space-y-2">
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
                              className={`max-w-[65%] rounded-2xl ${
                                isSentMessage
                                  ? 'bg-teal-500 text-white rounded-br-sm'
                                  : 'bg-white text-gray-900 rounded-bl-sm shadow-sm'
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
                                  {formatTime(msg.date_time || msg.created_at)}
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

            <div className="bg-white px-5 py-3.5 border-t border-gray-200">
              {imageCaption && (
                <div className="mb-2 px-3 py-2 bg-teal-50 border border-teal-200 rounded-lg">
                  <p className="text-xs text-teal-600 mb-1">Legenda da imagem:</p>
                  <p className="text-sm text-gray-700">{imageCaption}</p>
                  <button
                    onClick={() => setImageCaption('')}
                    className="text-xs text-red-500 hover:text-red-700 mt-1"
                  >
                    Remover legenda
                  </button>
                </div>
              )}
              <div className="mb-2">
                <input
                  type="text"
                  value={imageCaption}
                  onChange={(e) => setImageCaption(e.target.value)}
                  placeholder="Legenda para imagem (opcional)"
                  className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-teal-400 transition"
                />
              </div>
              <div className="flex items-center gap-2">
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
                  disabled={uploadingFile || sending}
                  className="p-2 text-gray-400 hover:text-teal-500 hover:bg-gray-50 rounded-lg transition disabled:opacity-50"
                  title="Enviar imagem"
                >
                  <ImageIcon className="w-5 h-5" />
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingFile || sending}
                  className="p-2 text-gray-400 hover:text-teal-500 hover:bg-gray-50 rounded-lg transition disabled:opacity-50"
                  title="Enviar arquivo"
                >
                  <Paperclip className="w-5 h-5" />
                </button>

                <div className="flex-1 bg-gray-50 rounded-3xl flex items-center px-4 py-2.5 border border-gray-200 focus-within:border-teal-400 transition">
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
                    disabled={sending || uploadingFile}
                    className="flex-1 bg-transparent text-gray-900 placeholder-gray-400 focus:outline-none disabled:opacity-50 text-sm"
                  />
                  <button
                    className="p-1 text-gray-400 hover:text-teal-500 transition ml-1"
                    title="Emoji"
                  >
                    <Smile className="w-5 h-5" />
                  </button>
                </div>

                <button
                  onClick={handleSendMessage}
                  disabled={!messageText.trim() || sending || uploadingFile}
                  className="p-3 bg-teal-500 hover:bg-teal-600 rounded-full transition disabled:opacity-40 disabled:cursor-not-allowed shadow-md"
                  title="Enviar mensagem"
                >
                  {sending || uploadingFile ? (
                    <RefreshCw className="w-5 h-5 text-white animate-spin" />
                  ) : (
                    <Send className="w-5 h-5 text-white" />
                  )}
                </button>
              </div>

              {uploadingFile && (
                <div className="mt-2 text-center">
                  <p className="text-xs text-gray-500">Enviando arquivo...</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <div className="w-32 h-32 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <MessageSquare className="w-16 h-16 text-teal-500" />
              </div>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">Selecione uma conversa para começar</h3>
              <p className="text-gray-400 text-sm">Escolha um contato na lista à esquerda</p>
            </div>
          </div>
        )}
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
    </div>
  );
}
