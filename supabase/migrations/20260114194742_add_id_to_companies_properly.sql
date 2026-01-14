/*
  # Adicionar campo ID à tabela companies
  
  1. Mudanças
    - Adicionar coluna `id` (uuid) com valores únicos
    - Atualizar chave primária de `api_key` para `id`
    - Manter `api_key` como chave única
    - Recriar foreign keys necessárias
  
  2. Segurança
    - Manter todas as políticas RLS inalteradas
    - Garantir integridade referencial
*/

-- Remover a foreign key constraint de messages que depende de companies.api_key
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_apikey_instancia_fkey;

-- Remover a chave primária atual de api_key
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_pkey CASCADE;

-- Adicionar coluna id se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'id'
  ) THEN
    ALTER TABLE companies ADD COLUMN id uuid DEFAULT gen_random_uuid();
  END IF;
END $$;

-- Garantir que todos os registros existentes tenham um ID
UPDATE companies SET id = gen_random_uuid() WHERE id IS NULL;

-- Tornar id NOT NULL e definir como chave primária
ALTER TABLE companies ALTER COLUMN id SET NOT NULL;
ALTER TABLE companies ADD PRIMARY KEY (id);

-- Garantir que api_key continue sendo único
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_api_key_unique;
ALTER TABLE companies ADD CONSTRAINT companies_api_key_unique UNIQUE (api_key);

-- Recriar a foreign key de messages para companies usando api_key (não é chave primária mas é única)
ALTER TABLE messages
  ADD CONSTRAINT messages_apikey_instancia_fkey
  FOREIGN KEY (apikey_instancia)
  REFERENCES companies(api_key)
  ON DELETE CASCADE;

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_companies_api_key ON companies(api_key);
CREATE INDEX IF NOT EXISTS idx_companies_id ON companies(id);
