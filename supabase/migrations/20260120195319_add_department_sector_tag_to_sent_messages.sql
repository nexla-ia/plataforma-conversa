/*
  # Add department, sector and tag columns to sent_messages

  1. Changes
    - Add `department_id` column to `sent_messages` table with foreign key to `departments`
    - Add `sector_id` column to `sent_messages` table with foreign key to `sectors`
    - Add `tag_id` column to `sent_messages` table with foreign key to `tags`
    - All columns are nullable as they are optional metadata for sent messages

  2. Security
    - No RLS changes needed as sent_messages already has proper RLS policies

  3. Indexes
    - Add indexes for better query performance on filtering
*/

-- Add department_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sent_messages' AND column_name = 'department_id'
  ) THEN
    ALTER TABLE sent_messages ADD COLUMN department_id uuid REFERENCES departments(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add sector_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sent_messages' AND column_name = 'sector_id'
  ) THEN
    ALTER TABLE sent_messages ADD COLUMN sector_id uuid REFERENCES sectors(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add tag_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sent_messages' AND column_name = 'tag_id'
  ) THEN
    ALTER TABLE sent_messages ADD COLUMN tag_id uuid REFERENCES tags(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_sent_messages_department_id ON sent_messages(department_id);
CREATE INDEX IF NOT EXISTS idx_sent_messages_sector_id ON sent_messages(sector_id);
CREATE INDEX IF NOT EXISTS idx_sent_messages_tag_id ON sent_messages(tag_id);
