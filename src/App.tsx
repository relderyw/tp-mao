/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  LogOut, Activity, BarChart3, Settings as SettingsIcon,
  Table, Eye, EyeOff, Users, Clock, Package, ScanLine, FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Dashboard from './components/Dashboard';
import MappingWorkspace from './components/MappingWorkspace';
import ProcessManager from './components/ProcessManager';
import ItemsReport from './components/ItemsReport';
import Reports from './components/Reports';
import SpreadsheetView from './components/SpreadsheetView';
import UsersTab from './components/UsersTab';
import {
  AppUser,
  validateLogin,
  getSession,
  saveSession,
  clearSession,
} from './lib/auth';
import { mappingService } from './lib/mappingService';
import { InventoryConsultation } from './components/InventoryConsultation';
import CheckKD from './components/CheckKD';

// ─── Login Screen ─────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }: { onLogin: (user: AppUser) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const passRef = useRef<HTMLInputElement>(null);

  // Limpar campos ao montar a tela (ex: após logout)
  useEffect(() => {
    setUsername('');
    setPassword('');
    setError('');
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const user = await validateLogin(username.trim(), password);
      if (user) {
        saveSession(user);
        onLogin(user);
      } else {
        setError('Usuário ou senha incorretos. Verifique e tente novamente.');
        setPassword('');
        passRef.current?.focus();
      }
    } catch (err: any) {
      setError('Erro no banco: ' + (err.message || 'Falha de conexão.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrapper">
      <div className="login-overlay" />
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="login-box"
      >
        {/* LSL Logo */}
        <div className="login-logo-wrap">
          <img
            src="https://frenet.com.br/wp-content/uploads/2025/10/lsl-transportes.png"
            alt="LSL Transportes"
            className="login-logo"
          />
        </div>

        <h1 className="login-title">T&amp;P-MAO</h1>
        <p className="login-subtitle">Mapeamento de Tempos e Processos Logísticos</p>

        <div className="login-divider" />

        <form onSubmit={handleSubmit} className="login-form" noValidate>
          {error && (
            <div className="login-error">
              {error}
            </div>
          )}

          <div className="login-input-group">
            <label className="login-label">Usuário</label>
            <input
              type="text"
              className="login-input"
              placeholder="seu_usuario"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </div>

          <div className="login-input-group">
            <label className="login-label">Senha</label>
            <div className="login-pass-wrap">
              <input
                ref={passRef}
                type={showPass ? 'text' : 'password'}
                className="login-input"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="login-pass-toggle"
                onClick={() => setShowPass(p => !p)}
                tabIndex={-1}
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            id="btn-signin"
            type="submit"
            className="login-btn-google"
            disabled={loading}
          >
            {loading ? (
              <span className="login-spinner" />
            ) : (
              <Clock size={18} />
            )}
            {loading ? 'Verificando...' : 'Entrar no Sistema'}
          </button>
        </form>

        <p className="login-footer-note">
          Sem acesso? Solicite ao administrador do sistema.
        </p>
      </motion.div>
    </div>
  );
}

// ─── App Shell ────────────────────────────────────────────────────────────────
type TabId = 'dashboard' | 'timer' | 'processes' | 'reports' | 'spreadsheet' | 'users' | 'inventory' | 'check';

function AppContent() {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => getSession());
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [selectedProcessId, setSelectedProcessId] = useState<string | null>(null);

  // Restore session on mount
  useEffect(() => {
    const s = getSession();
    if (s) setCurrentUser(s);
  }, []);

  async function handleLogin(user: AppUser) {
    setCurrentUser(user);
    setActiveTab('dashboard');
  }

  function handleLogout() {
    if (confirm('Tem certeza que deseja sair?')) {
      clearSession();
      setCurrentUser(null);
    }
  }

  if (!currentUser) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  const isAdmin = currentUser.role === 'administrador';

  const startTimer = (processId: string) => {
    setSelectedProcessId(processId);
    setActiveTab('timer');
  };

  const tabs = [
    { id: 'dashboard',   label: 'Dashboard',  icon: Activity },
    { id: 'timer',       label: 'Mapeamento', icon: Clock },
    { id: 'reports',     label: 'Relatório',  icon: FileText },
    { id: 'check',       label: 'Check KD',   icon: ScanLine },
    ...(isAdmin ? [
      { id: 'users', label: 'Usuários', icon: Users }
    ] : []),
  ] as { id: TabId; label: string; icon: React.ComponentType<any> }[];

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* ── Header ── */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="app-logo-circle">
                <img
                  src="https://frenet.com.br/wp-content/uploads/2025/10/lsl-transportes.png"
                  alt="LSL"
                  className="app-logo-img"
                />
              </div>
              <div className="hidden sm:flex flex-col leading-tight">
                <span className="text-base font-black tracking-tight text-gray-900" style={{ letterSpacing: '-0.03em' }}>
                  T&amp;P-MAO
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#0066b2' }}>
                  LSL Transportes
                </span>
              </div>
            </div>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-1">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'nav-tab-active'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                  style={activeTab === tab.id ? { background: 'rgba(0,102,178,0.08)', color: '#0066b2' } : {}}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                  {tab.id === 'users' && (
                    <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold rounded uppercase tracking-wide"
                      style={{ background: 'rgba(0,102,178,0.12)', color: '#0066b2' }}>
                      Admin
                    </span>
                  )}
                </button>
              ))}
            </nav>

            {/* User + Logout */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 pr-4 border-r border-gray-200">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
                  style={{ background: isAdmin ? '#0066b2' : '#3b82f6' }}
                >
                  {currentUser.displayName.charAt(0).toUpperCase()}
                </div>
                <div className="hidden lg:flex flex-col">
                  <span className="text-sm font-medium text-gray-700 leading-tight">
                    {currentUser.displayName}
                  </span>
                  <span className="text-xs text-gray-400 leading-tight">
                    {currentUser.cargo}
                  </span>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 text-gray-500 rounded-lg transition-colors"
                style={{} as any}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#0066b2'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,102,178,0.08)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = ''; (e.currentTarget as HTMLButtonElement).style.background = ''; }}
                title="Sair"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'dashboard' && (
              <Dashboard 
                onNavigate={(tab: TabId) => setActiveTab(tab)} 
              />
            )}
            {activeTab === 'timer' && (
              <MappingWorkspace
                initialSku={selectedProcessId || undefined}
              />
            )}
            {activeTab === 'reports' && (
              <ItemsReport />
            )}
            {activeTab === 'check' && (
              <CheckKD
                onStartTimer={(sku) => {
                  setSelectedProcessId(sku);
                  setActiveTab('timer');
                }}
              />
            )}
            {activeTab === 'users' && isAdmin && (
              <UsersTab currentUser={currentUser} />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* ── Mobile Navigation ── */}
      <nav className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 bg-white/80 backdrop-blur-md border border-gray-200 px-4 py-2 rounded-full shadow-xl z-30 flex gap-2">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`p-3 rounded-full transition-colors ${
              activeTab === tab.id
                ? 'text-white'
                : 'text-gray-500 hover:bg-gray-100'
            }`}
            style={activeTab === tab.id ? { background: '#0066b2', boxShadow: '0 4px 12px rgba(0,102,178,0.35)' } : {}}
          >
            <tab.icon className="w-5 h-5" />
          </button>
        ))}
      </nav>
    </div>
  );
}

export default function App() {
  return <AppContent />;
}
