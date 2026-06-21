import React, { useState, useEffect, useRef, useCallback } from 'react';
import { apiFetch } from '../api';

interface AuthResponse {
  success: boolean;
  token?: string;
  rol?: string;
  error?: string;
  id_usuario?: number | string;
  id_medico?: number;
  id_rol?: number;
  nombre_completo?: string;
  especialidad?: string; // FIX: se agrega para poder guardarla en localStorage si el backend la envía
}

function drawCaptchaOnCanvas(canvas: HTMLCanvasElement, code: string): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  // fondo: en modo oscuro oscuro, en modo claro claro — leemos la variable CSS
  const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--bg-input').trim() || '#0d1117';
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(Math.random() * W, Math.random() * H);
    ctx.lineTo(Math.random() * W, Math.random() * H);
    ctx.strokeStyle = 'rgba(0,200,160,0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  for (let i = 0; i < 35; i++) {
    ctx.beginPath();
    ctx.arc(Math.random() * W, Math.random() * H, 1, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,200,160,0.2)';
    ctx.fill();
  }
  const chars = code.split('');
  const cellW = W / chars.length;
  ctx.font = 'bold 20px "Courier New", monospace';
  ctx.textBaseline = 'middle';
  chars.forEach((ch, i) => {
    const x = cellW * i + cellW / 2;
    const y = H / 2 + (Math.random() * 6 - 3);
    const angle = (Math.random() - 0.5) * 0.3;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = '#00c8a0';
    ctx.fillText(ch, -7, 0);
    ctx.restore();
  });
}

interface LoginProps {
  onLoginSuccess: (rol: string, nombre: string) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [captchaInput, setCaptchaInput] = useState('');
  const [captchaCode, setCaptchaCode] = useState('');
  const [captchaId, setCaptchaId] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [focusedField, setFocusedField] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // RT-07: el código nace en el servidor (/auth/captcha). El navegador solo
  // lo recibe para dibujarlo distorsionado; la validación real ocurre en
  // /auth/login comparando contra lo guardado server-side.
  const refreshCaptcha = useCallback(async () => {
    setCaptchaInput('');
    try {
      const res = await apiFetch('/auth/captcha');
      const data = await res.json();
      if (data.success) {
        setCaptchaCode(data.codigo);
        setCaptchaId(data.captcha_id);
      } else {
        setErrorMsg('No se pudo generar el CAPTCHA. Verifica que el backend esté activo.');
      }
    } catch {
      setErrorMsg('Error de conexión con el servidor local.');
    }
  }, []);

  useEffect(() => {
    refreshCaptcha();
  }, [refreshCaptcha]);

  useEffect(() => {
    if (canvasRef.current && captchaCode) drawCaptchaOnCanvas(canvasRef.current, captchaCode);
  }, [captchaCode]);

  const passwordHint = password.length > 0 && password.length < 8
    ? `${8 - password.length} caracteres restantes` : '';

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setErrorMsg('');
    if (password.length < 8) { setErrorMsg('La contraseña debe tener al menos 8 caracteres.'); return; }
    if (!captchaId) { setErrorMsg('El CAPTCHA aún no ha cargado. Espera un momento.'); return; }
    setIsLoading(true);
    try {
      const res = await apiFetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
          captchaInput: captchaInput.toUpperCase(),
          captchaId,
        }),
      });
      const data = await res.json() as AuthResponse;
      if (data.success) {
        localStorage.setItem('token', data.token ?? '');
        localStorage.setItem('id_medico', String(data.id_medico ?? ''));
        localStorage.setItem('rol_id', String(data.id_rol ?? '0'));
        localStorage.setItem('rol', String(data.rol ?? ''));
        // FIX: antes no se guardaba el nombre del médico en ningún lado persistente.
        // ConsultaMedica.tsx y ConsultaEspecialidad.tsx necesitan este dato para
        // mostrar al médico correcto (el que está atendiendo AHORA, no el de un
        // campo "medico_asignado" del paciente) en la receta digital (RF-07).
        localStorage.setItem('nombre_medico', data.nombre_completo ?? '');
        if (data.especialidad) localStorage.setItem('especialidad_medico', data.especialidad);
        if (onLoginSuccess) onLoginSuccess(data.rol ?? '', data.nombre_completo ?? '');
      } else {
        setErrorMsg(data.error || 'Error desconocido.');
        refreshCaptcha(); // el CAPTCHA ya se consumió en el servidor, pide uno nuevo
      }
    } catch { setErrorMsg('Error de conexión con el servidor local.'); }
    finally { setIsLoading(false); }
  };

  return (
    <div style={st.page}>
      {/* Panel izquierdo */}
      <div style={st.leftPanel}>
        <div style={st.leftContent}>
          <div style={st.ecgLine}>
            <svg viewBox="0 0 400 80" fill="none" style={{ width: '100%' }}>
              <polyline
                points="0,40 40,40 55,40 65,10 75,70 85,40 110,40 120,15 130,40 180,40 220,40 235,40 245,5 258,75 268,40 310,40 320,20 330,40 400,40"
                stroke="var(--accent)" strokeWidth="2" fill="none" opacity="0.7" />
            </svg>
          </div>
          <div style={st.tagline}>
            <span style={st.taglineAccent}>HospitalNet</span>
            <span style={st.taglineSub}>Sistema Clínico Institucional</span>
          </div>
          <div style={st.statsGrid}>
            {[['24/7', 'Disponibilidad'], ['SSL', 'Conexión segura'], ['IPN', 'ESCOM']].map(([num, lbl]) => (
              <div key={lbl} style={st.statCard}>
                <span style={st.statNumber}>{num}</span>
                <span style={st.statLabel}>{lbl}</span>
              </div>
            ))}
          </div>
          <p style={st.leftFooter}>Acceso exclusivo para personal médico autorizado.</p>
        </div>
      </div>

      {/* Panel derecho — formulario */}
      <div style={st.rightPanel}>
        <div style={st.card}>
          <div style={st.cardHeader}>
            <div style={st.logoMark}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            </div>
            <div>
              <h1 style={st.cardTitle}>Acceso al sistema</h1>
              <p style={st.cardSub}>Ingrese sus credenciales institucionales</p>
            </div>
          </div>

          <div style={st.divider} />

          {errorMsg && (
            <div style={st.errorAlert} role="alert">
              <span style={st.errorDot} />{errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} style={st.form} noValidate>
            {/* Email */}
            <div style={st.fieldGroup}>
              <label style={st.label} htmlFor="email">Correo institucional</label>
              <div style={st.inputWrapper}>
                <span style={st.inputIcon}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                </span>
                <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                  onFocus={() => setFocusedField('email')} onBlur={() => setFocusedField('')}
                  required style={{ ...st.input, ...(focusedField === 'email' ? st.inputFocused : {}) }}
                  placeholder="usuario@hospitalnet.com" autoComplete="email" />
              </div>
            </div>

            {/* Contraseña */}
            <div style={st.fieldGroup}>
              <label style={st.label} htmlFor="password">Contraseña</label>
              <div style={{ ...st.inputWrapper, position: 'relative' }}>
                <span style={st.inputIcon}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </span>
                <input id="password" type={showPassword ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)}
                  onFocus={() => setFocusedField('password')} onBlur={() => setFocusedField('')}
                  required style={{ ...st.input, ...(focusedField === 'password' ? st.inputFocused : {}), paddingRight: '42px' }}
                  placeholder="Mínimo 8 caracteres" autoComplete="current-password" />
                <button type="button" onClick={() => setShowPassword(p => !p)} style={st.eyeBtn}>
                  {showPassword
                    ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                    : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                  }
                </button>
              </div>
              {passwordHint && <span style={st.hint}>{passwordHint}</span>}
              {password.length > 0 && (
                <div style={st.progressBar}>
                  <div style={{
                    ...st.progressFill, width: `${Math.min((password.length / 12) * 100, 100)}%`,
                    backgroundColor: password.length < 8 ? 'var(--danger)' : password.length < 12 ? 'var(--warning)' : 'var(--accent)'
                  }} />
                </div>
              )}
            </div>

            {/* CAPTCHA */}
            <div style={st.fieldGroup}>
              <label style={st.label}>Verificación visual</label>
              <div style={st.captchaRow}>
                <div style={st.canvasBox}>
                  <canvas ref={canvasRef} width={240} height={48}
                    style={{ display: 'block', width: '100%', height: '100%' }} />
                </div>
                <button type="button" onClick={refreshCaptcha} style={st.refreshBtn} title="Nuevo código">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                  </svg>
                </button>
              </div>
            </div>

            <div style={st.fieldGroup}>
              <label style={st.label} htmlFor="captcha-input">Ingresa el código</label>
              <div style={st.inputWrapper}>
                <span style={st.inputIcon}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                  </svg>
                </span>
                <input id="captcha-input" type="text" value={captchaInput}
                  onChange={e => setCaptchaInput(e.target.value)}
                  onFocus={() => setFocusedField('captcha')} onBlur={() => setFocusedField('')}
                  required style={{
                    ...st.input, ...(focusedField === 'captcha' ? st.inputFocused : {}),
                    textTransform: 'uppercase', letterSpacing: '6px', fontWeight: '600', fontFamily: '"Courier New",monospace'
                  }}
                  placeholder="· · · · · ·" maxLength={6} autoComplete="off" />
              </div>
            </div>

            {/* Submit */}
            <button type="submit"
              style={{ ...st.submitBtn, ...(isLoading ? st.submitBtnDisabled : {}) }}
              disabled={isLoading}>
              {isLoading
                ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                  <span style={st.spinner} />Verificando acceso...
                </span>
                : <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  Ingresar al sistema
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                  </svg>
                </span>
              }
            </button>
          </form>

          <p style={st.footerNote}>Acceso restringido · Personal autorizado únicamente</p>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeSlideIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
      `}</style>
    </div>
  );
};

const st: Record<string, React.CSSProperties> = {
  page: { display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-app)', fontFamily: "'DM Sans','Segoe UI',system-ui,sans-serif" },
  leftPanel: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem', background: 'linear-gradient(135deg, var(--bg-panel) 0%, var(--bg-card) 60%, var(--bg-app) 100%)', borderRight: '1px solid var(--accent-border)', position: 'relative', overflow: 'hidden' },
  leftContent: { maxWidth: '380px', width: '100%' },
  ecgLine: { marginBottom: '3rem', opacity: 0.8 },
  tagline: { display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '2.5rem' },
  taglineAccent: { fontSize: '38px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-1px', lineHeight: 1 },
  taglineSub: { fontSize: '14px', color: 'var(--accent)', letterSpacing: '0.08em', textTransform: 'uppercase' as const, fontWeight: 500 },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px', marginBottom: '2.5rem' },
  statCard: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 12px', borderRadius: '10px', background: 'var(--accent-soft)', border: '1px solid var(--accent-border)', gap: '4px' },
  statNumber: { fontSize: '18px', fontWeight: 700, color: 'var(--accent)', lineHeight: 1 },
  statLabel: { fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' as const },
  leftFooter: { fontSize: '12px', color: 'var(--text-faint)', lineHeight: 1.6, margin: 0 },
  rightPanel: { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', minWidth: '460px', maxWidth: '500px', background: 'var(--bg-app)' },
  card: { width: '100%', maxWidth: '420px', animation: 'fadeSlideIn 0.4s ease' },
  cardHeader: { display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' },
  logoMark: { width: '42px', height: '42px', borderRadius: '10px', background: 'var(--accent-soft)', border: '1px solid var(--accent-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cardTitle: { fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', margin: 0, lineHeight: 1.2 },
  cardSub: { fontSize: '12px', color: 'var(--text-muted)', margin: 0, marginTop: '3px' },
  divider: { height: '1px', background: 'var(--border)', marginBottom: '24px' },
  errorAlert: { display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--danger-soft)', border: '1px solid rgba(224,92,92,0.25)', borderRadius: '8px', padding: '10px 14px', marginBottom: '20px', fontSize: '13px', color: 'var(--danger-text)', animation: 'fadeSlideIn 0.25s ease' },
  errorDot: { width: '6px', height: '6px', borderRadius: '50%', background: 'var(--danger)', flexShrink: 0 },
  form: { display: 'flex', flexDirection: 'column', gap: '18px' },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase' as const },
  inputWrapper: { position: 'relative', display: 'flex', alignItems: 'center' },
  inputIcon: { position: 'absolute', left: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', pointerEvents: 'none', zIndex: 1 },
  input: { width: '100%', padding: '11px 12px 11px 38px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s,background 0.2s', fontFamily: 'inherit' },
  inputFocused: { borderColor: 'var(--accent-border)', background: 'var(--accent-soft)' },
  hint: { fontSize: '11px', color: 'var(--warning)', marginTop: '2px' },
  progressBar: { height: '2px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden', marginTop: '4px' },
  progressFill: { height: '100%', borderRadius: '2px', transition: 'width 0.3s ease,background-color 0.3s ease' },
  eyeBtn: { position: 'absolute', right: '10px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px', borderRadius: '4px' },
  captchaRow: { display: 'flex', alignItems: 'center', gap: '10px' },
  canvasBox: { flex: 1, height: '48px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--accent-border)', background: 'var(--bg-input)' },
  refreshBtn: { width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--accent-soft)', border: '1px solid var(--accent-border)', borderRadius: '8px', cursor: 'pointer', flexShrink: 0 },
  submitBtn: { padding: '13px', background: 'var(--accent)', color: '#050e0b', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', marginTop: '4px', transition: 'opacity 0.15s', fontFamily: 'inherit' },
  submitBtnDisabled: { opacity: 0.5, cursor: 'not-allowed' },
  spinner: { display: 'inline-block', width: '14px', height: '14px', border: '2px solid rgba(5,14,11,0.3)', borderTopColor: '#050e0b', borderRadius: '50%', animation: 'spin 0.7s linear infinite' },
  footerNote: { textAlign: 'center' as const, fontSize: '11px', color: 'var(--text-faint)', marginTop: '24px', marginBottom: 0 },
};
