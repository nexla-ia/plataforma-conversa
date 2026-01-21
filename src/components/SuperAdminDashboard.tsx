import { useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { Menu, X, Building2, MessageSquare, Plus, LogOut, Search, User, Send, Paperclip, Image as ImageIcon, RefreshCw, Loader2 } from "lucide-react";

type Company = {
  id: string;
  api_key: string;
  name: string;
  phone_number: string;
  email: string;
  user_id: string | null;
  is_super_admin?: boolean | null;
  created_at?: string;
};

type Message = {
  id: string;
  message: string | null;
  numero: string | null;
  pushname: string | null;
  tipomessage: string | null;
  created_at: string | null;
  apikey_instancia: string;
  company_id: string | null;
  caption: string | null;
  base64?: string | null;
  urlimagem?: string | null;
  urlpdf?: string | null;
  mimetype?: string | null;
  date_time?: string | null;
  'minha?'?: string | null;
};

type TabType = "empresas" | "mensagens";

export default function SuperAdminDashboard() {
  const { signOut } = useAuth();
  const [userEmail, setUserEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("empresas");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);

  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [messageText, setMessageText] = useState("");
  const [imageCaption, setImageCaption] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // form
  const [name, setName] = useState("");
  const [phone_number, setPhoneNumber] = useState("");
  const [api_key, setApiKey] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [maxAttendants, setMaxAttendants] = useState("5");

  // =========================
  // Formatação de Telefone
  // =========================
  const formatPhoneNumber = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 10) {
      return numbers
        .replace(/(\d{2})(\d)/, "($1) $2")
        .replace(/(\d{4})(\d)/, "$1-$2");
    }
    return numbers
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{5})(\d)/, "$1-$2")
      .slice(0, 15);
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhoneNumber(formatted);
  };

  const generateApiKey = () => {
    const uuid = crypto.randomUUID();
    setApiKey(uuid);
  };

  // =========================
  // Load user + companies + messages
  // =========================
  useEffect(() => {
    (async () => {
      setLoading(true);
      setErrorMsg(null);

      const {
        data: { session },
        error: sessErr,
      } = await supabase.auth.getSession();

      if (sessErr) {
        setErrorMsg(sessErr.message);
        setLoading(false);
        return;
      }

      if (!session?.user) {
        setErrorMsg("Sem sessão. Faça login novamente.");
        setLoading(false);
        return;
      }

      setUserEmail(session.user.email ?? "");
      setUserId(session.user.id);

      await Promise.all([loadCompanies(), loadMessages()]);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const messagesInterval = setInterval(() => {
      loadMessages();
    }, 1000);

    const companiesInterval = setInterval(() => {
      loadCompanies();
    }, 1000);

    const messagesChannel = supabase
      .channel('super-admin-messages')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
        },
        () => {
          loadMessages();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sent_messages',
        },
        () => {
          loadMessages();
        }
      )
      .subscribe();

    const companiesChannel = supabase
      .channel('super-admin-companies')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'companies',
        },
        () => {
          loadCompanies();
        }
      )
      .subscribe();

    return () => {
      clearInterval(messagesInterval);
      clearInterval(companiesInterval);
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(companiesChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedChat) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [selectedChat]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [messages.length]);

  const loadCompanies = async () => {
    setErrorMsg(null);

    const { data, error } = await supabase
      .from("companies")
      .select("id,api_key,name,phone_number,email,user_id,is_super_admin,created_at")
      .order("created_at", { ascending: false });

    if (error) {
      setErrorMsg(error.message);
      setCompanies([]);
      return;
    }

    setCompanies((data as Company[]) || []);
  };

  const loadMessages = async () => {
    const [receivedResult, sentResult] = await Promise.all([
      supabase
        .from("messages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("sent_messages")
        .select("*")
        .order("date_time", { ascending: false })
        .limit(100)
    ]);

    if (receivedResult.error) {
      console.error("Error loading messages:", receivedResult.error);
      setMessages([]);
      return;
    }

    if (sentResult.error) {
      console.error("Error loading sent messages:", sentResult.error);
    }

    const allMessages = [
      ...(receivedResult.data || []),
      ...(sentResult.data || [])
    ];

    setMessages((allMessages as Message[]) || []);
  };

  // =========================
  // Create company
  // =========================
  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (
      !name.trim() ||
      !phone_number.trim() ||
      !api_key.trim() ||
      !email.trim() ||
      !password.trim()
    ) {
      setErrorMsg("Preencha todos os campos.");
      return;
    }

    const phoneNumbers = phone_number.replace(/\D/g, "");
    if (phoneNumbers.length < 10) {
      setErrorMsg("Telefone deve ter pelo menos 10 dígitos.");
      return;
    }

    if (password.length < 6) {
      setErrorMsg("Senha deve ter no mínimo 6 caracteres.");
      return;
    }

    setCreating(true);

    try {
      const {
        data: { session },
        error: sessErr,
      } = await supabase.auth.getSession();

      if (sessErr) throw sessErr;
      if (!session?.access_token) {
        throw new Error("Sem token. Faça login novamente.");
      }

      console.log("SESSION:", session);
      console.log("ACCESS_TOKEN:", session?.access_token?.slice(0, 30));

      const response = await supabase.functions.invoke("create-company", {
        body: {
          email: email.trim().toLowerCase(),
          password,
          name: name.trim(),
          phone_number: phone_number.trim(),
          api_key: api_key.trim(),
          max_attendants: parseInt(maxAttendants) || 5,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      console.log("Response completo:", response);

      if (response.error) {
        console.error("Erro create-company:", response.error);
        const errorDetails = response.data?.error || response.data?.details || response.error.message;
        throw new Error(errorDetails || "Erro ao criar empresa.");
      }

      console.log("Empresa criada:", response.data);

      // limpa e fecha
      setShowForm(false);
      setName("");
      setPhoneNumber("");
      setApiKey("");
      setEmail("");
      setPassword("");
      setMaxAttendants("5");

      // recarrega lista
      await loadCompanies();
    } catch (err: any) {
      console.error("handleCreateCompany:", err);
      setErrorMsg(err?.message ?? "Erro inesperado.");
    } finally {
      setCreating(false);
    }
  };


  const handleDeleteCompany = async (companyId: string, companyName: string) => {
    if (!confirm(`Tem certeza que deseja deletar a empresa "${companyName}"?\n\nIsto irá deletar PERMANENTEMENTE:\n• Todos os atendentes\n• Todos os departamentos\n• Todos os setores\n• Todas as tags\n• Todas as mensagens\n\nEsta ação não pode ser desfeita!`)) {
      return;
    }

    try {
      const { data, error } = await supabase.rpc('delete_company_cascade', {
        company_uuid: companyId
      });

      if (error) {
        console.error('Erro ao deletar empresa:', error);
        setErrorMsg('Erro ao deletar empresa: ' + error.message);
        return;
      }

      if (data?.success) {
        const deleted = data.deleted;
        const deletionSummary = `Empresa "${companyName}" deletada com sucesso!\n\nItens removidos:\n• ${deleted.attendants} atendente(s)\n• ${deleted.attendant_users} usuário(s) de atendente do Auth\n• ${deleted.departments} departamento(s)\n• ${deleted.sectors} setor(es)\n• ${deleted.tags} tag(s)\n• ${deleted.messages} mensagem(ns) recebida(s)\n• ${deleted.sent_messages} mensagem(ns) enviada(s)\n• ${deleted.company_user} usuário da empresa no Auth`;

        alert(deletionSummary);
        await loadCompanies();
        await loadMessages();
      }
    } catch (err: any) {
      console.error('Erro ao deletar empresa:', err);
      setErrorMsg('Erro ao deletar empresa: ' + err.message);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const sendMessage = async (messageData: Partial<Message>, apiKey: string) => {
    if (!selectedChat) return;

    setSending(true);
    try {
      const generatedIdMessage = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const { data: existingMessages } = await supabase
        .from('messages')
        .select('instancia, company_id')
        .eq('numero', selectedChat)
        .eq('apikey_instancia', apiKey)
        .order('created_at', { ascending: false })
        .limit(1);

      const instanciaValue = existingMessages?.[0]?.instancia || 'Admin';
      const companyId = existingMessages?.[0]?.company_id;

      const newMessage = {
        numero: selectedChat,
        sender: selectedChat,
        'minha?': 'true',
        pushname: 'Admin',
        apikey_instancia: apiKey,
        date_time: new Date().toISOString(),
        instancia: instanciaValue,
        idmessage: generatedIdMessage,
        company_id: companyId,
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
          numero: selectedChat,
          message: messageData.message || '',
          tipomessage: messageData.tipomessage || 'conversation',
          base64: messageData.base64 || null,
          urlimagem: messageData.urlimagem || null,
          urlpdf: messageData.urlpdf || null,
          caption: messageData.caption || null,
          idmessage: generatedIdMessage,
          pushname: 'Admin',
          timestamp: timestamp,
          instancia: instanciaValue,
          apikey_instancia: apiKey,
        };

        await fetch('https://n8n.nexladesenvolvimento.com.br/webhook/EnvioMensagemOPS', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(webhookPayload),
        });
      } catch (webhookError) {
        console.error('Erro ao chamar webhook:', webhookError);
      }

      setMessageText('');
      await loadMessages();
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
    if (sending || !selectedChat) return;
    if (!messageText.trim() && !selectedFile) return;

    const selectedChatData = filteredChats.find(c => c.numero === selectedChat);
    if (!selectedChatData || selectedChatData.messages.length === 0) return;

    const apiKey = selectedChatData.messages[0].apikey_instancia;

    setSending(true);
    try {
      if (selectedFile) {
        const base64 = await fileToBase64(selectedFile);
        const isImage = selectedFile.type.startsWith('image/');

        const messageData: Partial<Message> = {
          tipomessage: isImage ? 'imageMessage' : 'documentMessage',
          mimetype: selectedFile.type,
          base64: base64,
        };

        if (isImage) {
          messageData.message = imageCaption || messageText.trim() || 'Imagem';
          if (imageCaption) {
            messageData.caption = imageCaption;
          }
        } else {
          messageData.message = messageText.trim() || selectedFile.name;
        }

        await sendMessage(messageData, apiKey);
        setSelectedFile(null);
        setFilePreview(null);
        setImageCaption('');
      } else {
        await sendMessage({
          message: messageText.trim(),
          tipomessage: 'conversation',
        }, apiKey);
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

  const groupMessagesByContact = () => {
    const grouped: { [key: string]: Message[] } = {};

    messages.forEach((msg) => {
      const key = msg.numero || "unknown";
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(msg);
    });

    return Object.entries(grouped)
      .map(([numero, msgs]) => {
        const sortedMessages = msgs.sort((a, b) =>
          new Date(a.created_at || a.date_time || 0).getTime() - new Date(b.created_at || b.date_time || 0).getTime()
        );

        const lastMsg = sortedMessages[sortedMessages.length - 1];

        return {
          numero,
          pushname: lastMsg?.pushname || numero,
          lastMessage: lastMsg?.caption || lastMsg?.message || "",
          lastMessageTime: lastMsg?.created_at || lastMsg?.date_time || "",
          messages: sortedMessages,
          unreadCount: 0
        };
      })
      .sort((a, b) => {
        const timeA = new Date(a.lastMessageTime).getTime();
        const timeB = new Date(b.lastMessageTime).getTime();
        return timeB - timeA;
      });
  };

  const filteredChats = groupMessagesByContact().filter(chat =>
    chat.pushname.toLowerCase().includes(searchQuery.toLowerCase()) ||
    chat.numero.includes(searchQuery)
  );

  // =========================
  // UI
  // =========================

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-gray-100">
        <div className="text-center">
          <div className="text-4xl font-bold bg-gradient-to-r from-teal-500 to-teal-600 bg-clip-text text-transparent mb-4">
            NEXLA
          </div>
          <div className="text-gray-600 animate-pulse">Carregando...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 flex">
      <aside
        className={`${
          sidebarOpen ? "w-64" : "w-20"
        } bg-white/80 backdrop-blur-xl border-r border-gray-200/50 transition-all duration-300 flex flex-col relative shadow-lg`}
      >
        <div className="p-6 border-b border-gray-200/50">
          <div className="flex items-center justify-between">
            {sidebarOpen ? (
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-teal-500 to-teal-600 bg-clip-text text-transparent">
                  NEXLA
                </h1>
                <p className="text-xs text-gray-500 mt-1">Admin Portal</p>
              </div>
            ) : (
              <div className="text-2xl font-bold bg-gradient-to-r from-teal-500 to-teal-600 bg-clip-text text-transparent">
                N
              </div>
            )}
          </div>
        </div>

        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute -right-3 top-20 bg-white border border-teal-400/40 rounded-full p-1.5 text-teal-500 hover:bg-teal-50 transition-colors shadow-md"
        >
          {sidebarOpen ? <X size={16} /> : <Menu size={16} />}
        </button>

        <nav className="flex-1 p-4 space-y-2">
          <button
            onClick={() => setActiveTab("empresas")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
              activeTab === "empresas"
                ? "bg-gradient-to-r from-teal-50 to-teal-100/50 text-teal-600 border border-teal-200 shadow-sm"
                : "text-gray-600 hover:text-teal-600 hover:bg-gray-50"
            }`}
          >
            <Building2 size={20} />
            {sidebarOpen && (
              <div className="flex-1 text-left">
                <div className="font-medium">Empresas</div>
                <div className="text-xs opacity-70">{companies.length} cadastradas</div>
              </div>
            )}
          </button>
        </nav>

        <div className="p-4 border-t border-gray-200/50">
          <div className={`${sidebarOpen ? "" : "flex justify-center"}`}>
            {sidebarOpen && (
              <div className="mb-3">
                <div className="text-xs text-gray-500 mb-1">Logado como</div>
                <div className="text-sm text-gray-700 truncate">{userEmail}</div>
              </div>
            )}
            <button
              onClick={signOut}
              className={`${
                sidebarOpen ? "w-full" : ""
              } flex items-center gap-2 px-4 py-2 rounded-lg text-gray-600 hover:text-red-500 hover:bg-red-50 border border-gray-200 hover:border-red-200 transition-all`}
            >
              <LogOut size={18} />
              {sidebarOpen && <span>Sair</span>}
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="p-8">
          {errorMsg && (
            <div className="mb-6 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 backdrop-blur-sm">
              {errorMsg}
            </div>
          )}

          {activeTab === "empresas" && (
            <>
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-2">Empresas Cadastradas</h2>
                  <p className="text-gray-600">Gerencie todas as empresas do sistema</p>
                </div>

                <button
                  onClick={() => setShowForm(true)}
                  className="flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-teal-500 to-teal-600 text-white font-medium hover:from-teal-600 hover:to-teal-700 transition-all shadow-lg"
                >
                  <Plus size={20} />
                  Nova Empresa
                </button>
              </div>

              {showForm && (
                <div className="mb-8 rounded-2xl bg-white/80 border border-teal-200/50 p-6 backdrop-blur-sm shadow-lg">
                  <h3 className="text-xl font-semibold text-gray-900 mb-6">
                    Cadastrar Nova Empresa
                  </h3>

                  <form onSubmit={handleCreateCompany} className="grid gap-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-700 mb-2">
                          Nome da Empresa
                        </label>
                        <input
                          required
                          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Ex: Minha Empresa"
                        />
                      </div>

                      <div>
                        <label className="block text-sm text-gray-700 mb-2">
                          Número de Telefone
                        </label>
                        <input
                          required
                          type="tel"
                          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                          value={phone_number}
                          onChange={handlePhoneChange}
                          placeholder="(69) 99999-9999"
                          maxLength={15}
                        />
                      </div>

                      <div>
                        <label className="block text-sm text-gray-700 mb-2">
                          Chave API
                        </label>
                        <div className="flex gap-2">
                          <input
                            required
                            className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 font-mono text-sm"
                            value={api_key}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="UUID/chave"
                          />
                          <button
                            type="button"
                            onClick={generateApiKey}
                            className="rounded-lg bg-gray-100 px-4 py-2 text-gray-700 text-sm hover:bg-gray-200 border border-gray-300 transition-colors"
                          >
                            Gerar
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm text-gray-700 mb-2">
                          Email
                        </label>
                        <input
                          required
                          type="email"
                          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="empresa@dominio.com"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm text-gray-700 mb-2">
                        Senha <span className="text-gray-500 text-xs">(mínimo 6 caracteres)</span>
                      </label>
                      <input
                        required
                        type="password"
                        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="********"
                        minLength={6}
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-gray-700 mb-2">
                        Quantos atendentes pode ter?
                      </label>
                      <input
                        required
                        type="number"
                        min="1"
                        max="100"
                        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                        value={maxAttendants}
                        onChange={(e) => setMaxAttendants(e.target.value)}
                        placeholder="5"
                      />
                      <p className="text-xs text-gray-500 mt-1">Define o limite máximo de atendentes que esta empresa pode cadastrar</p>
                    </div>

                    <div className="flex items-center gap-3 mt-4">
                      <button
                        type="submit"
                        disabled={creating}
                        className="rounded-lg bg-gradient-to-r from-teal-500 to-teal-600 px-6 py-2.5 text-white font-medium hover:from-teal-600 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
                      >
                        {creating ? "Cadastrando..." : "Cadastrar Empresa"}
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowForm(false)}
                        className="rounded-lg border border-gray-300 px-6 py-2.5 text-gray-700 hover:bg-gray-100 transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {companies.length === 0 && (
                  <div className="col-span-full text-center py-16 text-gray-500">
                    Nenhuma empresa cadastrada.
                  </div>
                )}

                {companies.map((c, index) => (
                  <div
                    key={c.id}
                    className="group rounded-xl bg-white/80 border border-teal-200/50 p-6 hover:border-teal-300 hover:shadow-lg transition-all backdrop-blur-sm hover:scale-105 animate-fadeIn"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="text-xl font-semibold text-gray-900">{c.name}</div>
                      <div className="flex items-center gap-2">
                        {c.is_super_admin && (
                          <span className="text-xs px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-100 to-orange-100 text-amber-700 border border-amber-300 font-medium">
                            Admin
                          </span>
                        )}
                        {!c.is_super_admin && (
                          <button
                            onClick={() => handleDeleteCompany(c.id, c.name)}
                            className="p-2 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Deletar empresa"
                          >
                            <X size={18} />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3 text-sm">
                      <div className="flex items-center gap-3 text-gray-700">
                        <span className="text-teal-600">📞</span>
                        <span>{c.phone_number}</span>
                      </div>
                      <div className="flex items-center gap-3 text-gray-700">
                        <span className="text-teal-600">✉️</span>
                        <span className="break-all">{c.email}</span>
                      </div>
                      <div className="flex items-start gap-3 mt-4 pt-4 border-t border-gray-200">
                        <span className="text-teal-600">🔑</span>
                        <span className="break-all text-xs font-mono text-gray-600 bg-gray-50 px-2 py-1 rounded">
                          {c.api_key}
                        </span>
                      </div>
                      {c.user_id && (
                        <div className="flex items-start gap-3 pt-2 border-t border-gray-200">
                          <span className="text-teal-600">👤</span>
                          <span className="break-all text-xs font-mono text-gray-600">
                            {c.user_id}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {activeTab === "mensagens" && (
            <div className="h-[calc(100vh-4rem)] flex gap-4">
              <div className="w-80 bg-white/80 rounded-2xl border border-teal-200/50 backdrop-blur-sm flex flex-col overflow-hidden shadow-lg">
                <div className="p-4 border-b border-teal-200/50">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">Mensagens</h3>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="text"
                      placeholder="Pesquisar contato"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white border border-gray-300 text-gray-900 placeholder-gray-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 transition-all"
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                  {filteredChats.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                      Nenhuma conversa encontrada
                    </div>
                  )}

                  {filteredChats.map((chat, index) => (
                    <button
                      key={chat.numero}
                      onClick={() => setSelectedChat(chat.numero)}
                      className={`w-full p-4 flex items-center gap-3 border-b border-gray-200 hover:bg-gray-50 transition-all ${
                        selectedChat === chat.numero ? "bg-teal-50/50" : ""
                      } animate-fadeIn`}
                      style={{ animationDelay: `${index * 0.05}s` }}
                    >
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center text-white font-semibold flex-shrink-0 shadow-md">
                        <User size={24} />
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-gray-900 truncate">{chat.pushname}</span>
                          <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                            {chat.lastMessageTime
                              ? new Date(chat.lastMessageTime).toLocaleTimeString("pt-BR", {
                                  hour: "2-digit",
                                  minute: "2-digit"
                                })
                              : ""}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 truncate">{chat.lastMessage}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 bg-white/80 rounded-2xl border border-teal-200/50 backdrop-blur-sm flex flex-col overflow-hidden shadow-lg">
                {!selectedChat ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                      <MessageSquare size={64} className="mx-auto mb-4 text-gray-300" />
                      <p className="text-gray-500 text-lg">Selecione uma conversa para visualizar</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="p-4 border-b border-teal-200/50 flex items-center gap-3 bg-white/50 backdrop-blur-sm">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center text-white font-semibold shadow-md">
                        <User size={20} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {filteredChats.find((c) => c.numero === selectedChat)?.pushname}
                        </h3>
                        <p className="text-xs text-gray-600">{selectedChat}</p>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gradient-to-br from-gray-50 to-white">
                      {filteredChats
                        .find((c) => c.numero === selectedChat)
                        ?.messages.map((msg, index) => {
                          const isSentMessage = msg['minha?'] === 'true';
                          const hasBase64 = msg.base64 && msg.base64.trim() !== '';
                          const isImageMessage = msg.tipomessage?.toLowerCase().includes('image');

                          return (
                            <div
                              key={msg.id}
                              className={`flex animate-slideUp ${isSentMessage ? 'justify-end' : 'justify-start'}`}
                              style={{ animationDelay: `${index * 0.05}s` }}
                            >
                              <div className={`max-w-[70%] rounded-2xl px-4 py-3 shadow-lg ${
                                isSentMessage
                                  ? 'bg-gradient-to-br from-teal-500 to-teal-600 text-white rounded-br-md'
                                  : 'bg-white/90 text-gray-900 rounded-bl-md border border-teal-200/50'
                              }`}>
                                {msg.urlimagem && !hasBase64 && (
                                  <div className="mb-2">
                                    <img
                                      src={msg.urlimagem}
                                      alt="Imagem"
                                      className="rounded-xl max-w-full h-auto"
                                      style={{ maxHeight: '300px' }}
                                    />
                                  </div>
                                )}
                                {hasBase64 && isImageMessage && (
                                  <div className="mb-2">
                                    <img
                                      src={`data:image/jpeg;base64,${msg.base64}`}
                                      alt="Imagem"
                                      className="rounded-xl max-w-full h-auto"
                                      style={{ maxHeight: '300px' }}
                                    />
                                  </div>
                                )}
                                {(msg.message || msg.caption) && (
                                  <p className={`text-sm leading-relaxed break-words ${isSentMessage ? 'text-white' : 'text-gray-900'}`}>
                                    {msg.caption || msg.message}
                                  </p>
                                )}
                                <div className={`flex items-center gap-2 mt-2 text-xs ${isSentMessage ? 'text-teal-100' : 'text-gray-500'}`}>
                                  <span>
                                    {msg.created_at || msg.date_time
                                      ? new Date(msg.created_at || msg.date_time).toLocaleString("pt-BR", {
                                          day: "2-digit",
                                          month: "2-digit",
                                          year: "numeric",
                                          hour: "2-digit",
                                          minute: "2-digit"
                                        })
                                      : ""}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      <div ref={messagesEndRef} />
                    </div>

                    <div className="p-4 bg-white/50 backdrop-blur-sm border-t border-teal-200/50">
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
                        <div className="mb-2">
                          <input
                            type="text"
                            value={imageCaption}
                            onChange={(e) => setImageCaption(e.target.value)}
                            placeholder="Legenda para imagem (opcional)"
                            className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition"
                          />
                        </div>
                      )}

                      {selectedFile && !selectedFile.type.startsWith('image/') && (
                        <div className="mb-3 px-4 py-3 bg-gray-50/80 backdrop-blur-sm border border-gray-200/50 rounded-xl">
                          <div className="flex items-center gap-3">
                            <Paperclip className="w-8 h-8 text-gray-400" />
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
                          disabled={sending || !!selectedFile}
                          className="p-2.5 text-gray-500 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition disabled:opacity-50"
                          title="Enviar imagem"
                        >
                          <ImageIcon className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          disabled={sending || !!selectedFile}
                          className="p-2.5 text-gray-500 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition disabled:opacity-50"
                          title="Enviar arquivo"
                        >
                          <Paperclip className="w-5 h-5" />
                        </button>

                        <div className="flex-1 bg-white rounded-lg flex items-center px-4 py-2.5 border border-gray-300 focus-within:border-teal-500 transition">
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
                          className="p-3 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed shadow-lg"
                          title="Enviar mensagem"
                        >
                          {sending ? (
                            <RefreshCw className="w-5 h-5 text-white animate-spin" />
                          ) : (
                            <Send className="w-5 h-5 text-white" />
                          )}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
