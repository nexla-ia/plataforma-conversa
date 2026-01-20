/*
  # Add support for multiple tags per contact

  1. New Tables
    - `contact_tags` - Many-to-many relationship between contacts and tags
      - `id` (uuid, primary key)
      - `contact_id` (uuid) - Foreign key to contacts
      - `tag_id` (uuid) - Foreign key to tags
      - `created_at` (timestamptz)

  2. Changes
    - Create contact_tags junction table
    - Migrate existing tag_id data from contacts to contact_tags
    - Keep tag_id column in contacts for backward compatibility with triggers

  3. Security
    - Enable RLS on contact_tags
    - Companies can manage their contact tags
    - Attendants can view contact tags from their company
    - Super admins can view all contact tags

  4. Constraints
    - Maximum 5 tags per contact
    - Unique constraint on (contact_id, tag_id)
*/

-- Create contact_tags junction table
CREATE TABLE IF NOT EXISTS contact_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(contact_id, tag_id)
);

-- Enable RLS
ALTER TABLE contact_tags ENABLE ROW LEVEL SECURITY;

-- Policy for companies to view their contact tags
CREATE POLICY "Companies can view own contact tags"
  ON contact_tags FOR SELECT
  TO authenticated
  USING (
    contact_id IN (
      SELECT id FROM contacts
      WHERE company_id IN (
        SELECT id FROM companies
        WHERE user_id = auth.uid()
      )
    )
  );

-- Policy for companies to insert their contact tags
CREATE POLICY "Companies can insert own contact tags"
  ON contact_tags FOR INSERT
  TO authenticated
  WITH CHECK (
    contact_id IN (
      SELECT id FROM contacts
      WHERE company_id IN (
        SELECT id FROM companies
        WHERE user_id = auth.uid()
      )
    )
  );

-- Policy for companies to delete their contact tags
CREATE POLICY "Companies can delete own contact tags"
  ON contact_tags FOR DELETE
  TO authenticated
  USING (
    contact_id IN (
      SELECT id FROM contacts
      WHERE company_id IN (
        SELECT id FROM companies
        WHERE user_id = auth.uid()
      )
    )
  );

-- Policy for attendants to view contact tags from their company
CREATE POLICY "Attendants can view company contact tags"
  ON contact_tags FOR SELECT
  TO authenticated
  USING (
    contact_id IN (
      SELECT id FROM contacts
      WHERE company_id IN (
        SELECT company_id FROM attendants
        WHERE user_id = auth.uid()
      )
    )
  );

-- Policy for super admins to view all contact tags
CREATE POLICY "Super admins can view all contact tags"
  ON contact_tags FOR ALL
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

-- Migrate existing tag_id data from contacts to contact_tags
INSERT INTO contact_tags (contact_id, tag_id)
SELECT id, tag_id
FROM contacts
WHERE tag_id IS NOT NULL
ON CONFLICT (contact_id, tag_id) DO NOTHING;

-- Function to enforce max 5 tags per contact
CREATE OR REPLACE FUNCTION check_max_tags_per_contact()
RETURNS TRIGGER AS $$
DECLARE
  tag_count int;
BEGIN
  SELECT COUNT(*) INTO tag_count
  FROM contact_tags
  WHERE contact_id = NEW.contact_id;

  IF tag_count >= 5 THEN
    RAISE EXCEPTION 'Cannot add more than 5 tags to a contact';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to enforce max tags
DROP TRIGGER IF EXISTS trigger_check_max_tags ON contact_tags;
CREATE TRIGGER trigger_check_max_tags
  BEFORE INSERT ON contact_tags
  FOR EACH ROW
  EXECUTE FUNCTION check_max_tags_per_contact();

-- Enable realtime for contact_tags
ALTER PUBLICATION supabase_realtime ADD TABLE contact_tags;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_contact_tags_contact_id ON contact_tags(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_tags_tag_id ON contact_tags(tag_id);
