import { useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabase";
import { Menu, X, Building2, MessageSquare, Plus, LogOut, Search, User, Send, Paperclip, Image as ImageIcon, RefreshCw } from "lucide-react";

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
};

type TabType = "empresas" | "mensagens";

export default function SuperAdminDashboard() {
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

      // recarrega lista
      await loadCompanies();
    } catch (err: any) {
      console.error("handleCreateCompany:", err);
      setErrorMsg(err?.message ?? "Erro inesperado.");
    } finally {
      setCreating(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  const handleDeleteCompany = async (companyId: string, companyName: string) => {
    if (!confirm(`Tem certeza que deseja deletar a empresa "${companyName}"? Esta ação não pode ser desfeita.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('companies')
        .delete()
        .eq('id', companyId);

      if (error) {
        console.error('Erro ao deletar empresa:', error);
        setErrorMsg('Erro ao deletar empresa: ' + error.message);
        return;
      }

      await loadCompanies();
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

  const handleSendMessage = async () => {
    if (!messageText.trim() || sending || !selectedChat) return;

    const selectedChatData = filteredChats.find(c => c.numero === selectedChat);
    if (!selectedChatData || selectedChatData.messages.length === 0) return;

    const apiKey = selectedChatData.messages[0].apikey_instancia;

    await sendMessage({
      message: messageText.trim(),
      tipomessage: 'conversation',
    }, apiKey);
  };

  const handleFileUpload = async (file: File, type: 'image' | 'document') => {
    if (!selectedChat) return;

    const selectedChatData = filteredChats.find(c => c.numero === selectedChat);
    if (!selectedChatData || selectedChatData.messages.length === 0) return;

    const apiKey = selectedChatData.messages[0].apikey_instancia;

    setUploadingFile(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
      const filePath = `${apiKey}/${fileName}`;

      const { error: uploadError } = await supabase.storage
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
        tipomessage: type === 'image' ? 'imageMessage' : 'documentMessage',
        mimetype: file.type,
      };

      if (type === 'image') {
        messageData.urlimagem = publicUrl;
        messageData.message = imageCaption || 'Imagem';
        if (imageCaption) {
          messageData.caption = imageCaption;
        }
      } else {
        messageData.urlpdf = publicUrl;
        messageData.message = file.name;
      }

      await sendMessage(messageData, apiKey);
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="text-center">
          <div className="text-4xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent mb-4">
            NEXLA
          </div>
          <div className="text-slate-400 animate-pulse">Carregando...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex">
      <aside
        className={`${
          sidebarOpen ? "w-64" : "w-20"
        } bg-slate-950 border-r border-cyan-500/20 transition-all duration-300 flex flex-col relative`}
      >
        <div className="p-6 border-b border-cyan-500/20">
          <div className="flex items-center justify-between">
            {sidebarOpen ? (
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                  NEXLA
                </h1>
                <p className="text-xs text-slate-400 mt-1">Admin Portal</p>
              </div>
            ) : (
              <div className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                N
              </div>
            )}
          </div>
        </div>

        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute -right-3 top-20 bg-slate-950 border border-cyan-500/40 rounded-full p-1.5 text-cyan-400 hover:bg-cyan-500/10 transition-colors"
        >
          {sidebarOpen ? <X size={16} /> : <Menu size={16} />}
        </button>

        <nav className="flex-1 p-4 space-y-2">
          <button
            onClick={() => setActiveTab("empresas")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
              activeTab === "empresas"
                ? "bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-400 border border-cyan-500/30"
                : "text-slate-400 hover:text-cyan-400 hover:bg-slate-900/50"
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

          <button
            onClick={() => setActiveTab("mensagens")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
              activeTab === "mensagens"
                ? "bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-400 border border-cyan-500/30"
                : "text-slate-400 hover:text-cyan-400 hover:bg-slate-900/50"
            }`}
          >
            <MessageSquare size={20} />
            {sidebarOpen && (
              <div className="flex-1 text-left">
                <div className="font-medium">Mensagens</div>
                <div className="text-xs opacity-70">{messages.length} recebidas</div>
              </div>
            )}
          </button>
        </nav>

        <div className="p-4 border-t border-cyan-500/20">
          <div className={`${sidebarOpen ? "" : "flex justify-center"}`}>
            {sidebarOpen && (
              <div className="mb-3">
                <div className="text-xs text-slate-400 mb-1">Logado como</div>
                <div className="text-sm text-slate-300 truncate">{userEmail}</div>
              </div>
            )}
            <button
              onClick={handleLogout}
              className={`${
                sidebarOpen ? "w-full" : ""
              } flex items-center gap-2 px-4 py-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 border border-slate-700 hover:border-red-500/30 transition-all`}
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
            <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400 backdrop-blur-sm">
              {errorMsg}
            </div>
          )}

          {activeTab === "empresas" && (
            <>
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-3xl font-bold text-white mb-2">Empresas Cadastradas</h2>
                  <p className="text-slate-400">Gerencie todas as empresas do sistema</p>
                </div>

                <button
                  onClick={() => setShowForm(true)}
                  className="flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-medium hover:from-cyan-600 hover:to-blue-700 transition-all shadow-lg shadow-cyan-500/20"
                >
                  <Plus size={20} />
                  Nova Empresa
                </button>
              </div>

              {showForm && (
                <div className="mb-8 rounded-2xl bg-slate-800/50 border border-cyan-500/20 p-6 backdrop-blur-sm">
                  <h3 className="text-xl font-semibold text-white mb-6">
                    Cadastrar Nova Empresa
                  </h3>

                  <form onSubmit={handleCreateCompany} className="grid gap-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-slate-300 mb-2">
                          Nome da Empresa
                        </label>
                        <input
                          required
                          className="w-full rounded-lg border border-slate-600 bg-slate-900/50 px-4 py-2.5 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Ex: Minha Empresa"
                        />
                      </div>

                      <div>
                        <label className="block text-sm text-slate-300 mb-2">
                          Número de Telefone
                        </label>
                        <input
                          required
                          type="tel"
                          className="w-full rounded-lg border border-slate-600 bg-slate-900/50 px-4 py-2.5 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                          value={phone_number}
                          onChange={handlePhoneChange}
                          placeholder="(69) 99999-9999"
                          maxLength={15}
                        />
                      </div>

                      <div>
                        <label className="block text-sm text-slate-300 mb-2">
                          Chave API
                        </label>
                        <div className="flex gap-2">
                          <input
                            required
                            className="flex-1 rounded-lg border border-slate-600 bg-slate-900/50 px-4 py-2.5 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 font-mono text-sm"
                            value={api_key}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="UUID/chave"
                          />
                          <button
                            type="button"
                            onClick={generateApiKey}
                            className="rounded-lg bg-slate-700 px-4 py-2 text-slate-300 text-sm hover:bg-slate-600 border border-slate-600 transition-colors"
                          >
                            Gerar
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm text-slate-300 mb-2">
                          Email
                        </label>
                        <input
                          required
                          type="email"
                          className="w-full rounded-lg border border-slate-600 bg-slate-900/50 px-4 py-2.5 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="empresa@dominio.com"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm text-slate-300 mb-2">
                        Senha <span className="text-slate-500 text-xs">(mínimo 6 caracteres)</span>
                      </label>
                      <input
                        required
                        type="password"
                        className="w-full rounded-lg border border-slate-600 bg-slate-900/50 px-4 py-2.5 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="********"
                        minLength={6}
                      />
                    </div>

                    <div className="flex items-center gap-3 mt-4">
                      <button
                        type="submit"
                        disabled={creating}
                        className="rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-2.5 text-white font-medium hover:from-cyan-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-cyan-500/20"
                      >
                        {creating ? "Cadastrando..." : "Cadastrar Empresa"}
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowForm(false)}
                        className="rounded-lg border border-slate-600 px-6 py-2.5 text-slate-300 hover:bg-slate-800 transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {companies.length === 0 && (
                  <div className="col-span-full text-center py-16 text-slate-400">
                    Nenhuma empresa cadastrada.
                  </div>
                )}

                {companies.map((c, index) => (
                  <div
                    key={c.id}
                    className="group rounded-xl bg-slate-800/50 border border-cyan-500/20 p-6 hover:border-cyan-500/40 hover:shadow-lg hover:shadow-cyan-500/10 transition-all backdrop-blur-sm hover:scale-105 animate-fadeIn"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="text-xl font-semibold text-white">{c.name}</div>
                      <div className="flex items-center gap-2">
                        {c.is_super_admin && (
                          <span className="text-xs px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-400 border border-amber-500/30 font-medium">
                            Admin
                          </span>
                        )}
                        {!c.is_super_admin && (
                          <button
                            onClick={() => handleDeleteCompany(c.id, c.name)}
                            className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                            title="Deletar empresa"
                          >
                            <X size={18} />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3 text-sm">
                      <div className="flex items-center gap-3 text-slate-300">
                        <span className="text-cyan-400">📞</span>
                        <span>{c.phone_number}</span>
                      </div>
                      <div className="flex items-center gap-3 text-slate-300">
                        <span className="text-cyan-400">✉️</span>
                        <span className="break-all">{c.email}</span>
                      </div>
                      <div className="flex items-start gap-3 mt-4 pt-4 border-t border-slate-700/50">
                        <span className="text-cyan-400">🔑</span>
                        <span className="break-all text-xs font-mono text-slate-400 bg-slate-900/50 px-2 py-1 rounded">
                          {c.api_key}
                        </span>
                      </div>
                      {c.user_id && (
                        <div className="flex items-start gap-3 pt-2 border-t border-slate-700/50">
                          <span className="text-cyan-400">👤</span>
                          <span className="break-all text-xs font-mono text-slate-400">
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
              <div className="w-80 bg-slate-800/50 rounded-2xl border border-cyan-500/20 backdrop-blur-sm flex flex-col overflow-hidden">
                <div className="p-4 border-b border-cyan-500/20">
                  <h3 className="text-xl font-bold text-white mb-4">Mensagens</h3>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="text"
                      placeholder="Pesquisar contato"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-slate-900/50 border border-slate-600 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all"
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                  {filteredChats.length === 0 && (
                    <div className="text-center py-12 text-slate-400">
                      Nenhuma conversa encontrada
                    </div>
                  )}

                  {filteredChats.map((chat, index) => (
                    <button
                      key={chat.numero}
                      onClick={() => setSelectedChat(chat.numero)}
                      className={`w-full p-4 flex items-center gap-3 border-b border-slate-700/50 hover:bg-slate-700/30 transition-all ${
                        selectedChat === chat.numero ? "bg-slate-700/50" : ""
                      } animate-fadeIn`}
                      style={{ animationDelay: `${index * 0.05}s` }}
                    >
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-semibold flex-shrink-0">
                        <User size={24} />
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-white truncate">{chat.pushname}</span>
                          <span className="text-xs text-slate-400 flex-shrink-0 ml-2">
                            {chat.lastMessageTime
                              ? new Date(chat.lastMessageTime).toLocaleTimeString("pt-BR", {
                                  hour: "2-digit",
                                  minute: "2-digit"
                                })
                              : ""}
                          </span>
                        </div>
                        <p className="text-sm text-slate-400 truncate">{chat.lastMessage}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 bg-slate-800/50 rounded-2xl border border-cyan-500/20 backdrop-blur-sm flex flex-col overflow-hidden">
                {!selectedChat ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                      <MessageSquare size={64} className="mx-auto mb-4 text-slate-600" />
                      <p className="text-slate-400 text-lg">Selecione uma conversa para visualizar</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="p-4 border-b border-cyan-500/20 flex items-center gap-3 bg-slate-900/50">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-semibold">
                        <User size={20} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white">
                          {filteredChats.find((c) => c.numero === selectedChat)?.pushname}
                        </h3>
                        <p className="text-xs text-slate-400">{selectedChat}</p>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gradient-to-br from-slate-900/30 to-slate-800/30">
                      {filteredChats
                        .find((c) => c.numero === selectedChat)
                        ?.messages.map((msg, index) => {
                          const isSentMessage = msg['minha?'] === 'true';
                          return (
                            <div
                              key={msg.id}
                              className={`flex animate-slideUp ${isSentMessage ? 'justify-end' : 'justify-start'}`}
                              style={{ animationDelay: `${index * 0.05}s` }}
                            >
                              <div className={`max-w-[70%] rounded-2xl px-4 py-3 shadow-lg backdrop-blur-sm ${
                                isSentMessage
                                  ? 'bg-cyan-600/80 rounded-br-sm border border-cyan-500/30'
                                  : 'bg-slate-700/50 rounded-tl-sm border border-cyan-500/20'
                              }`}>
                                {msg.urlimagem && (
                                  <div className="mb-2">
                                    <img
                                      src={msg.urlimagem}
                                      alt="Imagem"
                                      className="rounded-xl max-w-full h-auto"
                                      style={{ maxHeight: '300px' }}
                                    />
                                  </div>
                                )}
                                {(msg.message || msg.caption) && (
                                  <p className="text-white text-sm leading-relaxed break-words">
                                    {msg.caption || msg.message}
                                  </p>
                                )}
                                <div className="flex items-center gap-2 mt-2 text-xs text-slate-300">
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

                    <div className="p-4 bg-slate-900/50 border-t border-cyan-500/20">
                      {imageCaption && (
                        <div className="mb-2 px-3 py-2 bg-cyan-500/20 border border-cyan-500/30 rounded-lg">
                          <p className="text-xs text-cyan-300 mb-1">Legenda da imagem:</p>
                          <p className="text-sm text-white">{imageCaption}</p>
                          <button
                            onClick={() => setImageCaption('')}
                            className="text-xs text-red-400 hover:text-red-300 mt-1"
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
                          className="w-full px-3 py-2 text-sm bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition"
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
                          className="p-2.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-700/50 rounded-lg transition disabled:opacity-50"
                          title="Enviar imagem"
                        >
                          <ImageIcon className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadingFile || sending}
                          className="p-2.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-700/50 rounded-lg transition disabled:opacity-50"
                          title="Enviar arquivo"
                        >
                          <Paperclip className="w-5 h-5" />
                        </button>

                        <div className="flex-1 bg-slate-800/50 rounded-lg flex items-center px-4 py-2.5 border border-slate-600 focus-within:border-cyan-500 transition">
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
                            className="flex-1 bg-transparent text-white placeholder-slate-400 focus:outline-none disabled:opacity-50 text-sm"
                          />
                        </div>

                        <button
                          onClick={handleSendMessage}
                          disabled={!messageText.trim() || sending || uploadingFile}
                          className="p-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/20"
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
                          <p className="text-xs text-slate-400">Enviando arquivo...</p>
                        </div>
                      )}
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
