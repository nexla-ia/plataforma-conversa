import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase, Company } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  company: Company | null;
  isSuperAdmin: boolean;
  loading: boolean;
  showWelcome: boolean;
  showGoodbye: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<{ user: User | null }>;
  signOut: () => Promise<void>;
  refreshCompany: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showGoodbye, setShowGoodbye] = useState(false);

  const fetchCompany = async (userId: string) => {
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (!error && data) {
      setCompany(data);
    }

    // Verificar se é super admin
    const { data: saData, error: saError } = await supabase
      .from('super_admins')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();

    setIsSuperAdmin(!saError && !!saData);
  };

  const refreshCompany = async () => {
    if (user) {
      await fetchCompany(user.id);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchCompany(session.user.id);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      (() => {
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchCompany(session.user.id);
        } else {
          setCompany(null);
        }
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    // Mostrar tela de boas-vindas por 5 segundos
    setShowWelcome(true);
    setTimeout(() => {
      setShowWelcome(false);
    }, 5000);
  };

  const signUp = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
      }
    });
    if (error) throw error;

    // Confirmar email automaticamente via SQL
    if (data.user) {
      await supabase.rpc('confirm_user_email', { user_id: data.user.id }).catch(() => {
        // Ignorar erro se a função não existir
      });
    }

    return data;
  };

  const signOut = async () => {
    // Mostrar tela de despedida por 5 segundos
    setShowGoodbye(true);

    setTimeout(async () => {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setCompany(null);
      setShowGoodbye(false);
    }, 5000);
  };

  return (
    <AuthContext.Provider value={{ user, company, isSuperAdmin, loading, showWelcome, showGoodbye, signIn, signUp, signOut, refreshCompany }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
