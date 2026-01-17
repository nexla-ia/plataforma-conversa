/*
  # Add sector filtering and tags to messages

  1. Changes
    - Add sector_id column to messages table for filtering
    - Create message_tags junction table to associate tags with conversations
    - Add RLS policies for message_tags
  
  2. Security
    - Company admins and attendants can manage tags on their messages
    - Super admins can manage all tags
*/

ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS sector_id uuid REFERENCES sectors(id);

CREATE TABLE IF NOT EXISTS message_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_numero text NOT NULL,
  tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  UNIQUE(message_numero, tag_id)
);

ALTER TABLE message_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Attendants can view tags from their company"
  ON message_tags
  FOR SELECT
  TO authenticated
  USING (
    tag_id IN (
      SELECT tags.id 
      FROM tags
      JOIN attendants ON attendants.company_id = tags.company_id
      WHERE attendants.user_id = auth.uid()
    )
  );

CREATE POLICY "Attendants can add tags to messages"
  ON message_tags
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tag_id IN (
      SELECT tags.id 
      FROM tags
      JOIN attendants ON attendants.company_id = tags.company_id
      WHERE attendants.user_id = auth.uid()
    )
  );

CREATE POLICY "Attendants can remove tags from messages"
  ON message_tags
  FOR DELETE
  TO authenticated
  USING (
    tag_id IN (
      SELECT tags.id 
      FROM tags
      JOIN attendants ON attendants.company_id = tags.company_id
      WHERE attendants.user_id = auth.uid()
    )
  );

CREATE POLICY "Company admins can view their message tags"
  ON message_tags
  FOR SELECT
  TO authenticated
  USING (
    tag_id IN (
      SELECT tags.id 
      FROM tags
      JOIN companies ON companies.id = tags.company_id
      WHERE companies.user_id = auth.uid()
    )
  );

CREATE POLICY "Company admins can manage their message tags"
  ON message_tags
  FOR ALL
  TO authenticated
  USING (
    tag_id IN (
      SELECT tags.id 
      FROM tags
      JOIN companies ON companies.id = tags.company_id
      WHERE companies.user_id = auth.uid()
    )
  )
  WITH CHECK (
    tag_id IN (
      SELECT tags.id 
      FROM tags
      JOIN companies ON companies.id = tags.company_id
      WHERE companies.user_id = auth.uid()
    )
  );

CREATE POLICY "Super admins can manage all message tags"
  ON message_tags
  FOR ALL
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT user_id 
      FROM super_admins
    )
  )
  WITH CHECK (
    auth.uid() IN (
      SELECT user_id 
      FROM super_admins
    )
  );
