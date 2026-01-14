/*
  # Configurar RLS, Políticas e Realtime

  1. **Segurança (RLS)**
    - Habilita Row Level Security em `companies` e `messages`
    - Garante que dados sejam protegidos por padrão

  2. **Políticas de Acesso**
    
    **Companies:**
    - SELECT: Usuário logado pode ver apenas sua própria empresa
    
    **Messages:**
    - SELECT: Empresa pode ver apenas mensagens com seu api_key
    - INSERT: Permite inserir mensagens vinculadas a companies válidas
    - UPDATE: Empresa pode atualizar suas próprias mensagens
    - DELETE: Empresa pode deletar suas próprias mensagens

  3. **Realtime**
    - Habilita replicação em tempo real para tabela `messages`
    - Permite dashboard atualizar automaticamente quando novas mensagens chegarem

  4. **Notas Importantes**
    - O relacionamento usa `apikey_instancia` (messages) = `api_key` (companies)
    - Políticas garantem isolamento entre empresas (SaaS multi-tenant)
    - Service role (n8n/webhooks) pode inserir sem restrições
*/

-- Habilitar RLS nas tabelas
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- ============================================
-- POLÍTICAS PARA COMPANIES
-- ============================================

-- Usuário pode ver apenas sua própria empresa
CREATE POLICY "Company can read own data"
ON public.companies
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Usuário pode atualizar apenas sua própria empresa
CREATE POLICY "Company can update own data"
ON public.companies
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- ============================================
-- POLÍTICAS PARA MESSAGES
-- ============================================

-- Empresa pode ver apenas suas mensagens (via api_key)
CREATE POLICY "Company can read own messages"
ON public.messages
FOR SELECT
TO authenticated
USING (
  apikey_instancia IN (
    SELECT api_key
    FROM public.companies
    WHERE user_id = auth.uid()
  )
);

-- Permitir inserção de mensagens vinculadas a companies válidas
-- (usado por webhooks/n8n via service_role)
CREATE POLICY "Allow insert messages for valid companies"
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (
  apikey_instancia IN (
    SELECT api_key
    FROM public.companies
  )
);

-- Permitir inserção via service_role (webhooks externos)
CREATE POLICY "Service role can insert messages"
ON public.messages
FOR INSERT
TO service_role
WITH CHECK (true);

-- Empresa pode atualizar suas próprias mensagens
CREATE POLICY "Company can update own messages"
ON public.messages
FOR UPDATE
TO authenticated
USING (
  apikey_instancia IN (
    SELECT api_key
    FROM public.companies
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  apikey_instancia IN (
    SELECT api_key
    FROM public.companies
    WHERE user_id = auth.uid()
  )
);

-- Empresa pode deletar suas próprias mensagens
CREATE POLICY "Company can delete own messages"
ON public.messages
FOR DELETE
TO authenticated
USING (
  apikey_instancia IN (
    SELECT api_key
    FROM public.companies
    WHERE user_id = auth.uid()
  )
);

-- ============================================
-- HABILITAR REALTIME
-- ============================================

-- Habilita replicação em tempo real para messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;