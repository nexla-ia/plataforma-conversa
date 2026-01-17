/*
  # Add department_id and tag_id to messages table

  1. Changes
    - Add `department_id` column to `messages` table with foreign key to `departments`
    - Add `tag_id` column to `messages` table with foreign key to `tags`
    - Both columns are nullable as they are optional metadata for messages

  2. Security
    - No RLS changes needed as messages already has proper RLS policies
*/

-- Add department_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'department_id'
  ) THEN
    ALTER TABLE messages ADD COLUMN department_id uuid REFERENCES departments(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add tag_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'tag_id'
  ) THEN
    ALTER TABLE messages ADD COLUMN tag_id uuid REFERENCES tags(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_messages_department_id ON messages(department_id);
CREATE INDEX IF NOT EXISTS idx_messages_tag_id ON messages(tag_id);
