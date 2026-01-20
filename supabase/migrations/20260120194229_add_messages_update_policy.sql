/*
  # Add UPDATE policy for messages table

  1. Changes
    - Add UPDATE policy to allow companies to update their own messages
    - Companies can update messages that belong to their API key
    - This enables updating department_id, sector_id, and tag_id fields

  2. Security
    - Only authenticated users can update messages
    - Users can only update messages associated with their company's API key
*/

-- Add UPDATE policy for companies to update their own messages
CREATE POLICY "Companies can update own messages"
  ON messages FOR UPDATE
  TO authenticated
  USING (
    apikey_instancia IN (
      SELECT api_key
      FROM companies
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    apikey_instancia IN (
      SELECT api_key
      FROM companies
      WHERE user_id = auth.uid()
    )
  );
