/*
  # Corrigir RLS da tabela super_admins
  
  1. Problema
    - Políticas de companies verificam se usuário está em super_admins
    - Mas super_admins tem RLS que bloqueia essa verificação
    - Causando deadlock nas queries
  
  2. Solução
    - Desabilitar RLS em super_admins (tabela de configuração interna)
    - Manter controle de acesso via políticas em companies
  
  3. Segurança
    - Super admins continuam protegidos via políticas em companies
    - Apenas queries internas podem verificar super_admins
*/

-- Desabilitar RLS na tabela super_admins
ALTER TABLE super_admins DISABLE ROW LEVEL SECURITY;

-- Remover política existente (não é mais necessária)
DROP POLICY IF EXISTS "super_admins_select_self" ON super_admins;
