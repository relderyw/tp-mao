import React, { useState, useEffect } from 'react';
import {
  UserPlus, Pencil, Trash2, ShieldCheck, User, X, Eye, EyeOff, Search, Users, Loader2
} from 'lucide-react';
import {
  AppUser, UserRole,
  getUsers, createUser, updateUser, deleteUser
} from '../lib/auth';

interface UsersTabProps {
  currentUser: AppUser;
}

type ModalMode = 'create' | 'edit' | null;

const ALL_TABS: { id: 'dashboard' | 'timer' | 'reports' | 'check' | 'users'; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'timer',     label: 'Mapeamento' },
  { id: 'reports',   label: 'Relatório' },
  { id: 'check',     label: 'Check KD' },
  { id: 'users',     label: 'Usuários' },
];

const EMPTY_FORM = {
  username: '',
  password: '',
  displayName: '',
  cargo: '',
  role: 'usuario' as UserRole,
  permissions: {
    allowedTabs: ['dashboard', 'timer', 'reports', 'check'] as ('dashboard' | 'timer' | 'reports' | 'check' | 'users')[],
    canEdit: true,
    canDelete: false,
  }
};

export default function UsersTab({ currentUser }: UsersTabProps) {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<ModalMode>(null);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<AppUser | null>(null);

  const reload = async () => {
    setLoading(true);
    try {
      const data = await getUsers();
      setUsers(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, []);

  const filtered = users.filter(u =>
    u.displayName.toLowerCase().includes(search.toLowerCase()) ||
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    u.cargo.toLowerCase().includes(search.toLowerCase())
  );

  function openCreate() {
    setForm({ ...EMPTY_FORM });
    setError('');
    setShowPass(false);
    setEditingUser(null);
    setModal('create');
  }

  function openEdit(u: AppUser) {
    setForm({
      username: u.username,
      password: u.password || '',
      displayName: u.displayName,
      cargo: u.cargo,
      role: u.role,
      permissions: u.permissions || {
        allowedTabs: u.role === 'administrador' ? ['dashboard', 'timer', 'reports', 'check', 'users'] : ['dashboard', 'timer', 'reports', 'check'],
        canEdit: u.role === 'administrador' ? true : true,
        canDelete: u.role === 'administrador' ? true : false,
      }
    });
    setError('');
    setShowPass(false);
    setEditingUser(u);
    setModal('edit');
  }

  function closeModal() {
    setModal(null);
    setEditingUser(null);
    setError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    
    let err: string | null = null;

    try {
      if (modal === 'create') {
        err = await createUser(form);
      } else if (modal === 'edit' && editingUser) {
        err = await updateUser({ ...editingUser, ...form });
      }

      if (err) { 
        setError(err); 
      } else {
        await reload();
        closeModal();
      }
    } catch (e: any) {
      setError('Erro ao processar solicitação: ' + e.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(u: AppUser) {
    setSubmitting(true);
    try {
      const err = await deleteUser(u.id);
      if (err) { alert(err); return; }
      setDeleteConfirm(null);
      await reload();
    } finally {
      setSubmitting(false);
    }
  }

  const roleLabel = (role: UserRole) =>
    role === 'administrador' ? 'Administrador' : 'Usuário';

  const roleColor = (role: UserRole) =>
    role === 'administrador'
      ? { bg: 'rgba(204,0,0,0.10)', color: '#cc0000', border: 'rgba(204,0,0,0.25)' }
      : { bg: 'rgba(59,130,246,0.10)', color: '#3b82f6', border: 'rgba(59,130,246,0.25)' };

  const avatarColor = (role: UserRole) =>
    role === 'administrador' ? '#cc0000' : '#3b82f6';

  return (
    <div className="users-tab">
      {/* ── Header ── */}
      <div className="users-header">
        <div>
          <h2 className="users-title">
            <Users size={22} style={{ marginRight: 10, verticalAlign: 'middle' }} />
            Gerenciamento de Usuários
          </h2>
          <p className="users-subtitle">
            {loading ? 'Carregando...' : `${users.length} ${users.length === 1 ? 'usuário cadastrado' : 'usuários cadastrados'}`} · Somente administradores têm acesso a esta área
          </p>
        </div>
        <button className="users-btn-add" onClick={openCreate} disabled={loading}>
          <UserPlus size={16} />
          Novo Usuário
        </button>
      </div>

      {/* ── Search ── */}
      <div className="users-search-wrap">
        <Search size={16} className="users-search-icon" />
        <input
          type="text"
          placeholder="Buscar por nome, usuário ou cargo..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="users-search-input"
          disabled={loading}
        />
      </div>

      {/* ── Table ── */}
      <div className="users-table-card">
        {loading ? (
          <div className="users-empty flex flex-col items-center py-20">
            <Loader2 className="animate-spin text-slate-300 mb-4" size={40} />
            <p className="text-slate-500">Acessando banco de dados...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="users-empty">
            <User size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
            <p>Nenhum usuário encontrado.</p>
          </div>
        ) : (
          <table className="users-table">
            <thead>
              <tr>
                <th>Usuário</th>
                <th>Login</th>
                <th>Cargo</th>
                <th>Nível</th>
                <th>Criado em</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => {
                const rc = roleColor(u.role);
                const isSelf = u.id === currentUser.id;
                return (
                  <tr key={u.id} className="users-row">
                    <td>
                      <div className="users-avatar-cell">
                        <div
                          className="users-avatar"
                          style={{ background: avatarColor(u.role) }}
                        >
                          {u.displayName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="users-name">{u.displayName}</div>
                          {isSelf && <div className="users-self-badge">Você</div>}
                        </div>
                      </div>
                    </td>
                    <td>
                      <code className="users-username">@{u.username}</code>
                    </td>
                    <td className="users-cargo">{u.cargo}</td>
                    <td>
                      <span
                        className="users-role-badge"
                        style={{
                          background: rc.bg,
                          color: rc.color,
                          border: `1px solid ${rc.border}`,
                        }}
                      >
                        {u.role === 'administrador' && (
                          <ShieldCheck size={12} style={{ marginRight: 4 }} />
                        )}
                        {roleLabel(u.role)}
                      </span>
                    </td>
                    <td className="users-date">
                      {new Date(u.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                    <td>
                      <div className="users-actions">
                        <button
                          className="users-action-btn edit"
                          onClick={() => openEdit(u)}
                          title="Editar usuário"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          className="users-action-btn del"
                          onClick={() => setDeleteConfirm(u)}
                          title="Excluir usuário"
                          disabled={u.username === 'reldery_assuncao'}
                          style={u.username === 'reldery_assuncao' ? { opacity: 0.3, cursor: 'not-allowed' } : {}}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Create / Edit Modal ── */}
      {modal && (
        <div className="users-modal-overlay" onClick={closeModal}>
          <div className="users-modal" onClick={e => e.stopPropagation()}>
            <div className="users-modal-header">
              <h3>{modal === 'create' ? 'Novo Usuário' : 'Editar Usuário'}</h3>
              <button className="users-modal-close" onClick={closeModal}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="users-modal-body">
              {error && <div className="users-modal-error">{error}</div>}

              <div className="users-form-grid">
                <div className="users-form-group full">
                  <label>Nome Completo *</label>
                  <input
                    type="text"
                    placeholder="Ex: João Silva"
                    value={form.displayName}
                    onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
                    required
                    disabled={submitting}
                  />
                </div>

                <div className="users-form-group">
                  <label>Usuário (login) *</label>
                  <input
                    type="text"
                    placeholder="Ex: joao_silva"
                    value={form.username}
                    onChange={e => setForm(f => ({ ...f, username: e.target.value.toLowerCase().replace(/\s/g, '_') }))}
                    required
                    disabled={submitting || modal === 'edit'}
                  />
                </div>

                <div className="users-form-group">
                  <label>Senha *</label>
                  <div className="users-pass-wrap">
                    <input
                      type={showPass ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={form.password}
                      onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      required={modal === 'create'}
                      disabled={submitting}
                    />
                    <button
                      type="button"
                      className="users-pass-toggle"
                      onClick={() => setShowPass(p => !p)}
                    >
                      {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <div className="users-form-group">
                  <label>Cargo *</label>
                  <input
                    type="text"
                    placeholder="Ex: Analista de Processos"
                    value={form.cargo}
                    onChange={e => setForm(f => ({ ...f, cargo: e.target.value }))}
                    required
                    disabled={submitting}
                  />
                </div>

                <div className="users-form-group">
                  <label>Nível de Acesso *</label>
                  <select
                    value={form.role}
                    onChange={e => {
                      const newRole = e.target.value as UserRole;
                      setForm(f => ({
                        ...f,
                        role: newRole,
                        permissions: {
                          allowedTabs: newRole === 'administrador'
                            ? ['dashboard', 'timer', 'reports', 'check', 'users']
                            : f.permissions.allowedTabs,
                          canEdit: newRole === 'administrador' ? true : f.permissions.canEdit,
                          canDelete: newRole === 'administrador' ? true : f.permissions.canDelete,
                        }
                      }));
                    }}
                    disabled={submitting || (editingUser?.username === 'reldery_assuncao')}
                  >
                    <option value="usuario">Usuário</option>
                    <option value="administrador">Administrador</option>
                  </select>
                </div>
              </div>

              {/* ── Permissões de Acesso e Ações ── */}
              <div className="mt-4 pt-4 border-t border-slate-200">
                <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider mb-2">Permissões de Telas e Ações</h4>
                
                <div className="mb-3">
                  <label className="text-xs text-slate-500 font-semibold block mb-1.5">Telas Acessíveis:</label>
                  <div className="flex flex-wrap gap-2">
                    {ALL_TABS.map(tab => {
                      const checked = form.permissions.allowedTabs.includes(tab.id);
                      return (
                        <label
                          key={tab.id}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer transition-all ${
                            checked
                              ? 'bg-blue-50 border-blue-300 text-blue-700'
                              : 'bg-slate-50 border-slate-200 text-slate-400'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={submitting || form.role === 'administrador'}
                            onChange={e => {
                              const isChecked = e.target.checked;
                              setForm(f => ({
                                ...f,
                                permissions: {
                                  ...f.permissions,
                                  allowedTabs: isChecked
                                    ? [...f.permissions.allowedTabs, tab.id]
                                    : f.permissions.allowedTabs.filter(t => t !== tab.id)
                                }
                              }));
                            }}
                            className="rounded text-blue-600 focus:ring-0"
                          />
                          {tab.label}
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <label className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                    form.permissions.canEdit ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-400'
                  }`}>
                    <input
                      type="checkbox"
                      checked={form.permissions.canEdit}
                      disabled={submitting || form.role === 'administrador'}
                      onChange={e => {
                        const checked = e.target.checked;
                        setForm(f => ({
                          ...f,
                          permissions: { ...f.permissions, canEdit: checked }
                        }));
                      }}
                      className="rounded text-emerald-600 focus:ring-0"
                    />
                    ✏️ Pode Editar Dados
                  </label>

                  <label className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                    form.permissions.canDelete ? 'bg-red-50 border-red-300 text-red-700' : 'bg-slate-50 border-slate-200 text-slate-400'
                  }`}>
                    <input
                      type="checkbox"
                      checked={form.permissions.canDelete}
                      disabled={submitting || form.role === 'administrador'}
                      onChange={e => {
                        const checked = e.target.checked;
                        setForm(f => ({
                          ...f,
                          permissions: { ...f.permissions, canDelete: checked }
                        }));
                      }}
                      className="rounded text-red-600 focus:ring-0"
                    />
                    🗑️ Pode Excluir Dados
                  </label>
                </div>
              </div>

              <div className="users-modal-footer">
                <button type="button" className="users-btn-cancel" onClick={closeModal} disabled={submitting}>
                  Cancelar
                </button>
                <button type="submit" className="users-btn-save" disabled={submitting}>
                  {submitting ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
                  {modal === 'create' ? 'Criar Usuário' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      {deleteConfirm && (
        <div className="users-modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="users-confirm-box" onClick={e => e.stopPropagation()}>
            <div
              className="users-avatar"
              style={{
                width: 56, height: 56, fontSize: '1.5rem',
                background: avatarColor(deleteConfirm.role),
                borderRadius: 16, margin: '0 auto 1rem',
              }}
            >
              {deleteConfirm.displayName.charAt(0).toUpperCase()}
            </div>
            <h3>Excluir usuário?</h3>
            <p>
              Tem certeza que deseja remover <strong>{deleteConfirm.displayName}</strong>?
              <br />Esta ação não pode ser desfeita.
            </p>
            <div className="users-confirm-actions">
              <button className="users-btn-cancel" onClick={() => setDeleteConfirm(null)} disabled={submitting}>
                Cancelar
              </button>
              <button
                className="users-btn-delete"
                onClick={() => handleDelete(deleteConfirm)}
                disabled={submitting}
              >
                {submitting ? <Loader2 className="animate-spin mr-2" size={16} /> : <Trash2 size={15} />} 
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
