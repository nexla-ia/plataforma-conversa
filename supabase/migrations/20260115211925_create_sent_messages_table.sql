/*
  # Create sent_messages table

  1. New Tables
    - `sent_messages`
      - Same structure as `messages` table but dedicated for sent messages only
      - `id` (bigint, primary key, auto-increment)
      - `instancia` (text) - Instance name
      - `numero` (text) - Phone number
      - `topic` (text) - Message topic
      - `idmessage` (text) - Message ID
      - `extension` (text) - File extension
      - `minha?` (text) - Flag indicating if message is mine
      - `payload` (jsonb) - Message payload
      - `pushname` (text) - Push name
      - `event` (text) - Event type
      - `private` (boolean) - Private flag
      - `tipomessage` (text) - Message type
      - `timestamp` (text) - Message timestamp
      - `updated_at` (timestamp without time zone) - Last update time
      - `inserted_at` (timestamp without time zone) - Insert time
      - `message` (text) - Message content
      - `mimetype` (text) - MIME type for media
      - `base64` (text) - Base64 encoded data
      - `urlpdf` (text) - PDF URL
      - `urlimagem` (text) - Image URL
      - `instanceid` (text) - Instance ID
      - `webhook` (text) - Webhook URL
      - `date_time` (text) - Date time string
      - `sender` (text) - Sender identifier
      - `apikey_instancia` (text) - API key for instance
      - `company_id` (uuid) - Foreign key to companies table
      - `created_at` (timestamp with time zone) - Creation timestamp
      - `caption` (text) - Media caption

  2. Security
    - Enable RLS on `sent_messages` table
    - Add policies for super admins to manage all sent messages
    - Add policies for companies to manage their own sent messages

  3. Indexes
    - Create indexes on frequently queried columns for performance
*/

-- Create sent_messages table with the same structure as messages
CREATE TABLE IF NOT EXISTS sent_messages (
  id bigserial PRIMARY KEY,
  instancia text,
  numero text,
  topic text,
  idmessage text,
  extension text,
  "minha?" text,
  payload jsonb,
  pushname text,
  event text,
  private boolean DEFAULT false,
  tipomessage text,
  timestamp text,
  updated_at timestamp without time zone,
  inserted_at timestamp without time zone,
  message text,
  mimetype text,
  base64 text,
  urlpdf text,
  urlimagem text,
  instanceid text,
  webhook text,
  date_time text,
  sender text,
  apikey_instancia text,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  caption text
);

-- Enable RLS
ALTER TABLE sent_messages ENABLE ROW LEVEL SECURITY;

-- Policy for super admins to view all sent messages
CREATE POLICY "Super admins can view all sent messages"
  ON sent_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM companies
      WHERE companies.user_id = auth.uid()
      AND companies.is_super_admin = true
    )
  );

-- Policy for super admins to insert sent messages
CREATE POLICY "Super admins can insert sent messages"
  ON sent_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM companies
      WHERE companies.user_id = auth.uid()
      AND companies.is_super_admin = true
    )
  );

-- Policy for super admins to update sent messages
CREATE POLICY "Super admins can update sent messages"
  ON sent_messages
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM companies
      WHERE companies.user_id = auth.uid()
      AND companies.is_super_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM companies
      WHERE companies.user_id = auth.uid()
      AND companies.is_super_admin = true
    )
  );

-- Policy for super admins to delete sent messages
CREATE POLICY "Super admins can delete sent messages"
  ON sent_messages
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM companies
      WHERE companies.user_id = auth.uid()
      AND companies.is_super_admin = true
    )
  );

-- Policy for companies to view their own sent messages
CREATE POLICY "Companies can view their own sent messages"
  ON sent_messages
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT id FROM companies
      WHERE companies.user_id = auth.uid()
    )
  );

-- Policy for companies to insert their own sent messages
CREATE POLICY "Companies can insert their own sent messages"
  ON sent_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT id FROM companies
      WHERE companies.user_id = auth.uid()
    )
  );

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_sent_messages_company_id ON sent_messages(company_id);
CREATE INDEX IF NOT EXISTS idx_sent_messages_numero ON sent_messages(numero);
CREATE INDEX IF NOT EXISTS idx_sent_messages_apikey ON sent_messages(apikey_instancia);
CREATE INDEX IF NOT EXISTS idx_sent_messages_created_at ON sent_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sent_messages_numero_apikey ON sent_messages(numero, apikey_instancia);

-- Enable realtime for sent_messages
ALTER PUBLICATION supabase_realtime ADD TABLE sent_messages;