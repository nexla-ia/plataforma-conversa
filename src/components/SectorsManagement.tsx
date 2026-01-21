import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Trash2, Edit2, X, Loader2, FolderTree } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface Department {
  id: string;
  name: string;
}

interface Sector {
  id: string;
  department_id: string;
  company_id: string;
  name: string;
  description: string;
  created_at: string;
  department?: Department;
}

export default function SectorsManagement() {
  const { company } = useAuth();
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    department_id: '',
  });

  useEffect(() => {
    fetchData();
  }, [company]);

  const fetchData = async () => {
    if (!company?.id) return;

    setLoading(true);
    try {
      const [sectorsResult, departmentsResult] = await Promise.all([
        supabase
          .from('sectors')
          .select('*, departments(id, name)')
          .eq('company_id', company.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('departments')
          .select('id, name')
          .eq('company_id', company.id)
          .order('name', { ascending: true })
      ]);

      if (sectorsResult.error) throw sectorsResult.error;
      if (departmentsResult.error) throw departmentsResult.error;

      const sectorsWithDepartments = (sectorsResult.data || []).map(sector => ({
        ...sector,
        department: Array.isArray(sector.departments) ? sector.departments[0] : sector.departments
      }));

      setSectors(sectorsWithDepartments);
      setDepartments(departmentsResult.data || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company?.id) return;

    setSaving(true);
    try {
      if (editingId) {
        const { error } = await supabase
          .from('sectors')
          .update({
            name: formData.name,
            description: formData.description,
            department_id: formData.department_id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('sectors')
          .insert([{
            company_id: company.id,
            department_id: formData.department_id,
            name: formData.name,
            description: formData.description,
          }]);

        if (error) throw error;
      }

      setFormData({ name: '', description: '', department_id: '' });
      setShowForm(false);
      setEditingId(null);
      fetchData();
    } catch (error) {
      console.error('Erro ao salvar setor:', error);
      alert('Erro ao salvar setor');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (sector: Sector) => {
    setFormData({
      name: sector.name,
      description: sector.description,
      department_id: sector.department_id,
    });
    setEditingId(sector.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Tem certeza que deseja excluir o setor "${name}"?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('sectors')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchData();
    } catch (error) {
      console.error('Erro ao excluir setor:', error);
      alert('Erro ao excluir setor');
    }
  };

  const handleCancel = () => {
    setFormData({ name: '', description: '', department_id: '' });
    setShowForm(false);
    setEditingId(null);
  };

  const groupBySector = () => {
    const grouped: { [key: string]: { department: Department; sectors: Sector[] } } = {};

    sectors.forEach((sector) => {
      const deptId = sector.department_id;
      if (!grouped[deptId]) {
        grouped[deptId] = {
          department: sector.department || { id: deptId, name: 'Departamento Desconhecido' },
          sectors: [],
        };
      }
      grouped[deptId].sectors.push(sector);
    });

    return Object.values(grouped);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Setores</h2>
          <p className="text-sm text-gray-500 mt-1">Gerencie os setores dos seus departamentos</p>
        </div>
        {!showForm && departments.length > 0 && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-br from-teal-500 to-teal-600 text-white rounded-xl hover:from-teal-600 hover:to-teal-700 hover:scale-105 transition-all shadow-md hover:shadow-lg"
          >
            <Plus className="w-5 h-5" />
            Novo Setor
          </button>
        )}
      </div>

      {departments.length === 0 && (
        <div className="bg-white/70 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-12 text-center shadow-md">
          <div className="w-20 h-20 bg-gradient-to-br from-orange-100 to-orange-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FolderTree className="w-10 h-10 text-orange-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum departamento encontrado</h3>
          <p className="text-sm text-gray-500">Você precisa criar departamentos antes de criar setores</p>
        </div>
      )}

      {departments.length > 0 && showForm && (
        <div className="bg-white/70 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-6 mb-6 shadow-md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {editingId ? 'Editar Setor' : 'Novo Setor'}
            </h3>
            <button
              onClick={handleCancel}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100/50 rounded-lg transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Departamento *
              </label>
              <select
                required
                value={formData.department_id}
                onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                className="w-full px-4 py-2.5 bg-white/60 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400 focus:bg-white transition-all"
              >
                <option value="">Selecione um departamento</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nome do Setor *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Atendimento, Suporte, Financeiro"
                className="w-full px-4 py-2.5 bg-white/60 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400 focus:bg-white transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Descrição
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descreva as responsabilidades deste setor"
                rows={3}
                className="w-full px-4 py-2.5 bg-white/60 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400 focus:bg-white transition-all resize-none"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 px-4 py-2.5 bg-gradient-to-br from-teal-500 to-teal-600 text-white rounded-xl hover:from-teal-600 hover:to-teal-700 transition-all disabled:opacity-50 shadow-md font-medium"
              >
                {saving ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Salvando...
                  </span>
                ) : (
                  editingId ? 'Atualizar' : 'Criar Setor'
                )}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all font-medium"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {departments.length > 0 && sectors.length === 0 ? (
        <div className="bg-white/70 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-12 text-center shadow-md">
          <div className="w-20 h-20 bg-gradient-to-br from-teal-100 to-teal-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FolderTree className="w-10 h-10 text-teal-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum setor cadastrado</h3>
          <p className="text-sm text-gray-500">Comece criando o primeiro setor para seus departamentos</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupBySector().map(({ department, sectors: deptSectors }) => (
            <div key={department.id} className="bg-white/50 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-6 shadow-md">
              <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-200/50">
                <div className="w-10 h-10 bg-gradient-to-br from-teal-400 to-teal-600 rounded-xl flex items-center justify-center shadow-md">
                  <FolderTree className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{department.name}</h3>
                  <p className="text-xs text-gray-500">{deptSectors.length} {deptSectors.length === 1 ? 'setor' : 'setores'}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {deptSectors.map((sector) => (
                  <div
                    key={sector.id}
                    className="bg-white/70 backdrop-blur-xl border border-gray-200/50 rounded-xl p-4 shadow-sm hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="text-base font-bold text-gray-900">{sector.name}</h4>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleEdit(sector)}
                          className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-all"
                          title="Editar"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(sector.id, sector.name)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          title="Excluir"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {sector.description && (
                      <p className="text-xs text-gray-600 line-clamp-2 mb-2">{sector.description}</p>
                    )}

                    <p className="text-xs text-gray-400 mt-2 pt-2 border-t border-gray-200/50">
                      Criado em {new Date(sector.created_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
