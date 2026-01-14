/*
  # Adicionar coluna ID à tabela companies
  
  1. Mudanças
    - Adicionar coluna `id` (uuid, chave primária)
    - Alterar api_key para ser apenas uma chave única
    - Atualizar foreign keys necessárias
  
  2. Segurança
    - Manter todas as políticas RLS inalteradas
*/

-- Primeiro, remover a foreign key que depende de companies.api_key
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_apikey_instancia_fkey;

-- Remover a chave primária atual
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_pkey CASCADE;

-- Adicionar a coluna id
ALTER TABLE companies ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();

-- Preencher IDs para registros existentes
UPDATE companies SET id = gen_random_uuid() WHERE id IS NULL;

-- Tornar o campo NOT NULL
ALTER TABLE companies ALTER COLUMN id SET NOT NULL;

-- Definir id como chave primária
ALTER TABLE companies ADD PRIMARY KEY (id);

-- Garantir que api_key seja única
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_api_key_unique;
ALTER TABLE companies ADD CONSTRAINT companies_api_key_unique UNIQUE (api_key);

-- Recriar a foreign key de messages para companies
ALTER TABLE messages
  ADD CONSTRAINT messages_apikey_instancia_fkey
  FOREIGN KEY (apikey_instancia)
  REFERENCES companies(api_key)
  ON DELETE CASCADE;

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_companies_id ON companies(id);
CREATE INDEX IF NOT EXISTS idx_companies_api_key ON companies(api_key);
