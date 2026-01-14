/*
  # Adicionar Função RPC para Confirmar Email

  1. **Nova Função**
    - `confirm_user_email` - Função que pode ser chamada via RPC para confirmar email de um usuário
    - Permite que o frontend confirme emails programaticamente
    
  2. **Segurança**
    - Função com SECURITY DEFINER para acessar auth.users
    - Pode ser chamada por usuários autenticados
    
  3. **Uso**
    - Chamada após criar novo usuário para confirmar email automaticamente
*/

-- Criar função RPC para confirmar email
CREATE OR REPLACE FUNCTION public.confirm_user_email(user_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE auth.users
  SET email_confirmed_at = NOW()
  WHERE id = user_id
  AND email_confirmed_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;