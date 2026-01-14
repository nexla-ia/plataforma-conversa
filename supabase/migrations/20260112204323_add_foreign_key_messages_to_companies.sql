/*
  # Add Foreign Key Relationship Between Messages and Companies

  1. Changes
    - Add foreign key constraint from messages.apikey_instancia to companies.api_key
    - This ensures referential integrity between messages and their respective companies
    - Messages can only be created with a valid API key that exists in the companies table

  2. Important Notes
    - This constraint will ensure that every message is properly associated with a company
    - Deleting a company will cascade delete all its messages
    - Webhooks must provide a valid api_key that exists in the companies table
*/

-- Add foreign key constraint from messages.apikey_instancia to companies.api_key
ALTER TABLE messages 
  ADD CONSTRAINT messages_apikey_instancia_fkey 
  FOREIGN KEY (apikey_instancia) 
  REFERENCES companies(api_key) 
  ON DELETE CASCADE;