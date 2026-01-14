/*
  # Desabilitar Confirmação de Email

  1. **Função de Auto-Confirmação**
    - Cria trigger que automaticamente confirma emails de novos usuários
    - Remove necessidade de confirmação manual via link

  2. **Segurança**
    - Mantém segurança via senha
    - Facilita desenvolvimento e testes
    - Usuários podem fazer login imediatamente após registro

  3. **Notas**
    - Esta configuração é adequada para ambientes de desenvolvimento
    - Em produção, considere reabilitar confirmação de email
*/

-- Criar função que auto-confirma usuários
CREATE OR REPLACE FUNCTION public.auto_confirm_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-confirmar email do usuário
  UPDATE auth.users
  SET email_confirmed_at = NOW(),
      confirmed_at = NOW()
  WHERE id = NEW.id
  AND email_confirmed_at IS NULL;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger que executa após criação de usuário
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_confirm_user();