import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Trash2, Edit2, X, Loader2, UserCircle2, CheckCircle, XCircle, Users } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface Department {
  id: string;
  name: string;
}

interface Sector {
  id: string;
  name: string;
  department_id: string;
}

interface Attendant {
  id: string;
  company_id: string;
  department_id: string | null;
  sector_id: string | null;
  name: string;
  email: string;
  phone: string;
  function: string;
  is_active: boolean;
  created_at: string;
  department?: Department;
  sector?: Sector;
}

export default function AttendantsManagement() {
  const { company } = useAuth();
  const [attendants, setAttendants] = useState<Attendant[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [filteredSectors, setFilteredSectors] = useState<Sector[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [maxAttendants, setMaxAttendants] = useState<number>(5);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    function: '',
    password: '',
    department_id: '',
    sector_id: '',
    is_active: true,
  });

  useEffect(() => {
    fetchData();
  }, [company]);

  useEffect(() => {
    if (formData.department_id) {
      const filtered = sectors.filter(s => s.department_id === formData.department_id);
      setFilteredSectors(filtered);
      if (!filtered.find(s => s.id === formData.sector_id)) {
        setFormData(prev => ({ ...prev, sector_id: '' }));
      }
    } else {
      setFilteredSectors([]);
      setFormData(prev => ({ ...prev, sector_id: '' }));
    }
  }, [formData.department_id, sectors]);

  const fetchData = async () => {
    if (!company?.id) return;

    setLoading(true);
    try {
      const [attendantsResult, departmentsResult, sectorsResult, companyResult] = await Promise.all([
        supabase
          .from('attendants')
          .select('*, departments(id, name), sectors(id, name, department_id)')
          .eq('company_id', company.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('departments')
          .select('id, name')
          .eq('company_id', company.id)
          .order('name', { ascending: true }),
        supabase
          .from('sectors')
          .select('id, name, department_id')
          .eq('company_id', company.id)
          .order('name', { ascending: true }),
        supabase
          .from('companies')
          .select('max_attendants')
          .eq('id', company.id)
          .maybeSingle()
      ]);

      if (attendantsResult.error) throw attendantsResult.error;
      if (departmentsResult.error) throw departmentsResult.error;
      if (sectorsResult.error) throw sectorsResult.error;

      const attendantsWithRelations = (attendantsResult.data || []).map(attendant => ({
        ...attendant,
        department: Array.isArray(attendant.departments) ? attendant.departments[0] : attendant.departments,
        sector: Array.isArray(attendant.sectors) ? attendant.sectors[0] : attendant.sectors
      }));

      setAttendants(attendantsWithRelations);
      setDepartments(departmentsResult.data || []);
      setSectors(sectorsResult.data || []);
      setMaxAttendants(companyResult.data?.max_attendants || 5);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company?.id) return;

    if (!editingId && attendants.length >= maxAttendants) {
      alert(`Limite de ${maxAttendants} atendentes atingido. Exclua um atendente existente para adicionar um novo.`);
      return;
    }

    if (!editingId && !formData.password) {
      alert('Senha é obrigatória para criar novo atendente');
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        const dataToSave = {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          function: formData.function,
          department_id: formData.department_id || null,
          sector_id: formData.sector_id || null,
          is_active: formData.is_active,
          updated_at: new Date().toISOString(),
        };

        const { error } = await supabase
          .from('attendants')
          .update(dataToSave)
          .eq('id', editingId);

        if (error) throw error;
      } else {
        const { data, error } = await supabase.functions.invoke('create-attendant', {
          body: {
            name: formData.name,
            email: formData.email,
            password: formData.password,
            phone: formData.phone,
            function: formData.function,
            api_key: company.api_key,
            department_id: formData.department_id || null,
            sector_id: formData.sector_id || null,
            is_active: formData.is_active,
          },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);
      }

      setFormData({ name: '', email: '', phone: '', function: '', password: '', department_id: '', sector_id: '', is_active: true });
      setShowForm(false);
      setEditingId(null);
      fetchData();
    } catch (error: any) {
      console.error('Erro ao salvar atendente:', error);
      alert(`Erro: ${error.message || 'Erro ao salvar atendente'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (attendant: Attendant) => {
    setFormData({
      name: attendant.name,
      email: attendant.email,
      phone: attendant.phone,
      function: attendant.function || '',
      password: '',
      department_id: attendant.department_id || '',
      sector_id: attendant.sector_id || '',
      is_active: attendant.is_active,
    });
    setEditingId(attendant.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Tem certeza que deseja excluir o atendente "${name}"?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('attendants')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchData();
    } catch (error) {
      console.error('Erro ao excluir atendente:', error);
      alert('Erro ao excluir atendente');
    }
  };

  const handleCancel = () => {
    setFormData({ name: '', email: '', phone: '', password: '', department_id: '', sector_id: '', is_active: true });
    setShowForm(false);
    setEditingId(null);
  };

  const formatPhoneNumber = (value: string) => {
    const numbers = value.replace(/\D/g, '');

    if (numbers.length <= 10) {
      return numbers.replace(/(\d{2})(\d{4})(\d{0,4})/, (_, ddd, p1, p2) => {
        if (p2) return `(${ddd}) ${p1}-${p2}`;
        if (p1) return `(${ddd}) ${p1}`;
        return `(${ddd}`;
      });
    } else {
      return numbers.replace(/(\d{2})(\d{5})(\d{0,4})/, (_, ddd, p1, p2) => {
        if (p2) return `(${ddd}) ${p1}-${p2}`;
        if (p1) return `(${ddd}) ${p1}`;
        return `(${ddd}`;
      });
    }
  };

  const handlePhoneChange = (value: string) => {
    const formatted = formatPhoneNumber(value);
    setFormData({ ...formData, phone: formatted });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
      </div>
    );
  }

  const canAddMore = attendants.length < maxAttendants;
  const limitReached = attendants.length >= maxAttendants;

  return (
    <div className="p-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between mb-6">
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-gray-900">Atendentes</h2>
          <p className="text-sm text-gray-500 mt-1">Gerencie os atendentes da sua empresa</p>

          <div className="flex items-center gap-3 mt-3">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
              limitReached
                ? 'bg-red-50 border border-red-200'
                : 'bg-blue-50 border border-blue-200'
            }`}>
              <Users className={`w-4 h-4 ${limitReached ? 'text-red-600' : 'text-blue-600'}`} />
              <span className={`text-sm font-medium ${limitReached ? 'text-red-700' : 'text-blue-700'}`}>
                {attendants.length} / {maxAttendants} atendentes
              </span>
            </div>

            {limitReached && (
              <span className="text-xs text-red-600 font-medium animate-pulse">
                Limite atingido
              </span>
            )}
          </div>
        </div>

        {!showForm && canAddMore && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-br from-teal-500 to-teal-600 text-white rounded-xl hover:from-teal-600 hover:to-teal-700 hover:scale-105 transition-all shadow-md hover:shadow-lg"
          >
            <Plus className="w-5 h-5" />
            Novo Atendente
          </button>
        )}

        {!showForm && limitReached && (
          <div className="text-center">
            <button
              disabled
              className="flex items-center gap-2 px-4 py-2 bg-gray-300 text-gray-500 rounded-xl cursor-not-allowed opacity-60 shadow-sm"
            >
              <Plus className="w-5 h-5" />
              Limite Atingido
            </button>
            <p className="text-xs text-gray-500 mt-1">Edite ou exclua atendentes existentes</p>
          </div>
        )}
      </div>

      {showForm && (
        <div className="bg-white/70 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-6 mb-6 shadow-md animate-in slide-in-from-top duration-300">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {editingId ? 'Editar Atendente' : 'Novo Atendente'}
            </h3>
            <button
              onClick={handleCancel}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100/50 rounded-lg transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nome completo"
                  className="w-full px-4 py-2.5 bg-white/60 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400 focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@exemplo.com"
                  className="w-full px-4 py-2.5 bg-white/60 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400 focus:bg-white transition-all"
                  disabled={!!editingId}
                />
              </div>
            </div>

            {!editingId && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Senha *
                </label>
                <input
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Senha de acesso"
                  minLength={6}
                  className="w-full px-4 py-2.5 bg-white/60 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400 focus:bg-white transition-all"
                />
                <p className="text-xs text-gray-500 mt-1">Mínimo de 6 caracteres</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Telefone
                </label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  placeholder="(00) 00000-0000"
                  maxLength={15}
                  className="w-full px-4 py-2.5 bg-white/60 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400 focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Função
                </label>
                <input
                  type="text"
                  value={formData.function}
                  onChange={(e) => setFormData({ ...formData, function: e.target.value })}
                  placeholder="Ex: Vendedor, Suporte, Gerente"
                  className="w-full px-4 py-2.5 bg-white/60 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400 focus:bg-white transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Departamento
                </label>
                <select
                  value={formData.department_id}
                  onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white/60 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400 focus:bg-white transition-all"
                >
                  <option value="">Nenhum</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Setor
                </label>
                <select
                  value={formData.sector_id}
                  onChange={(e) => setFormData({ ...formData, sector_id: e.target.value })}
                  disabled={!formData.department_id}
                  className="w-full px-4 py-2.5 bg-white/60 border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400 focus:bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">Nenhum</option>
                  {filteredSectors.map((sector) => (
                    <option key={sector.id} value={sector.id}>
                      {sector.name}
                    </option>
                  ))}
                </select>
                {!formData.department_id && (
                  <p className="text-xs text-gray-400 mt-1">Selecione um departamento primeiro</p>
                )}
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
                />
                <span className="text-sm font-medium text-gray-700">Atendente ativo</span>
              </label>
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
                  editingId ? 'Atualizar' : 'Criar Atendente'
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

      {attendants.length === 0 ? (
        <div className="bg-white/70 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-12 text-center shadow-md">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-blue-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <UserCircle2 className="w-10 h-10 text-blue-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum atendente cadastrado</h3>
          <p className="text-sm text-gray-500">Clique em "Novo Atendente" para adicionar o primeiro atendente</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {attendants.map((attendant, index) => (
            <div
              key={attendant.id}
              className="bg-white/70 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-6 shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 animate-in fade-in slide-in-from-bottom"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center shadow-md">
                  <UserCircle2 className="w-6 h-6 text-white" />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(attendant)}
                    className="p-2 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-all"
                    title="Editar"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(attendant.id, attendant.name)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                    title="Excluir"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex items-start gap-2 mb-2">
                <h3 className="text-lg font-bold text-gray-900 flex-1">{attendant.name}</h3>
                {attendant.is_active ? (
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" title="Ativo" />
                ) : (
                  <XCircle className="w-5 h-5 text-gray-400 flex-shrink-0" title="Inativo" />
                )}
              </div>

              <div className="space-y-1 mb-3">
                <p className="text-sm text-gray-600 truncate">{attendant.email}</p>
                {attendant.phone && (
                  <p className="text-sm text-gray-600">{attendant.phone}</p>
                )}
              </div>

              {(attendant.department || attendant.sector) && (
                <div className="pt-3 border-t border-gray-200/50 space-y-1">
                  {attendant.department && (
                    <p className="text-xs text-gray-500">
                      <span className="font-medium">Depto:</span> {attendant.department.name}
                    </p>
                  )}
                  {attendant.sector && (
                    <p className="text-xs text-gray-500">
                      <span className="font-medium">Setor:</span> {attendant.sector.name}
                    </p>
                  )}
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-gray-200/50">
                <p className="text-xs text-gray-400">
                  Criado em {new Date(attendant.created_at).toLocaleDateString('pt-BR')}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
