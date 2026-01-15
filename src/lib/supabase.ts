import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Company {
  id: string;
  api_key: string;
  name: string;
  phone_number: string;
  email: string;
  user_id: string;
  is_super_admin: boolean;
  created_at: string;
}

export interface Message {
  id: string;
  number?: string | null;
  instancia: string | null;
  numero: string | null;
  idmessage: string | null;
  'minha?': string | null;
  pushname: string | null;
  tipomessage: string | null;
  timestamp: string | null;
  message: string | null;
  mimetype: string | null;
  base64: string | null;
  urlpdf: string | null;
  urlimagem: string | null;
  instanceId: string | null;
  WebHook: string | null;
  date_time: string | null;
  sender: string | null;
  apikey_instancia: string | null;
  created_at: string;
}
