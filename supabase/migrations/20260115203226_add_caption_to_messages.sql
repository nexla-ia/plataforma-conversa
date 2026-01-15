/*
  # Add caption field to messages

  1. Changes
    - Add `caption` column to `messages` table
      - `caption` (text, nullable) - Caption/legend for images and videos
  
  2. Notes
    - This field will store text captions that accompany media messages
    - Nullable to maintain compatibility with existing messages
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'caption'
  ) THEN
    ALTER TABLE messages ADD COLUMN caption text;
  END IF;
END $$;