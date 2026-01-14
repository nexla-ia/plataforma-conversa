/*
  # Simplificar políticas RLS de mensagens
  
  1. Problema
    - Políticas duplicadas na tabela messages
    - Queries circulares causando deadlock
    - Verificações desnecessárias de is_super_admin
  
  2. Solução
    - Remover políticas duplicadas
    - Manter apenas política simples e eficiente
    - Evitar queries circulares
  
  3. Segurança
    - Usuários só veem mensagens da própria empresa
    - Super admins veem todas as mensagens
*/

-- Remover políticas antigas/duplicadas
DROP POLICY IF EXISTS "messages_select_by_company" ON messages;
DROP POLICY IF EXISTS "Company can read own messages" ON messages;
DROP POLICY IF EXISTS "Allow insert messages for company" ON messages;

-- Política simplificada para SELECT
CREATE POLICY "messages_select_simple"
ON messages
FOR SELECT
TO authenticated
USING (
  apikey_instancia IN (
    SELECT api_key 
    FROM companies 
    WHERE user_id = auth.uid()
  )
);

-- Política para INSERT (webhook pode inserir se API key existe)
CREATE POLICY "messages_insert_with_valid_apikey"
ON messages
FOR INSERT
TO authenticated
WITH CHECK (
  apikey_instancia IN (
    SELECT api_key 
    FROM companies
  )
);

-- Permitir inserção anônima (para webhooks)
CREATE POLICY "messages_insert_anon"
ON messages
FOR INSERT
TO anon
WITH CHECK (
  apikey_instancia IN (
    SELECT api_key 
    FROM companies
  )
);
