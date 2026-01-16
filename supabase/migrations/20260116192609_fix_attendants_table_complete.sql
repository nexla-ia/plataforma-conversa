/*
  # Correção Completa da Tabela de Atendentes

  1. Problemas Identificados
    - Políticas RLS podem estar causando conflitos
    - Coluna api_key precisa estar sincronizada com a empresa
    - Trigger precisa funcionar corretamente
  
  2. Alterações
    - Remove todas as políticas antigas
    - Recria políticas de forma limpa e sem conflitos
    - Garante que api_key seja sempre preenchida
    - Adiciona índices para performance
  
  3. Segurança
    - Admins de empresa só veem/gerenciam seus atendentes
    - Super admins veem/gerenciam todos
    - Atendentes só veem/editam seu próprio perfil
*/

-- 1. Remover todas as políticas antigas para recriar do zero
DROP POLICY IF EXISTS "Attendants can view their own profile" ON attendants;
DROP POLICY IF EXISTS "Attendants can update their own profile" ON attendants;
DROP POLICY IF EXISTS "Company admins can view their attendants" ON attendants;
DROP POLICY IF EXISTS "Company admins can insert their attendants" ON attendants;
DROP POLICY IF EXISTS "Company admins can update their attendants" ON attendants;
DROP POLICY IF EXISTS "Company admins can delete their attendants" ON attendants;
DROP POLICY IF EXISTS "Super admins can view all attendants" ON attendants;
DROP POLICY IF EXISTS "Super admins can insert attendants" ON attendants;
DROP POLICY IF EXISTS "Super admins can update attendants" ON attendants;
DROP POLICY IF EXISTS "Super admins can delete attendants" ON attendants;

-- 2. Garantir que a coluna api_key existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attendants' AND column_name = 'api_key'
  ) THEN
    ALTER TABLE attendants ADD COLUMN api_key text;
  END IF;
END $$;

-- 3. Recriar função para sincronizar api_key
CREATE OR REPLACE FUNCTION sync_attendant_api_key()
RETURNS TRIGGER AS $$
BEGIN
  -- Busca e define a api_key da empresa
  SELECT api_key INTO NEW.api_key
  FROM companies
  WHERE id = NEW.company_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Recriar trigger
DROP TRIGGER IF EXISTS sync_attendant_api_key_trigger ON attendants;

CREATE TRIGGER sync_attendant_api_key_trigger
  BEFORE INSERT OR UPDATE OF company_id
  ON attendants
  FOR EACH ROW
  EXECUTE FUNCTION sync_attendant_api_key();

-- 5. Atualizar registros existentes
UPDATE attendants a
SET api_key = c.api_key
FROM companies c
WHERE a.company_id = c.id
  AND (a.api_key IS NULL OR a.api_key != c.api_key);

-- 6. Criar políticas SELECT
CREATE POLICY "Attendants read own profile"
  ON attendants FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Company admins read own attendants"
  ON attendants FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT id FROM companies WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Super admins read all attendants"
  ON attendants FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins WHERE user_id = auth.uid()
    )
  );

-- 7. Criar políticas INSERT
CREATE POLICY "Company admins insert own attendants"
  ON attendants FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT id FROM companies WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Super admins insert attendants"
  ON attendants FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM super_admins WHERE user_id = auth.uid()
    )
  );

-- 8. Criar políticas UPDATE
CREATE POLICY "Attendants update own profile"
  ON attendants FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Company admins update own attendants"
  ON attendants FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT id FROM companies WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT id FROM companies WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Super admins update attendants"
  ON attendants FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM super_admins WHERE user_id = auth.uid()
    )
  );

-- 9. Criar políticas DELETE
CREATE POLICY "Company admins delete own attendants"
  ON attendants FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT id FROM companies WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Super admins delete attendants"
  ON attendants FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM super_admins WHERE user_id = auth.uid()
    )
  );

-- 10. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_attendants_user_id ON attendants(user_id);
CREATE INDEX IF NOT EXISTS idx_attendants_company_id ON attendants(company_id);
CREATE INDEX IF NOT EXISTS idx_attendants_api_key ON attendants(api_key);
CREATE INDEX IF NOT EXISTS idx_attendants_email ON attendants(email);
CREATE INDEX IF NOT EXISTS idx_attendants_department_id ON attendants(department_id);
CREATE INDEX IF NOT EXISTS idx_attendants_sector_id ON attendants(sector_id);