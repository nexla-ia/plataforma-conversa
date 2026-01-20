/*
  # Add UPDATE policy for sent_messages table for companies

  1. Changes
    - Add UPDATE policy to allow companies to update their own sent messages
    - Companies can update sent messages that belong to their API key
    - This enables updating department_id, sector_id, and tag_id fields

  2. Security
    - Only authenticated users can update sent messages
    - Users can only update sent messages associated with their company's API key
*/

-- Add UPDATE policy for companies to update their own sent messages
CREATE POLICY "Companies can update their own sent messages"
  ON sent_messages FOR UPDATE
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
