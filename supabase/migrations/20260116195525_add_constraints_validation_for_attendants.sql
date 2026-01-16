/*
  # Adicionar Validações de Integridade para Attendants

  1. Problema
    - Verificar se há problemas de foreign key entre tabelas
    - Garantir que department e sector pertencem à mesma empresa
  
  2. Solução
    - Adicionar constraint para validar que department_id pertence à company_id
    - Adicionar constraint para validar que sector_id pertence ao department_id
    - Melhorar mensagens de erro
*/

-- 1. Adicionar função de validação para garantir que department pertence à company
CREATE OR REPLACE FUNCTION validate_attendant_department()
RETURNS TRIGGER AS $$
BEGIN
  -- Se department_id não é null, validar se pertence à company
  IF NEW.department_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM departments
      WHERE id = NEW.department_id
      AND company_id = NEW.company_id
    ) THEN
      RAISE EXCEPTION 'O departamento selecionado não pertence a esta empresa';
    END IF;
  END IF;
  
  -- Se sector_id não é null, validar se pertence ao department
  IF NEW.sector_id IS NOT NULL THEN
    IF NEW.department_id IS NULL THEN
      RAISE EXCEPTION 'Não é possível atribuir um setor sem um departamento';
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM sectors
      WHERE id = NEW.sector_id
      AND department_id = NEW.department_id
    ) THEN
      RAISE EXCEPTION 'O setor selecionado não pertence ao departamento escolhido';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Criar trigger para validação
DROP TRIGGER IF EXISTS validate_attendant_department_trigger ON attendants;

CREATE TRIGGER validate_attendant_department_trigger
  BEFORE INSERT OR UPDATE
  ON attendants
  FOR EACH ROW
  EXECUTE FUNCTION validate_attendant_department();