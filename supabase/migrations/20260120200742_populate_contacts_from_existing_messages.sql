/*
  # Populate contacts table from existing messages

  1. Changes
    - Create function to populate contacts from existing messages
    - Execute function to create contacts for all existing conversations
    - This will analyze all messages and create contact entries

  2. Process
    - Group messages by company and phone number
    - Get the most recent message information for each contact
    - Insert or update contacts with department, sector, and tag information
*/

-- Function to populate contacts from existing messages
CREATE OR REPLACE FUNCTION populate_contacts_from_messages()
RETURNS void AS $$
BEGIN
  -- Insert contacts from messages table
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
  SELECT DISTINCT ON (c.id, m.numero)
    c.id as company_id,
    m.numero as phone_number,
    COALESCE(m.pushname, m.numero) as name,
    m.department_id,
    m.sector_id,
    m.tag_id,
    m.message as last_message,
    COALESCE(m.created_at, now()) as last_message_time,
    now() as updated_at
  FROM messages m
  INNER JOIN companies c ON c.api_key = m.apikey_instancia
  WHERE m.numero IS NOT NULL
  ORDER BY c.id, m.numero, m.created_at DESC
  ON CONFLICT (company_id, phone_number)
  DO UPDATE SET
    name = COALESCE(EXCLUDED.name, contacts.name),
    department_id = COALESCE(EXCLUDED.department_id, contacts.department_id),
    sector_id = COALESCE(EXCLUDED.sector_id, contacts.sector_id),
    tag_id = COALESCE(EXCLUDED.tag_id, contacts.tag_id),
    last_message = EXCLUDED.last_message,
    last_message_time = EXCLUDED.last_message_time,
    updated_at = now();

  -- Also process sent_messages table
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
  SELECT DISTINCT ON (c.id, sm.numero)
    c.id as company_id,
    sm.numero as phone_number,
    COALESCE(sm.pushname, sm.numero) as name,
    sm.department_id,
    sm.sector_id,
    sm.tag_id,
    sm.message as last_message,
    COALESCE(sm.created_at, now()) as last_message_time,
    now() as updated_at
  FROM sent_messages sm
  INNER JOIN companies c ON c.api_key = sm.apikey_instancia
  WHERE sm.numero IS NOT NULL
  ORDER BY c.id, sm.numero, sm.created_at DESC
  ON CONFLICT (company_id, phone_number)
  DO UPDATE SET
    name = COALESCE(EXCLUDED.name, contacts.name),
    department_id = COALESCE(EXCLUDED.department_id, contacts.department_id),
    sector_id = COALESCE(EXCLUDED.sector_id, contacts.sector_id),
    tag_id = COALESCE(EXCLUDED.tag_id, contacts.tag_id),
    last_message = CASE 
      WHEN EXCLUDED.last_message_time > contacts.last_message_time 
      THEN EXCLUDED.last_message 
      ELSE contacts.last_message 
    END,
    last_message_time = CASE 
      WHEN EXCLUDED.last_message_time > contacts.last_message_time 
      THEN EXCLUDED.last_message_time 
      ELSE contacts.last_message_time 
    END,
    updated_at = now();

  RAISE NOTICE 'Contacts populated successfully from existing messages';
END;
$$ LANGUAGE plpgsql;

-- Execute the function to populate contacts
SELECT populate_contacts_from_messages();

-- Drop the function after use (optional, comment out if you want to keep it for manual runs)
-- DROP FUNCTION IF EXISTS populate_contacts_from_messages();
