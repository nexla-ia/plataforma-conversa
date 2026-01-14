-- ============================================
-- SQL para Desabilitar Confirmação de Email
-- Execute este script no SQL Editor do Supabase
-- ============================================

-- 1. Confirmar todos os usuários existentes que ainda não foram confirmados
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email_confirmed_at IS NULL;

-- 2. Criar função que auto-confirma novos usuários (trigger)
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

-- 3. Criar trigger que executa após criação de usuário
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_confirm_user();

-- 4. Criar função RPC para confirmar email manualmente
CREATE OR REPLACE FUNCTION public.confirm_user_email(user_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE auth.users
  SET email_confirmed_at = NOW()
  WHERE id = user_id
  AND email_confirmed_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Verificar se foi aplicado corretamente
SELECT
  'Função auto_confirm criada' as status,
  routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name = 'auto_confirm_user'
UNION ALL
SELECT
  'Função confirm_user_email criada' as status,
  routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name = 'confirm_user_email'
UNION ALL
SELECT
  'Trigger criado' as status,
  trigger_name
FROM information_schema.triggers
WHERE trigger_schema = 'auth'
AND trigger_name = 'on_auth_user_created';
