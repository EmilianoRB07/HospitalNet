import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Login } from './Components/Login';
import { Agenda } from './Components/Agenda';
import { ConsultaMedica } from './Components/ConsultaMedica';
import { RegistroMedico } from './Components/RegistroMedico';
import { ConsultaEspecialidad } from './Components/ConsultaEspecialidad';
import { Interconsultas } from './Components/Interconsultas';
import type { InterconsultaPendiente } from './Components/Interconsultas';
import { Cajas } from './Components/Cajas';
import { Alertas } from './Components/Alertas';
import { Reportes } from './Components/Reportes';
import { apiFetch } from './api';

interface MedicoReciente {
  nombre: string;
  apellidos: string;
  especialidad: string;
}

interface PacienteResumen {
  id_cita: number;
  id_paciente: number;
  nombre: string;
  apellidos: string;
  edad: number;
  sexo: string;
  tipo_sangre: string;
  telefono: string;
  alergias: string;
  medico_asignado: string;
  estado_pago: string;
}

const INACTIVITY_TIME = 300_000;

// ── Hook tema claro/oscuro ────────────────────────────────────────────
function useTheme() {
  const [theme, setTheme] = useState<'dark' | 'light'>(
    () => (localStorage.getItem('hn_theme') as 'dark' | 'light') || 'dark'
  );
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('hn_theme', theme);
  }, [theme]);
  const toggle = useCallback(() => setTheme(t => t === 'dark' ? 'light' : 'dark'), []);
  return { theme, toggle };
}

// ── Íconos ────────────────────────────────────────────────────────────
const EcgIcon: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);
const SunIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);
const MoonIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60).toString().padStart(2, '0');
  const s = (totalSec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// ── Panel Admin/Recepción ─────────────────────────────────────────────
const AdminPanel: React.FC<{ onNavigate: (vista: string) => void }> = ({ onNavigate }) => {
  const [stats, setStats] = useState({ medicos: 0, pacientes: 0, citas_hoy: 0 });
  const [medicosLista, setMedicosLista] = useState<MedicoReciente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [generandoCitas, setGenerandoCitas] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch('/dashboard/admin');
        const data = await res.json();
        if (data.success) { setStats(data.stats); setMedicosLista(data.medicos_recientes); }
      } catch (e) { console.error(e); }
      finally { setCargando(false); }
    })();
  }, []);

  const ADMIN_STATS = [
    { label: 'Médicos registrados', value: stats.medicos, sub: 'En el sistema', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg> },
    { label: 'Especialidades', value: 11, sub: 'Catálogo base', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg> },
    { label: 'Citas hoy', value: stats.citas_hoy, sub: 'En agenda', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg> },
    { label: 'Pacientes', value: stats.pacientes, sub: 'Expedientes', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg> },
  ];

  const quickActions = [
    { id: 'registro', label: 'Registrar personal', sub: 'Agregar médico al sistema', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" /></svg> },
    { id: 'generar_citas', label: generandoCitas ? 'Generando...' : 'Generar citas hoy', sub: 'Asignar citas a pacientes sin agenda', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg> },
    { id: 'cajas', label: 'Cajas / cobros pendientes', sub: 'Registrar pagos de citas (RN-03)', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg> },
    { id: 'alertas', label: 'Alertas de urgencia', sub: 'Ver y emitir alertas 24/7 (RF-11)', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg> },
    { id: 'reportes', label: 'Reportes del sistema', sub: 'Productividad por médico (RF-12)', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg> },
  ];

  if (cargando) return (
    <div style={s.loadingWrap}>
      <div style={s.loadingSpinner} />
      <p style={s.loadingText}>Cargando datos del servidor...</p>
    </div>
  );

  return (
    <div style={s.adminWrap}>
      <p style={s.pageLabel}>Panel de recepción / administración</p>

      <div style={s.statsGrid}>
        {ADMIN_STATS.map((stat) => (
          <div key={stat.label} style={s.statCard}>
            <div style={s.statIconWrap}>{stat.icon}</div>
            <span style={s.statValue}>{stat.value}</span>
            <span style={s.statLabel}>{stat.label}</span>
            <span style={s.statSub}>{stat.sub}</span>
          </div>
        ))}
      </div>

      <div style={s.contentGrid}>
        <div style={s.card}>
          <h3 style={s.cardTitle}>Personal médico reciente</h3>
          {medicosLista.length === 0 && <p style={s.emptyText}>No hay médicos registrados.</p>}
          {medicosLista.map((d, i) => (
            <div key={i} style={s.doctorRow}>
              <div style={s.avatar}>{d.nombre.charAt(0)}</div>
              <div style={{ flex: 1 }}>
                <p style={s.doctorName}>{d.nombre} {d.apellidos}</p>
                <p style={s.doctorSpec}>{d.especialidad}</p>
              </div>
              <span style={s.statusBadge}>Activo</span>
            </div>
          ))}
        </div>

        <div style={s.card}>
          <h3 style={s.cardTitle}>Acciones rápidas</h3>
          {quickActions.map((a) => (
            <div key={a.id} style={s.quickRow}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              onClick={async () => {
                if (a.id === 'registro') { onNavigate('registro'); return; }
                if (a.id === 'cajas') { onNavigate('cajas'); return; }
                if (a.id === 'alertas') { onNavigate('alertas'); return; }
                if (a.id === 'reportes') { onNavigate('reportes'); return; }
                if (a.id === 'generar_citas') {
                  if (generandoCitas) return;
                  setGenerandoCitas(true);
                  try {
                    const res = await apiFetch('/agenda/generar-lote', { method: 'POST' });
                    const data = await res.json();
                    alert(data.success
                      ? (data.citas_generadas === 0 ? '✓ Todos los pacientes ya tienen cita hoy.' : `✓ ${data.mensaje}`)
                      : 'Error: ' + data.error);
                  } catch { alert('Error de conexión.'); }
                  finally { setGenerandoCitas(false); }
                }
              }}
            >
              <span style={s.quickIconWrap}>{a.icon}</span>
              <div style={{ flex: 1 }}>
                <p style={s.quickLabel}>{a.label}</p>
                <p style={s.quickSub}>{a.sub}</p>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="var(--accent-border)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
              </svg>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ── App principal ─────────────────────────────────────────────────────
function App() {
  const { theme, toggle } = useTheme();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [userRol, setUserRol] = useState<string>('');
  const [userNombre, setUserNombre] = useState<string>('');
  const [countdown, setCountdown] = useState<number>(INACTIVITY_TIME);
  const [pacienteSeleccionado, setPacienteSeleccionado] = useState<PacienteResumen | null>(null);
  const [adminVista, setAdminVista] = useState<'dashboard' | 'registro' | 'cajas' | 'alertas' | 'reportes'>('dashboard');
  // FIX CU-05: cuando el especialista atiende desde la bandeja de
  // interconsultas (en vez de su agenda normal), ConsultaEspecialidad
  // necesita esos datos reales en vez del setTimeout simulado que tenía.
  const [interconsultaActiva, setInterconsultaActiva] = useState<InterconsultaPendiente | null>(null);
  const [vistaEspecialista, setVistaEspecialista] = useState<'agenda' | 'interconsultas' | 'alertas'>('agenda');

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastActivityRef = useRef<number>(0);

  const handleLogout = useCallback((reason: 'inactivity' | 'manual' = 'manual'): void => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
    localStorage.removeItem('token');
    localStorage.removeItem('id_medico');
    localStorage.removeItem('rol_id');
    localStorage.removeItem('rol');
    setIsAuthenticated(false);
    setUserRol(''); setUserNombre('');
    setCountdown(INACTIVITY_TIME);
    setPacienteSeleccionado(null);
    setAdminVista('dashboard');
    setInterconsultaActiva(null);
    setVistaEspecialista('agenda');
    if (reason === 'inactivity') alert('Tu sesión se cerró por inactividad.');
  }, []);

  const resetTimer = useCallback((): void => {
    if (!isAuthenticated) return;
    lastActivityRef.current = Date.now();
    setCountdown(INACTIVITY_TIME);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => handleLogout('inactivity'), INACTIVITY_TIME);
  }, [isAuthenticated, handleLogout]);

  useEffect(() => {
    if (!isAuthenticated) return;
    intervalRef.current = setInterval(() => {
      setCountdown(Math.max(0, INACTIVITY_TIME - (Date.now() - lastActivityRef.current)));
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const events = ['mousemove', 'click', 'keydown', 'scroll', 'touchstart'] as const;
    events.forEach(ev => window.addEventListener(ev, resetTimer, { passive: true }));
    const id = setTimeout(resetTimer, 0);
    return () => {
      clearTimeout(id);
      events.forEach(ev => window.removeEventListener(ev, resetTimer));
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [isAuthenticated, resetTimer]);

  if (!isAuthenticated) {
    return (
      <Login onLoginSuccess={(rol, nombre) => {
        setUserRol(rol); setUserNombre(nombre); setIsAuthenticated(true);
      }} />
    );
  }

  const isWarning = countdown < 60_000;
  const iniciales = userNombre.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase();

  return (
    <div style={s.dashboard}>
      {/* ── Header ── */}
      <header style={s.header}>
        <div style={s.headerLeft}>
          <div style={s.logoMark}><EcgIcon /></div>
          <span style={s.logoText}>Hospital<span style={{ color: 'var(--accent)' }}>Net</span></span>
          <div style={s.dividerV} />
          <span style={s.rolBadge}>{userRol}</span>
        </div>

        <div style={s.headerRight}>
          {userNombre && (
            <div style={s.userInfo}>
              <div style={s.userAvatar}>{iniciales}</div>
              <span style={s.userNombre}>{userNombre}</span>
            </div>
          )}

          {/* Countdown */}
          <div style={{ ...s.countdownPill, ...(isWarning ? s.countdownWarning : {}) }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke={isWarning ? 'var(--warning)' : 'var(--accent)'}
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
            <span>{formatCountdown(countdown)}</span>
          </div>

          {/* Toggle tema */}
          <button onClick={toggle} style={s.themeBtn}
            title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent-border)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            <span>{theme === 'dark' ? 'Claro' : 'Oscuro'}</span>
          </button>

          {/* Cerrar sesión */}
          <button onClick={() => handleLogout('manual')} style={s.logoutBtn}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--danger-soft)'; e.currentTarget.style.borderColor = 'var(--danger)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(224,92,92,0.25)'; }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Cerrar sesión
          </button>
        </div>
      </header>

      {/* ── Contenido ── */}
      <main style={s.content}>
        {userRol === 'Administrador' ? (
          adminVista === 'dashboard' ? (
            <AdminPanel onNavigate={v => setAdminVista(v as 'dashboard' | 'registro' | 'cajas' | 'alertas' | 'reportes')} />
          ) : (
            <div>
              <button style={s.backBtn}
                onClick={() => setAdminVista('dashboard')}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-border)'; e.currentTarget.style.color = 'var(--accent)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}>
                ← Volver al Panel
              </button>
              {adminVista === 'registro' && <RegistroMedico />}
              {adminVista === 'cajas' && <Cajas />}
              {adminVista === 'alertas' && <Alertas />}
              {adminVista === 'reportes' && <Reportes />}
            </div>
          )
        ) : pacienteSeleccionado ? (
          parseInt(localStorage.getItem('rol_id') || '0', 10) === 3 ? (
            <ConsultaEspecialidad
              paciente={pacienteSeleccionado}
              interconsulta={interconsultaActiva}
              onVolver={() => { setPacienteSeleccionado(null); setInterconsultaActiva(null); }}
            />
          ) : (
            <ConsultaMedica paciente={pacienteSeleccionado} historial={[]} onVolver={() => setPacienteSeleccionado(null)} />
          )
        ) : (
          <div>
            {/* Pestañas: todo médico ve Agenda + Alertas; el especialista
                además ve su bandeja de Interconsultas (CU-05). */}
            <div style={s.tabBar}>
              <button
                onClick={() => setVistaEspecialista('agenda')}
                style={vistaEspecialista === 'agenda' ? s.tabActivo : s.tabInactivo}>
                Mi agenda
              </button>
              {parseInt(localStorage.getItem('rol_id') || '0', 10) === 3 && (
                <button
                  onClick={() => setVistaEspecialista('interconsultas')}
                  style={vistaEspecialista === 'interconsultas' ? s.tabActivo : s.tabInactivo}>
                  Interconsultas pendientes
                </button>
              )}
              <button
                onClick={() => setVistaEspecialista('alertas')}
                style={vistaEspecialista === 'alertas' ? s.tabActivo : s.tabInactivo}>
                Alertas de urgencia
              </button>
            </div>

            {vistaEspecialista === 'agenda' && (
              <Agenda onIniciarConsulta={p => { setInterconsultaActiva(null); setPacienteSeleccionado(p); }} />
            )}
            {vistaEspecialista === 'interconsultas' && (
              <Interconsultas onAtender={(ic) => {
                setInterconsultaActiva(ic);
                setPacienteSeleccionado({
                  id_cita: 0,
                  id_paciente: ic.id_paciente,
                  nombre: ic.nombre,
                  apellidos: ic.apellidos,
                  edad: ic.edad,
                  sexo: ic.sexo,
                  tipo_sangre: ic.tipo_sangre,
                  telefono: '',
                  alergias: ic.alergias,
                  medico_asignado: ic.nombre_emisor,
                  estado_pago: 'Diferido',
                });
              }} />
            )}
            {vistaEspecialista === 'alertas' && <Alertas />}
          </div>
        )}
      </main>
    </div>
  );
}

// ── Estilos con variables CSS (modo claro/oscuro automático) ──────────
const s: Record<string, React.CSSProperties> = {
  dashboard: { display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: 'var(--bg-app)', fontFamily: "'DM Sans','Segoe UI',system-ui,sans-serif", color: 'var(--text-primary)' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-panel)', borderBottom: '1px solid var(--accent-border)', padding: '0 24px', height: '58px', gap: '12px', flexShrink: 0 },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '12px' },
  headerRight: { display: 'flex', alignItems: 'center', gap: '10px' },
  logoMark: { width: '34px', height: '34px', borderRadius: '8px', background: 'var(--accent-soft)', border: '1px solid var(--accent-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  logoText: { fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.3px' },
  dividerV: { width: '1px', height: '20px', background: 'var(--border)' },
  rolBadge: { fontSize: '11px', fontWeight: 500, background: 'var(--accent-soft)', color: 'var(--accent)', padding: '4px 10px', borderRadius: '20px', border: '1px solid var(--accent-border)' },
  userInfo: { display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 10px 4px 4px', borderRadius: '20px', background: 'var(--bg-hover)', border: '1px solid var(--border)' },
  userAvatar: { width: '26px', height: '26px', borderRadius: '50%', background: 'var(--accent-soft)', border: '1px solid var(--accent-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 600, color: 'var(--accent)', flexShrink: 0 },
  userNombre: { fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', whiteSpace: 'nowrap' },
  countdownPill: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)', background: 'var(--bg-hover)', border: '1px solid var(--border)', padding: '5px 10px', borderRadius: '20px', fontVariantNumeric: 'tabular-nums', fontFamily: '"Courier New",monospace' },
  countdownWarning: { color: 'var(--warning)', background: 'var(--warning-soft)', borderColor: 'rgba(240,165,0,0.3)' },
  themeBtn: { display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)', padding: '5px 12px', borderRadius: '7px', cursor: 'pointer', fontSize: '12px', fontFamily: 'inherit', fontWeight: 500, transition: 'border-color 0.15s' },
  logoutBtn: { display: 'flex', alignItems: 'center', gap: '7px', background: 'transparent', border: '1px solid rgba(224,92,92,0.25)', color: 'var(--danger-text)', padding: '6px 14px', borderRadius: '7px', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit', fontWeight: 500, transition: 'background 0.15s,border-color 0.15s' },
  content: { padding: '28px', flex: 1 },
  backBtn: { display: 'inline-flex', alignItems: 'center', gap: '7px', background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', color: 'var(--text-secondary)', cursor: 'pointer', marginBottom: '20px', fontFamily: 'inherit', fontWeight: 500, transition: 'border-color 0.15s,color 0.15s' },
  tabBar: { display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' },
  tabActivo: { background: 'var(--accent-soft)', border: '1px solid var(--accent-border)', color: 'var(--accent)', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  tabInactivo: { background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' },
  adminWrap: { maxWidth: '960px', margin: '0 auto' },
  pageLabel: { fontSize: '12px', color: 'var(--text-muted)', marginBottom: '18px', textTransform: 'uppercase' as const, letterSpacing: '0.08em', fontWeight: 500 },
  loadingWrap: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', gap: '14px', padding: '80px 0' },
  loadingSpinner: { width: '28px', height: '28px', border: '2px solid var(--accent-soft)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' },
  loadingText: { fontSize: '13px', color: 'var(--text-muted)' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '20px' },
  statCard: { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '18px', display: 'flex', flexDirection: 'column' as const, gap: '4px' },
  statIconWrap: { marginBottom: '6px' },
  statValue: { fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1, letterSpacing: '-0.5px' },
  statLabel: { fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500, marginTop: '2px' },
  statSub: { fontSize: '11px', color: 'var(--text-faint)' },
  contentGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
  card: { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '20px' },
  cardTitle: { fontSize: '13px', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '16px', textTransform: 'uppercase' as const, letterSpacing: '0.07em' },
  doctorRow: { display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: '1px solid var(--border)' },
  avatar: { width: '34px', height: '34px', borderRadius: '50%', background: 'var(--accent-soft)', border: '1px solid var(--accent-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 600, color: 'var(--accent)', flexShrink: 0 },
  doctorName: { fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', margin: 0 },
  doctorSpec: { fontSize: '11px', color: 'var(--text-muted)', margin: 0, marginTop: '2px' },
  statusBadge: { fontSize: '10px', padding: '3px 9px', borderRadius: '20px', background: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid var(--accent-border)', fontWeight: 500, whiteSpace: 'nowrap' as const },
  emptyText: { fontSize: '13px', color: 'var(--text-faint)', margin: 0 },
  quickRow: { display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 10px', borderRadius: '8px', cursor: 'pointer', marginBottom: '4px', transition: 'background 0.15s', background: 'transparent' },
  quickIconWrap: { width: '34px', height: '34px', borderRadius: '8px', background: 'var(--accent-soft)', border: '1px solid var(--accent-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', flexShrink: 0 },
  quickLabel: { fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', margin: 0 },
  quickSub: { fontSize: '11px', color: 'var(--text-muted)', margin: 0, marginTop: '2px' },
};

export default App;