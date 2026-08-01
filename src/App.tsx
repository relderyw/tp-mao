/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  LogOut, Activity, BarChart3, Settings as SettingsIcon,
  Table, Eye, EyeOff, Users, Clock, Package, ScanLine, FileText,
  Sun, Moon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const THEME_STORAGE_KEY = 'tp-mao-theme';

function useThemeToggle(): [boolean, () => void] {
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved) return saved === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try { localStorage.setItem(THEME_STORAGE_KEY, isDark ? 'dark' : 'light'); } catch {}
  }, [isDark]);

  return [isDark, () => setIsDark(v => !v)];
}
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
            src="/lsl-logo.png"
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
  const [mappingDirtyCounter, setMappingDirtyCounter] = useState(0);
  const notifyMappingChanged = () => setMappingDirtyCounter(c => c + 1);
  const [isDark, toggleDark] = useThemeToggle();

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
  const userAllowedTabs = currentUser.permissions?.allowedTabs || (isAdmin ? ['dashboard', 'timer', 'reports', 'check', 'users'] : ['dashboard', 'timer', 'reports', 'check']);

  const startTimer = (processId: string) => {
    setSelectedProcessId(processId);
    setActiveTab('timer');
  };

  const allPossibleTabs = [
    { id: 'dashboard',   label: 'Dashboard',  icon: Activity },
    { id: 'timer',       label: 'Mapeamento', icon: Clock },
    { id: 'reports',     label: 'Relatório',  icon: FileText },
    { id: 'check',       label: 'Check KD',   icon: ScanLine },
    { id: 'users',       label: 'Usuários',   icon: Users },
  ] as { id: TabId; label: string; icon: React.ComponentType<any> }[];

  const tabs = allPossibleTabs.filter(tab => isAdmin || userAllowedTabs.includes(tab.id as any));

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-[var(--color-dark-bg)] transition-colors duration-300">
      {/* ── Header ── */}
      <header className="bg-white border-b border-gray-200 dark:bg-[var(--color-dark-surface)] dark:border-[var(--color-dark-border)] sticky top-0 z-30 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex justify-between h-20 items-center gap-2 sm:gap-4">
            {/* Logo (agora em /lsl-logo.png, PNG 300x138 com fundo transparente) */}
            <div className="flex items-center gap-2 min-w-0 flex-shrink-0">
              <div className="app-logo-wrap">
                <img
                  src="/lsl-logo.png"
                  alt="LSL Transportes"
                  className="app-logo-img"
                />
              </div>
            </div>

            {/* Nome da Tela Ativa (Central) — APENAS em mobile/tablet (<lg).
                No desktop (>=lg) a nav desktop já mostra a aba ativa com destaque. */}
            {(() => {
              const tabAtiva = tabs.find(t => t.id === activeTab);
              const TabIcone = tabAtiva?.icon ?? Activity;
              return (
                <div className="flex-1 lg:flex-none flex lg:hidden justify-center items-center px-1 min-w-0">
                  <div
                    className="inline-flex items-center gap-2 px-3 sm:px-5 py-2 rounded-2xl font-black uppercase tracking-wide transition-colors duration-300 whitespace-nowrap"
                    style={{
                      background: isDark ? 'rgba(56,189,248,0.10)' : 'rgba(0,102,178,0.08)',
                      color: isDark ? '#38bdf8' : '#0066b2',
                      boxShadow: isDark
                        ? '0 0 0 1px rgba(56,189,248,0.22), inset 0 1px 0 rgba(255,255,255,0.03)'
                        : '0 0 0 1px rgba(0,102,178,0.10), inset 0 1px 0 rgba(255,255,255,0.6)',
                    }}
                  >
                    <TabIcone className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                    <span className="text-sm sm:text-base font-black leading-none">
                      {tabAtiva?.label || 'Dashboard'}
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* Desktop Nav */}
            <nav className="hidden lg:flex lg:flex-1 lg:justify-center items-center gap-1">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'nav-tab-active'
                      : 'text-gray-600 hover:bg-gray-100 dark:text-[var(--color-dark-muted)] dark:hover:bg-[var(--color-dark-card)]'
                  }`}
                  style={activeTab === tab.id ? { background: isDark ? 'rgba(56,189,248,0.14)' : 'rgba(0,102,178,0.08)', color: isDark ? '#38bdf8' : '#0066b2' } : {}}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                  {tab.id === 'users' && (
                    <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold rounded uppercase tracking-wide"
                      style={{ background: isDark ? 'rgba(56,189,248,0.18)' : 'rgba(0,102,178,0.12)', color: isDark ? '#38bdf8' : '#0066b2' }}>
                      Admin
                    </span>
                  )}
                </button>
              ))}
            </nav>

            {/* Controles: Tema + User + Logout */}
            <div className="flex items-center gap-3">
              {/* Toggle Tema Escuro */}
              <button
                type="button"
                onClick={toggleDark}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-sm border ${
                  isDark
                    ? 'bg-[var(--color-dark-card)] border-[var(--color-dark-border)] text-amber-400 hover:bg-[var(--color-dark-border)]'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
                title={isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={isDark ? 'moon' : 'sun'}
                    initial={{ opacity: 0, rotate: -90, scale: 0.6 }}
                    animate={{ opacity: 1, rotate: 0, scale: 1 }}
                    exit={{ opacity: 0, rotate: 90, scale: 0.6 }}
                    transition={{ duration: 0.22 }}
                    className="flex items-center justify-center"
                  >
                    {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                  </motion.span>
                </AnimatePresence>
              </button>

              {/* Avatar / Nome do Usuário */}
              <div className="flex items-center gap-2 pr-3 border-r border-gray-200 dark:border-[var(--color-dark-border)]">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                  style={{ background: isAdmin ? (isDark ? '#0284c7' : '#0066b2') : '#3b82f6' }}
                >
                  {currentUser.displayName.charAt(0).toUpperCase()}
                </div>
                <div className="hidden xl:flex flex-col">
                  <span className="text-sm font-medium text-gray-700 dark:text-[var(--color-dark-text)] leading-tight">
                    {currentUser.displayName}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-[var(--color-dark-muted)] leading-tight">
                    {currentUser.cargo}
                  </span>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                  isDark
                    ? 'text-[var(--color-dark-muted)] hover:text-sky-400 hover:bg-[var(--color-dark-card)]'
                    : 'text-gray-500 hover:text-[#0066b2]'
                }`}
                onMouseEnter={e => { if (!isDark) { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,102,178,0.08)'; } }}
                onMouseLeave={e => { if (!isDark) { (e.currentTarget as HTMLButtonElement).style.background = ''; } }}
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
                onMappingSaved={notifyMappingChanged}
              />
            )}
            {activeTab === 'reports' && (
              <ItemsReport currentUser={currentUser} />
            )}
            {activeTab === 'check' && (
              <CheckKD
                onStartTimer={(sku) => {
                  setSelectedProcessId(sku);
                  setActiveTab('timer');
                }}
                mappingDirtyCounter={mappingDirtyCounter}
              />
            )}
            {activeTab === 'users' && isAdmin && (
              <UsersTab currentUser={currentUser} />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* ── Mobile Navigation ── */}
      <nav className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 bg-white/90 dark:bg-[var(--color-dark-surface)]/90 backdrop-blur-md border border-gray-200 dark:border-[var(--color-dark-border)] px-4 py-2 rounded-full shadow-xl z-30 flex gap-2 transition-colors duration-300">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`p-3 rounded-full transition-colors ${
              activeTab === tab.id
                ? 'text-white'
                : 'text-gray-500 dark:text-[var(--color-dark-muted)] hover:bg-gray-100 dark:hover:bg-[var(--color-dark-card)]'
            }`}
            style={activeTab === tab.id ? { background: isDark ? '#0284c7' : '#0066b2', boxShadow: isDark ? '0 4px 14px rgba(56,189,248,0.35)' : '0 4px 12px rgba(0,102,178,0.35)' } : {}}
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
