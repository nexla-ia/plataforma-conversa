/*
  # Recriar Tabela de Atendentes Baseado na Estrutura de Companies

  1. Estrutura
    - Seguir o mesmo padrão da tabela companies
    - Manter integridade referencial com companies
    - api_key sincronizado automaticamente com a empresa
  
  2. Colunas
    - `id` (uuid, primary key) - Identificador único
    - `company_id` (uuid, foreign key) - Referência à empresa
    - `department_id` (uuid, foreign key, nullable) - Departamento
    - `sector_id` (uuid, foreign key, nullable) - Setor
    - `name` (text) - Nome do atendente
    - `email` (text, unique) - Email do atendente
    - `phone` (text) - Telefone
    - `user_id` (uuid, foreign key) - Referência ao auth.users
    - `api_key` (text) - Chave API copiada da empresa
    - `is_active` (boolean) - Status ativo/inativo
    - `created_at` (timestamptz) - Data de criação
    - `updated_at` (timestamptz) - Data de atualização
  
  3. Segurança (RLS)
    - Super admins: podem gerenciar todos os atendentes
    - Company admins: gerenciam apenas seus atendentes
    - Atendentes: visualizam/atualizam apenas seu próprio perfil
*/

-- 1. Dropar tabela antiga e recriar do zero
DROP TABLE IF EXISTS attendants CASCADE;

-- 2. Criar tabela attendants com estrutura similar à companies
CREATE TABLE attendants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  sector_id uuid REFERENCES sectors(id) ON DELETE SET NULL,
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  phone text DEFAULT '',
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  api_key text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. Criar índices para performance
CREATE INDEX idx_attendants_company_id ON attendants(company_id);
CREATE INDEX idx_attendants_user_id ON attendants(user_id);
CREATE INDEX idx_attendants_api_key ON attendants(api_key);
CREATE INDEX idx_attendants_email ON attendants(email);
CREATE INDEX idx_attendants_department_id ON attendants(department_id);
CREATE INDEX idx_attendants_sector_id ON attendants(sector_id);

-- 4. Criar função para sincronizar api_key da empresa
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

-- 5. Criar trigger para auto-sync da api_key
CREATE TRIGGER sync_attendant_api_key_trigger
  BEFORE INSERT OR UPDATE OF company_id
  ON attendants
  FOR EACH ROW
  EXECUTE FUNCTION sync_attendant_api_key();

-- 6. Criar trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_attendants_updated_at
  BEFORE UPDATE ON attendants
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 7. Habilitar Row Level Security
ALTER TABLE attendants ENABLE ROW LEVEL SECURITY;

-- 8. Políticas SELECT (leitura)
CREATE POLICY "Super admins read all attendants"
  ON attendants FOR SELECT
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT user_id FROM super_admins
    )
  );

CREATE POLICY "Company admins read own attendants"
  ON attendants FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT id FROM companies WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Attendants read own profile"
  ON attendants FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- 9. Políticas INSERT (criação)
CREATE POLICY "Super admins insert attendants"
  ON attendants FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM super_admins
    )
  );

CREATE POLICY "Company admins insert own attendants"
  ON attendants FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT id FROM companies WHERE user_id = auth.uid()
    )
  );

-- 10. Políticas UPDATE (atualização)
CREATE POLICY "Super admins update attendants"
  ON attendants FOR UPDATE
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT user_id FROM super_admins
    )
  )
  WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM super_admins
    )
  );

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

CREATE POLICY "Attendants update own profile"
  ON attendants FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 11. Políticas DELETE (exclusão)
CREATE POLICY "Super admins delete attendants"
  ON attendants FOR DELETE
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT user_id FROM super_admins
    )
  );

CREATE POLICY "Company admins delete own attendants"
  ON attendants FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT id FROM companies WHERE user_id = auth.uid()
    )
  );