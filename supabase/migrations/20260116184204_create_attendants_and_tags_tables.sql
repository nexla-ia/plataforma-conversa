/*
  # Create Attendants and Tags Tables

  1. New Tables
    - `attendants`
      - `id` (uuid, primary key)
      - `company_id` (uuid, foreign key to companies)
      - `department_id` (uuid, foreign key to departments, nullable)
      - `sector_id` (uuid, foreign key to sectors, nullable)
      - `name` (text, not null)
      - `email` (text, unique, not null)
      - `phone` (text, optional)
      - `is_active` (boolean, default true)
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())
    
    - `tags`
      - `id` (uuid, primary key)
      - `company_id` (uuid, foreign key to companies)
      - `name` (text, not null)
      - `color` (text, default '#6B7280')
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())
    
    - `message_tags`
      - `id` (uuid, primary key)
      - `message_id` (bigint, foreign key to messages)
      - `tag_id` (uuid, foreign key to tags)
      - `created_at` (timestamptz, default now())

  2. Security
    - Enable RLS on all tables
    - Add policies for companies to manage their own attendants and tags
    - Add policies for super admins to view all data

  3. Important Notes
    - Attendants belong to companies and can be assigned to departments or sectors
    - Tags belong to companies and can be applied to multiple messages
    - Message tags create a many-to-many relationship between messages and tags
    - All tables have cascading deletes when parent records are removed
*/

-- Create attendants table
CREATE TABLE IF NOT EXISTS attendants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  sector_id uuid REFERENCES sectors(id) ON DELETE SET NULL,
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  phone text DEFAULT '',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create tags table
CREATE TABLE IF NOT EXISTS tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text DEFAULT '#6B7280',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create message_tags junction table
CREATE TABLE IF NOT EXISTS message_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id bigint NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(message_id, tag_id)
);

-- Enable RLS
ALTER TABLE attendants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_tags ENABLE ROW LEVEL SECURITY;

-- Attendants policies for companies
CREATE POLICY "Companies can view own attendants"
  ON attendants FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT id FROM companies WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Companies can insert own attendants"
  ON attendants FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT id FROM companies WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Companies can update own attendants"
  ON attendants FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT id FROM companies WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT id FROM companies WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Companies can delete own attendants"
  ON attendants FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT id FROM companies WHERE user_id = auth.uid()
    )
  );

-- Tags policies for companies
CREATE POLICY "Companies can view own tags"
  ON tags FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT id FROM companies WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Companies can insert own tags"
  ON tags FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT id FROM companies WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Companies can update own tags"
  ON tags FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT id FROM companies WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT id FROM companies WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Companies can delete own tags"
  ON tags FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT id FROM companies WHERE user_id = auth.uid()
    )
  );

-- Message tags policies for companies
CREATE POLICY "Companies can view own message tags"
  ON message_tags FOR SELECT
  TO authenticated
  USING (
    message_id IN (
      SELECT id FROM messages WHERE company_id IN (
        SELECT id FROM companies WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Companies can insert own message tags"
  ON message_tags FOR INSERT
  TO authenticated
  WITH CHECK (
    message_id IN (
      SELECT id FROM messages WHERE company_id IN (
        SELECT id FROM companies WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Companies can delete own message tags"
  ON message_tags FOR DELETE
  TO authenticated
  USING (
    message_id IN (
      SELECT id FROM messages WHERE company_id IN (
        SELECT id FROM companies WHERE user_id = auth.uid()
      )
    )
  );

-- Super admin policies for attendants
CREATE POLICY "Super admins can view all attendants"
  ON attendants FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins WHERE user_id = auth.uid()
    )
  );

-- Super admin policies for tags
CREATE POLICY "Super admins can view all tags"
  ON tags FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins WHERE user_id = auth.uid()
    )
  );

-- Super admin policies for message_tags
CREATE POLICY "Super admins can view all message tags"
  ON message_tags FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins WHERE user_id = auth.uid()
    )
  );

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_attendants_company_id ON attendants(company_id);
CREATE INDEX IF NOT EXISTS idx_attendants_department_id ON attendants(department_id);
CREATE INDEX IF NOT EXISTS idx_attendants_sector_id ON attendants(sector_id);
CREATE INDEX IF NOT EXISTS idx_attendants_email ON attendants(email);
CREATE INDEX IF NOT EXISTS idx_tags_company_id ON tags(company_id);
CREATE INDEX IF NOT EXISTS idx_message_tags_message_id ON message_tags(message_id);
CREATE INDEX IF NOT EXISTS idx_message_tags_tag_id ON message_tags(tag_id);