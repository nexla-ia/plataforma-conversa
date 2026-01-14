/*
  # Corrigir Função de Auto-Confirmação

  1. **Correção**
    - Remove atualização do campo `confirmed_at` (é gerado automaticamente)
    - Mantém apenas `email_confirmed_at` que é editável

  2. **Comportamento**
    - Usuários criados são automaticamente confirmados
    - Podem fazer login imediatamente sem verificar email
*/

-- Recriar função corrigida
CREATE OR REPLACE FUNCTION public.auto_confirm_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-confirmar email do usuário (confirmed_at é gerado automaticamente)
  UPDATE auth.users
  SET email_confirmed_at = NOW()
  WHERE id = NEW.id
  AND email_confirmed_at IS NULL;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;