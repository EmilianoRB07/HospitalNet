import React, { useState } from 'react';
import { apiFetch } from '../api';

// ─── Tipos ─────────────────────────────────────────────────────────────────────

interface FormData {
  nombre: string;
  fecha_alta: string;
  sexo: string;
  curp: string;
  telefono: string;
  correo_institucional: string;
  especialidad: string;
  horario: string;
  cedula_profesional: string;
  password: string;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export const RegistroMedico: React.FC = () => {
  const [formData, setFormData] = useState<FormData>({
    nombre: '',
    fecha_alta: new Date().toISOString().split('T')[0],
    sexo: '',
    curp: '',
    telefono: '',
    correo_institucional: '',
    especialidad: '',
    horario: '',
    cedula_profesional: '',
    password: '',
  });

  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null);
  const [focusedField, setFocusedField] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCargando(true);
    setMensaje(null);
    try {
      const res = await apiFetch('/clinica/medico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data.success) {
        setMensaje({ tipo: 'exito', texto: data.message });
        setFormData({
          nombre: '', fecha_alta: new Date().toISOString().split('T')[0],
          sexo: '', curp: '', telefono: '', correo_institucional: '',
          especialidad: '', horario: '', cedula_profesional: '', password: '',
        });
      } else {
        setMensaje({ tipo: 'error', texto: data.error });
      }
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error de conexión con el servidor.' });
    } finally {
      setCargando(false);
    }
  };

  // Helpers para focus/blur
  const fp = (name: string) => ({
    onFocus: () => setFocusedField(name),
    onBlur: () => setFocusedField(''),
  });

  const inputStyle = (name: string): React.CSSProperties => ({
    ...s.input,
    ...(focusedField === name ? s.inputFocused : {}),
  });

  const selectStyle = (name: string): React.CSSProperties => ({
    ...s.input,
    ...s.select,
    ...(focusedField === name ? s.inputFocused : {}),
  });

  return (
    <div style={s.page}>

      {/* Topbar */}
      <div style={s.topbar}>
        <div style={s.topbarLeft}>
          <div style={s.logoMark}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="#00c8a0" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          </div>
          <span style={s.breadcrumb}>
            Administración
            <span style={s.breadcrumbSep}>/</span>
            <span style={s.breadcrumbActive}>Alta de médicos</span>
          </span>
        </div>
      </div>

      {/* Card principal */}
      <div style={s.card}>

        {/* Encabezado */}
        <div style={s.cardHeader}>
          <div style={s.headerIcon}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
              stroke="#00c8a0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
              <line x1="12" y1="11" x2="12" y2="17" />
              <line x1="9" y1="14" x2="15" y2="14" />
            </svg>
          </div>
          <div>
            <h1 style={s.cardTitle}>Registrar nuevo médico</h1>
            <p style={s.cardSub}>Ingresa los datos oficiales para generar el expediente y credenciales de acceso.</p>
          </div>
        </div>

        <div style={s.divider} />

        {/* Mensaje de respuesta */}
        {mensaje && (
          <div
            style={{
              ...s.alertBox,
              ...(mensaje.tipo === 'exito' ? s.alertExito : s.alertError),
            }}
            role="alert"
          >
            <span style={{
              ...s.alertDot,
              background: mensaje.tipo === 'exito' ? '#00c8a0' : '#e05c5c',
            }} />
            {mensaje.texto}
          </div>
        )}

        <form onSubmit={handleSubmit} style={s.form} noValidate>
          <div style={s.grid}>

            {/* ── Columna izquierda ─────────────────────────────────── */}
            <div style={s.col}>

              <p style={s.sectionLabel}>Datos personales</p>

              {/* Nombre */}
              <div style={s.fieldGroup}>
                <label style={s.label} htmlFor="nombre">Nombre completo</label>
                <div style={s.inputWrapper}>
                  <span style={s.inputIcon}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </span>
                  <input
                    id="nombre" name="nombre" required
                    value={formData.nombre} onChange={handleChange}
                    placeholder="Ej. Dra. Ana López"
                    style={inputStyle('nombre')} {...fp('nombre')}
                  />
                </div>
              </div>

              {/* CURP */}
              <div style={s.fieldGroup}>
                <label style={s.label} htmlFor="curp">CURP</label>
                <div style={s.inputWrapper}>
                  <span style={s.inputIcon}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="16" rx="2" />
                      <line x1="7" y1="9" x2="17" y2="9" />
                      <line x1="7" y1="13" x2="13" y2="13" />
                    </svg>
                  </span>
                  <input
                    id="curp" name="curp" required maxLength={18}
                    value={formData.curp}
                    onChange={(e) => setFormData({ ...formData, curp: e.target.value.toUpperCase() })}
                    placeholder="18 caracteres"
                    style={{ ...inputStyle('curp'), letterSpacing: '2px', fontFamily: '"Courier New", monospace', fontWeight: 600 }}
                    {...fp('curp')}
                  />
                </div>
              </div>

              {/* Sexo */}
              <div style={s.fieldGroup}>
                <label style={s.label} htmlFor="sexo">Sexo</label>
                <div style={s.inputWrapper}>
                  <span style={s.inputIcon}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="4" />
                      <line x1="12" y1="2" x2="12" y2="8" />
                      <line x1="12" y1="16" x2="12" y2="22" />
                      <line x1="2" y1="12" x2="8" y2="12" />
                      <line x1="16" y1="12" x2="22" y2="12" />
                    </svg>
                  </span>
                  <select id="sexo" name="sexo" required value={formData.sexo}
                    onChange={handleChange} style={selectStyle('sexo')} {...fp('sexo')}>
                    <option value="">Seleccione...</option>
                    <option value="Femenino">Femenino</option>
                    <option value="Masculino">Masculino</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
              </div>

              {/* Especialidad */}
              <div style={s.fieldGroup}>
                <label style={s.label} htmlFor="especialidad">Especialidad</label>
                <div style={s.inputWrapper}>
                  <span style={s.inputIcon}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                    </svg>
                  </span>
                  <select id="especialidad" name="especialidad" required value={formData.especialidad}
                    onChange={handleChange} style={selectStyle('especialidad')} {...fp('especialidad')}>
                    <option value="">Seleccione especialidad...</option>
                    <option value="Medicina General">Medicina General</option>
                    <option value="Pediatría">Pediatría</option>
                    <option value="Cardiología">Cardiología</option>
                    <option value="Ginecología">Ginecología</option>
                    <option value="Traumatología">Traumatología</option>
                  </select>
                </div>
              </div>

              {/* Fecha de alta */}
              <div style={s.fieldGroup}>
                <label style={s.label} htmlFor="fecha_alta">Fecha de alta</label>
                <div style={s.inputWrapper}>
                  <span style={s.inputIcon}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                  </span>
                  <input
                    id="fecha_alta" name="fecha_alta" type="date" required
                    value={formData.fecha_alta} onChange={handleChange}
                    style={inputStyle('fecha_alta')} {...fp('fecha_alta')}
                  />
                </div>
              </div>
            </div>

            {/* ── Columna derecha ───────────────────────────────────── */}
            <div style={s.col}>

              <p style={s.sectionLabel}>Datos profesionales</p>

              {/* Cédula */}
              <div style={s.fieldGroup}>
                <label style={s.label} htmlFor="cedula_profesional">Cédula profesional</label>
                <div style={s.inputWrapper}>
                  <span style={s.inputIcon}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  </span>
                  <input
                    id="cedula_profesional" name="cedula_profesional" required
                    value={formData.cedula_profesional} onChange={handleChange}
                    placeholder="Ej. CED9876543"
                    style={inputStyle('cedula')} {...fp('cedula')}
                  />
                </div>
              </div>

              {/* Teléfono */}
              <div style={s.fieldGroup}>
                <label style={s.label} htmlFor="telefono">Teléfono de contacto</label>
                <div style={s.inputWrapper}>
                  <span style={s.inputIcon}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.77 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.7a16 16 0 0 0 5.39 5.39l1.06-1.06a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 15.18z" />
                    </svg>
                  </span>
                  <input
                    id="telefono" name="telefono" required maxLength={10}
                    value={formData.telefono} onChange={handleChange}
                    placeholder="10 dígitos"
                    style={inputStyle('telefono')} {...fp('telefono')}
                  />
                </div>
              </div>

              {/* Horario */}
              <div style={s.fieldGroup}>
                <label style={s.label} htmlFor="horario">Horario asignado</label>
                <div style={s.inputWrapper}>
                  <span style={s.inputIcon}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                  </span>
                  <select id="horario" name="horario" required value={formData.horario}
                    onChange={handleChange} style={selectStyle('horario')} {...fp('horario')}>
                    <option value="">Seleccione turno...</option>
                    <option value="Matutino (07:00 - 15:00)">Matutino (07:00 - 15:00)</option>
                    <option value="Vespertino (15:00 - 22:00)">Vespertino (15:00 - 22:00)</option>
                    <option value="Nocturno (22:00 - 07:00)">Nocturno (22:00 - 07:00)</option>
                  </select>
                </div>
              </div>

              {/* Separador credenciales */}
              <div style={s.sectionDivider}>
                <div style={s.sectionDividerLine} />
                <span style={s.sectionDividerLabel}>Credenciales de acceso</span>
                <div style={s.sectionDividerLine} />
              </div>

              {/* Correo institucional */}
              <div style={s.fieldGroup}>
                <label style={s.label} htmlFor="correo_institucional">Correo institucional</label>
                <div style={s.inputWrapper}>
                  <span style={s.inputIcon}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22,6 12,13 2,6" />
                    </svg>
                  </span>
                  <input
                    id="correo_institucional" name="correo_institucional" type="email" required
                    value={formData.correo_institucional} onChange={handleChange}
                    placeholder="dr.nombre@hospitalnet.com"
                    style={inputStyle('correo')} {...fp('correo')}
                  />
                </div>
              </div>

              {/* Contraseña temporal */}
              <div style={s.fieldGroup}>
                <label style={s.label} htmlFor="password">Contraseña temporal</label>
                <div style={{ ...s.inputWrapper, position: 'relative' }}>
                  <span style={s.inputIcon}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </span>
                  <input
                    id="password" name="password"
                    type={showPassword ? 'text' : 'password'} required
                    value={formData.password} onChange={handleChange}
                    placeholder="Mínimo 6 caracteres"
                    style={{ ...inputStyle('password'), paddingRight: '42px' }}
                    {...fp('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(p => !p)}
                    style={s.eyeBtn}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showPassword ? (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                        stroke="#00c8a0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                        stroke="#00c8a0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Botón submit */}
          <div style={s.divider} />
          <div style={s.actionRow}>
            <button
              type="submit"
              disabled={cargando}
              style={{ ...s.submitBtn, ...(cargando ? s.submitBtnDisabled : {}) }}
            >
              {cargando ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                  <span style={s.spinner} />
                  Registrando en base de datos...
                </span>
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                    <polyline points="17 21 17 13 7 13 7 21" />
                    <polyline points="7 3 7 8 15 8" />
                  </svg>
                  Registrar médico
                </span>
              )}
            </button>
          </div>
        </form>
      </div>

      <p style={s.footerNote}>HospitalNet · Acceso exclusivo para personal médico autorizado</p>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        select option { background: #0d1c2e; color: #ffffff; }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.6); cursor: pointer; }
      `}</style>
    </div>
  );
};

// ─── Estilos ───────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {

  // ── Layout ─────────────────────────────────────────────
  page: {
    fontFamily: "'DM Sans','Segoe UI',system-ui,sans-serif",
    backgroundColor: '#080d12',
    minHeight: '100vh',
    padding: '24px 28px 40px',
    color: '#ffffff',
    animation: 'fadeSlideIn 0.4s ease',
  },

  // ── Topbar ─────────────────────────────────────────────
  topbar: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '22px',
    paddingBottom: '18px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  topbarLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  logoMark: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    background: 'rgba(0,200,160,0.1)',
    border: '1px solid rgba(0,200,160,0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  breadcrumb: {
    fontSize: '13px',
    color: 'rgba(255,255,255,0.3)',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  breadcrumbSep: {
    color: 'rgba(255,255,255,0.15)',
  },
  breadcrumbActive: {
    color: '#00c8a0',
    fontWeight: 500,
  },

  // ── Card ───────────────────────────────────────────────
  card: {
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '12px',
    padding: '28px',
    maxWidth: '860px',
    margin: '0 auto',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '20px',
  },
  headerIcon: {
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    background: 'rgba(0,200,160,0.1)',
    border: '1px solid rgba(0,200,160,0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardTitle: {
    fontSize: '20px',
    fontWeight: 600,
    color: '#ffffff',
    margin: 0,
    lineHeight: 1.2,
  },
  cardSub: {
    fontSize: '12px',
    color: 'rgba(255,255,255,0.35)',
    margin: '3px 0 0',
  },
  divider: {
    height: '1px',
    background: 'rgba(255,255,255,0.06)',
    margin: '20px 0',
  },

  // ── Alertas ────────────────────────────────────────────
  alertBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    borderRadius: '8px',
    padding: '10px 14px',
    marginBottom: '20px',
    fontSize: '13px',
    fontWeight: 400,
    animation: 'fadeSlideIn 0.25s ease',
  },
  alertExito: {
    background: 'rgba(0,200,160,0.1)',
    border: '1px solid rgba(0,200,160,0.25)',
    color: '#00c8a0',
  },
  alertError: {
    background: 'rgba(224,92,92,0.1)',
    border: '1px solid rgba(224,92,92,0.25)',
    color: '#f08080',
  },
  alertDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    flexShrink: 0,
  },

  // ── Form ───────────────────────────────────────────────
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '28px',
  },
  col: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  sectionLabel: {
    fontSize: '11px',
    fontWeight: 500,
    color: '#00c8a0',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    margin: '0 0 2px',
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '11px',
    fontWeight: 500,
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  },
  inputWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  inputIcon: {
    position: 'absolute',
    left: '11px',
    color: 'rgba(255,255,255,0.25)',
    display: 'flex',
    alignItems: 'center',
    pointerEvents: 'none',
    zIndex: 1,
  },
  input: {
    width: '100%',
    padding: '10px 12px 10px 34px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '8px',
    fontSize: '13px',
    color: '#ffffff',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s, background 0.2s',
    fontFamily: 'inherit',
  },
  select: {
    appearance: 'none',
    WebkitAppearance: 'none',
    cursor: 'pointer',
    paddingRight: '32px',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.3)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 10px center',
  },
  inputFocused: {
    borderColor: 'rgba(0,200,160,0.5)',
    background: 'rgba(0,200,160,0.04)',
  },
  eyeBtn: {
    position: 'absolute',
    right: '10px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    padding: '4px',
    borderRadius: '4px',
  },

  // ── Separador de sección ────────────────────────────────
  sectionDivider: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    margin: '6px 0 2px',
  },
  sectionDividerLine: {
    flex: 1,
    height: '1px',
    background: 'rgba(255,255,255,0.06)',
  },
  sectionDividerLabel: {
    fontSize: '10px',
    color: 'rgba(0,200,160,0.6)',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
  },

  // ── Botón ──────────────────────────────────────────────
  actionRow: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  submitBtn: {
    padding: '12px 28px',
    background: '#00c8a0',
    color: '#050e0b',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    letterSpacing: '0.01em',
    transition: 'opacity 0.15s',
    minWidth: '200px',
  },
  submitBtnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  spinner: {
    display: 'inline-block',
    width: '14px',
    height: '14px',
    border: '2px solid rgba(5,14,11,0.3)',
    borderTopColor: '#050e0b',
    borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
  },

  // ── Footer ─────────────────────────────────────────────
  footerNote: {
    textAlign: 'center',
    fontSize: '11px',
    color: 'rgba(255,255,255,0.18)',
    marginTop: '28px',
    marginBottom: 0,
  },
};