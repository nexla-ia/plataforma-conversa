/*
  # Create WhatsApp Messages Management System

  1. New Tables
    - `companies`
      - `id` (uuid, primary key) - Unique identifier for each company
      - `name` (text) - Company name
      - `phone_number` (text) - Company phone number
      - `api_key` (text, unique) - API key for WhatsApp integration
      - `email` (text, unique) - Company email for login
      - `user_id` (uuid, foreign key) - Reference to auth.users
      - `is_super_admin` (boolean) - Flag to identify super admin
      - `created_at` (timestamptz) - Timestamp of creation
    
    - `messages`
      - `id` (uuid, primary key) - Unique identifier for each message
      - `number` (text) - Phone number
      - `instancia` (text) - Instance information
      - `numero` (text) - Number field
      - `idmessage` (text) - Message ID
      - `minha` (text) - Mine indicator
      - `pushname` (text) - Push name
      - `tipomessage` (text) - Message type
      - `timestamp` (text) - Message timestamp
      - `message` (text) - Message content
      - `mimetype` (text) - MIME type for media
      - `base64` (text) - Base64 encoded data
      - `urlpdf` (text) - PDF URL
      - `urlimagem` (text) - Image URL
      - `instanceId` (text) - Instance ID
      - `WebHook` (text) - Webhook information
      - `date_time` (text) - Date and time
      - `sender` (text) - Message sender
      - `apikey_instancia` (text) - API key linking to company
      - `company_id` (uuid, foreign key) - Reference to companies table
      - `created_at` (timestamptz) - Timestamp of creation

  2. Security
    - Enable RLS on both tables
    - Super admin can see all companies
    - Companies can only see their own data
    - Companies can only see messages with their api_key
*/

-- Create companies table
CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone_number text NOT NULL,
  api_key text UNIQUE NOT NULL,
  email text UNIQUE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  is_super_admin boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text,
  instancia text,
  numero text,
  idmessage text,
  minha text,
  pushname text,
  tipomessage text,
  timestamp text,
  message text,
  mimetype text,
  base64 text,
  urlpdf text,
  urlimagem text,
  instanceId text,
  WebHook text,
  date_time text,
  sender text,
  apikey_instancia text,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_messages_company_id ON messages(company_id);
CREATE INDEX IF NOT EXISTS idx_messages_apikey ON messages(apikey_instancia);
CREATE INDEX IF NOT EXISTS idx_companies_user_id ON companies(user_id);
CREATE INDEX IF NOT EXISTS idx_companies_api_key ON companies(api_key);

-- Enable Row Level Security
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Companies policies
CREATE POLICY "Super admin can view all companies"
  ON companies FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM companies c
      WHERE c.user_id = auth.uid() AND c.is_super_admin = true
    )
  );

CREATE POLICY "Companies can view their own data"
  ON companies FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Super admin can insert companies"
  ON companies FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM companies c
      WHERE c.user_id = auth.uid() AND c.is_super_admin = true
    )
  );

CREATE POLICY "Super admin can update companies"
  ON companies FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM companies c
      WHERE c.user_id = auth.uid() AND c.is_super_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM companies c
      WHERE c.user_id = auth.uid() AND c.is_super_admin = true
    )
  );

-- Messages policies
CREATE POLICY "Companies can view their own messages"
  ON messages FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT id FROM companies WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Super admin can view all messages"
  ON messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM companies c
      WHERE c.user_id = auth.uid() AND c.is_super_admin = true
    )
  );

CREATE POLICY "Webhook can insert messages with valid api key"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    apikey_instancia IN (SELECT api_key FROM companies)
  );

-- Allow anon insert for webhook (if needed)
CREATE POLICY "Anonymous webhook can insert messages"
  ON messages FOR INSERT
  TO anon
  WITH CHECK (true);