/*
  # Permitir atendentes lerem mensagens da empresa

  1. Alterações
    - Adiciona política para atendentes lerem mensagens da empresa a qual pertencem
    - Atendentes podem ver mensagens onde apikey_instancia = api_key da empresa deles

  2. Segurança
    - Verifica se o user_id está na tabela attendants
    - Verifica se o attendant pertence à empresa através do company_id
    - Verifica se a mensagem pertence à mesma empresa através do apikey_instancia
*/

CREATE POLICY "Attendants can read company messages"
  ON messages
  FOR SELECT
  TO authenticated
  USING (
    apikey_instancia IN (
      SELECT c.api_key
      FROM attendants a
      JOIN companies c ON c.id = a.company_id
      WHERE a.user_id = auth.uid()
    )
  );
