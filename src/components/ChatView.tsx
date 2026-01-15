import { useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabase";
import { MessageCircle, Send } from "lucide-react";

type Message = {
  id: string;
  numero: string;
  message: string;
  pushname: string;
  "minha?": string;
  created_at: string;
  timestamp: string;
};

type Conversation = {
  numero: string;
  pushname: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
};

export default function ChatView() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedNumber, setSelectedNumber] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiKey, setApiKey] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadUserAndConversations();
  }, []);

  useEffect(() => {
    if (selectedNumber && apiKey) {
      loadMessages(selectedNumber);
      const unsubscribe = subscribeToMessages(selectedNumber);
      return () => {
        if (unsubscribe) unsubscribe();
      };
    }
  }, [selectedNumber, apiKey]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadUserAndConversations = async () => {
    setLoading(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      setLoading(false);
      return;
    }

    const { data: company } = await supabase
      .from("companies")
      .select("api_key")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (company?.api_key) {
      setApiKey(company.api_key);
      await loadConversations(company.api_key);
    }

    setLoading(false);
  };

  const loadConversations = async (key: string) => {
    const { data } = await supabase
      .from("messages")
      .select("numero, pushname, message, created_at")
      .eq("apikey_instancia", key)
      .order("created_at", { ascending: false });

    if (!data) return;

    const conversationMap = new Map<string, Conversation>();

    data.forEach((msg) => {
      if (!conversationMap.has(msg.numero)) {
        conversationMap.set(msg.numero, {
          numero: msg.numero,
          pushname: msg.pushname || msg.numero,
          lastMessage: msg.message || "",
          lastMessageTime: msg.created_at,
          unreadCount: 0,
        });
      }
    });

    setConversations(Array.from(conversationMap.values()));
  };

  const loadMessages = async (numero: string) => {
    if (!apiKey) return;

    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("apikey_instancia", apiKey)
      .eq("numero", numero)
      .order("created_at", { ascending: true });

    if (data) {
      setMessages(data as Message[]);
    }
  };

  const subscribeToMessages = (numero: string) => {
    const channel = supabase
      .channel("messages-changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `numero=eq.${numero}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const formatPhoneNumber = (numero: string) => {
    const cleaned = numero.replace(/[@s.whatsapp.net]/g, "");
    if (cleaned.length === 13 && cleaned.startsWith("55")) {
      const ddd = cleaned.substring(2, 4);
      const firstPart = cleaned.substring(4, 9);
      const secondPart = cleaned.substring(9);
      return `(${ddd}) ${firstPart}-${secondPart}`;
    }
    return cleaned;
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Hoje";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Ontem";
    }
    return date.toLocaleDateString("pt-BR");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-600">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50">
      <div className="w-96 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-4 border-b border-slate-200 bg-emerald-600">
          <h2 className="text-lg font-semibold text-white">Conversas</h2>
        </div>

        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="p-4 text-center text-slate-500">
              <MessageCircle className="w-12 h-12 mx-auto mb-2 text-slate-300" />
              <p>Nenhuma conversa ainda</p>
            </div>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.numero}
                onClick={() => setSelectedNumber(conv.numero)}
                className={`w-full p-4 border-b border-slate-100 hover:bg-slate-50 transition-colors text-left ${
                  selectedNumber === conv.numero ? "bg-emerald-50" : ""
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-emerald-700 font-semibold text-lg">
                      {conv.pushname.charAt(0).toUpperCase()}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-1">
                      <h3 className="font-semibold text-slate-900 truncate">
                        {conv.pushname}
                      </h3>
                      <span className="text-xs text-slate-500 ml-2">
                        {formatTime(conv.lastMessageTime)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mb-1">
                      {formatPhoneNumber(conv.numero)}
                    </p>
                    <p className="text-sm text-slate-600 truncate">
                      {conv.lastMessage}
                    </p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        {selectedNumber ? (
          <>
            <div className="p-4 border-b border-slate-200 bg-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                  <span className="text-emerald-700 font-semibold">
                    {conversations
                      .find((c) => c.numero === selectedNumber)
                      ?.pushname.charAt(0)
                      .toUpperCase()}
                  </span>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">
                    {
                      conversations.find((c) => c.numero === selectedNumber)
                        ?.pushname
                    }
                  </h3>
                  <p className="text-sm text-slate-500">
                    {formatPhoneNumber(selectedNumber)}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
              {messages.map((msg, index) => {
                const showDate =
                  index === 0 ||
                  formatDate(messages[index - 1].created_at) !==
                    formatDate(msg.created_at);

                const isMyMessage = msg["minha?"] === "true";

                return (
                  <div key={msg.id}>
                    {showDate && (
                      <div className="flex justify-center my-4">
                        <span className="bg-white px-3 py-1 rounded-full text-xs text-slate-600 shadow-sm">
                          {formatDate(msg.created_at)}
                        </span>
                      </div>
                    )}

                    <div
                      className={`flex mb-3 ${
                        isMyMessage ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-md px-4 py-2 rounded-2xl ${
                          isMyMessage
                            ? "bg-emerald-600 text-white rounded-br-sm"
                            : "bg-white text-slate-900 rounded-bl-sm shadow-sm"
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap break-words">
                          {msg.message}
                        </p>
                        <span
                          className={`text-xs mt-1 block ${
                            isMyMessage ? "text-emerald-100" : "text-slate-500"
                          }`}
                        >
                          {formatTime(msg.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-slate-200 bg-white">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Digite uma mensagem..."
                  className="flex-1 rounded-full border border-slate-200 px-4 py-2 focus:outline-none focus:border-emerald-500"
                  disabled
                />
                <button
                  disabled
                  className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center hover:bg-emerald-700 disabled:opacity-50"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-slate-500">
              <MessageCircle className="w-20 h-20 mx-auto mb-4 text-slate-300" />
              <p className="text-lg font-medium">Selecione uma conversa</p>
              <p className="text-sm">
                Escolha uma conversa da lista para ver as mensagens
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
