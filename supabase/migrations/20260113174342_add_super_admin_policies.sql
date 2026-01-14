/*
  # Adicionar Políticas RLS para Super Admins
  
  1. **Problema Identificado**
    - Super admins não conseguem visualizar todas as empresas
    - Políticas RLS existentes só permitem acesso à própria empresa
  
  2. **Nova Política**
    - SELECT: Super admins podem ver todas as empresas
  
  3. **Segurança**
    - Verifica se usuário está na tabela super_admins
    - Mantém isolamento para empresas normais
*/

-- Criar tabela super_admins se não existir
CREATE TABLE IF NOT EXISTS super_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- Permitir super admins verem todas as empresas
CREATE POLICY "Super admin can read all companies"
ON public.companies
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.super_admins AS sa
    WHERE sa.user_id = auth.uid()
  )
);

-- Permitir super admins inserirem empresas
CREATE POLICY "Super admin can insert companies"
ON public.companies
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.super_admins AS sa
    WHERE sa.user_id = auth.uid()
  )
);

-- Permitir super admins atualizarem empresas
CREATE POLICY "Super admin can update companies"
ON public.companies
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.super_admins AS sa
    WHERE sa.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.super_admins AS sa
    WHERE sa.user_id = auth.uid()
  )
);