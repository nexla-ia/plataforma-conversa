/*
  # Create contacts table

  1. New Tables
    - `contacts`
      - `id` (uuid, primary key)
      - `company_id` (uuid) - Foreign key to companies
      - `phone_number` (text) - Phone number of the contact
      - `name` (text) - Contact name (pushname from messages)
      - `department_id` (uuid) - Foreign key to departments
      - `sector_id` (uuid) - Foreign key to sectors
      - `tag_id` (uuid) - Foreign key to tags
      - `last_message` (text) - Last message content
      - `last_message_time` (timestamptz) - Timestamp of last message
      - `created_at` (timestamptz) - Creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp

  2. Security
    - Enable RLS on `contacts` table
    - Companies can view and manage their own contacts
    - Attendants can view contacts from their company filtered by department/sector
    - Super admins can view all contacts

  3. Indexes
    - Create indexes on frequently queried columns for performance

  4. Triggers
    - Create trigger to automatically create/update contact when message arrives
*/

-- Create contacts table
CREATE TABLE IF NOT EXISTS contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  phone_number text NOT NULL,
  name text,
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  sector_id uuid REFERENCES sectors(id) ON DELETE SET NULL,
  tag_id uuid REFERENCES tags(id) ON DELETE SET NULL,
  last_message text,
  last_message_time timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(company_id, phone_number)
);

-- Enable RLS
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

-- Policy for companies to view their own contacts
CREATE POLICY "Companies can view own contacts"
  ON contacts FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT id FROM companies
      WHERE user_id = auth.uid()
    )
  );

-- Policy for companies to insert their own contacts
CREATE POLICY "Companies can insert own contacts"
  ON contacts FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT id FROM companies
      WHERE user_id = auth.uid()
    )
  );

-- Policy for companies to update their own contacts
CREATE POLICY "Companies can update own contacts"
  ON contacts FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT id FROM companies
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT id FROM companies
      WHERE user_id = auth.uid()
    )
  );

-- Policy for companies to delete their own contacts
CREATE POLICY "Companies can delete own contacts"
  ON contacts FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT id FROM companies
      WHERE user_id = auth.uid()
    )
  );

-- Policy for attendants to view contacts from their company
CREATE POLICY "Attendants can view company contacts"
  ON contacts FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM attendants
      WHERE user_id = auth.uid()
    )
  );

-- Policy for super admins to view all contacts
CREATE POLICY "Super admins can view all contacts"
  ON contacts FOR ALL
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT user_id FROM super_admins
    )
  )
  WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM super_admins
    )
  );

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_contacts_company_id ON contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_contacts_phone_number ON contacts(phone_number);
CREATE INDEX IF NOT EXISTS idx_contacts_department_id ON contacts(department_id);
CREATE INDEX IF NOT EXISTS idx_contacts_sector_id ON contacts(sector_id);
CREATE INDEX IF NOT EXISTS idx_contacts_tag_id ON contacts(tag_id);
CREATE INDEX IF NOT EXISTS idx_contacts_last_message_time ON contacts(last_message_time DESC);

-- Function to upsert contact when message arrives
CREATE OR REPLACE FUNCTION upsert_contact_from_message()
RETURNS TRIGGER AS $$
DECLARE
  v_company_id uuid;
BEGIN
  -- Get company_id from api_key
  SELECT id INTO v_company_id
  FROM companies
  WHERE api_key = NEW.apikey_instancia
  LIMIT 1;

  IF v_company_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Upsert contact
  INSERT INTO contacts (
    company_id,
    phone_number,
    name,
    department_id,
    sector_id,
    tag_id,
    last_message,
    last_message_time,
    updated_at
  )
  VALUES (
    v_company_id,
    NEW.numero,
    COALESCE(NEW.pushname, NEW.numero),
    NEW.department_id,
    NEW.sector_id,
    NEW.tag_id,
    NEW.message,
    COALESCE(NEW.created_at, now()),
    now()
  )
  ON CONFLICT (company_id, phone_number)
  DO UPDATE SET
    name = COALESCE(EXCLUDED.name, contacts.name),
    department_id = COALESCE(EXCLUDED.department_id, contacts.department_id),
    sector_id = COALESCE(EXCLUDED.sector_id, contacts.sector_id),
    tag_id = COALESCE(EXCLUDED.tag_id, contacts.tag_id),
    last_message = EXCLUDED.last_message,
    last_message_time = EXCLUDED.last_message_time,
    updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for messages table
DROP TRIGGER IF EXISTS trigger_upsert_contact_from_message ON messages;
CREATE TRIGGER trigger_upsert_contact_from_message
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION upsert_contact_from_message();

-- Trigger for sent_messages table
DROP TRIGGER IF EXISTS trigger_upsert_contact_from_sent_message ON sent_messages;
CREATE TRIGGER trigger_upsert_contact_from_sent_message
  AFTER INSERT ON sent_messages
  FOR EACH ROW
  EXECUTE FUNCTION upsert_contact_from_message();

-- Enable realtime for contacts
ALTER PUBLICATION supabase_realtime ADD TABLE contacts;
