import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../api';

interface Cita {
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
  estado?: 'Programada' | 'Atendida' | 'Cancelada';
  estado_pago?: 'Pagado' | 'Pendiente';
  fecha_hora?: string;
}

export interface PacienteResumen {
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

interface AgendaProps {
  onIniciarConsulta: (paciente: PacienteResumen) => void;
}

function formatHora(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

export const Agenda: React.FC<AgendaProps> = ({ onIniciarConsulta }) => {
  const [citas, setCitas] = useState<Cita[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  const fetchAgenda = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError('');
    const idMedicoActual = localStorage.getItem('id_medico');
    if (!idMedicoActual) { setError('No hay médico logueado.'); setLoading(false); return; }
    try {
      const res = await apiFetch(`/agenda/?id_medico=${idMedicoActual}`);
      const data = await res.json();
      if (data.success) setCitas(data.agenda);
      else setError(data.error ?? 'No se pudo cargar la agenda.');
    } catch { setError('Error de comunicación con el backend.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchAgenda();
    const intervalo = setInterval(fetchAgenda, 15 * 60 * 1000);
    return () => clearInterval(intervalo);
  }, [fetchAgenda]);

  const handleIniciarConsulta = async (cita: Cita): Promise<void> => {
    const rolUsuario = localStorage.getItem('rol') || 'Médico General';
    const idMedicoActual = localStorage.getItem('id_medico');
    if (!idMedicoActual) return;

    if (rolUsuario !== 'Especialista' && rolUsuario !== 'Médico Especialista') {
      if (cita.estado_pago === 'Pendiente') {
        alert('⚠ MSG-07: No se puede iniciar la consulta.\nEl paciente no cuenta con registro de pago previo en cajas.\n\n(ERR-03)');
        return;
      }
    }
    try {
      const res = await apiFetch('/clinica/iniciar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_cita: cita.id_cita, id_medico: idMedicoActual }),
      });
      const data = await res.json();
      if (data.success) {
        onIniciarConsulta({
          id_cita: cita.id_cita,
          id_paciente: cita.id_paciente,
          nombre: cita.nombre,
          apellidos: cita.apellidos,
          edad: cita.edad ?? 0,
          sexo: cita.sexo ?? 'No especificado',
          tipo_sangre: cita.tipo_sangre ?? 'No registrado',
          telefono: cita.telefono ?? 'Sin teléfono',
          alergias: cita.alergias ?? 'Ninguna conocida',
          medico_asignado: cita.medico_asignado ?? 'Médico tratante',
          estado_pago: cita.estado_pago ?? 'Pendiente',
        });
      } else {
        alert(`❌ ${data.error}`);
        fetchAgenda();
      }
    } catch { alert('Error de comunicación al intentar abrir el expediente.'); }
  };

  const handleCancelarCita = async (id_cita: number): Promise<void> => {
    const motivo = window.prompt('Ingrese el motivo de la cancelación:');
    if (!motivo || motivo.trim() === '') { alert('La cancelación fue abortada. Se requiere un motivo.'); return; }
    try {
      const res = await apiFetch('/agenda/cancelar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_cita, motivo: motivo.trim() }),
      });
      const data = await res.json();
      if (data.success) { alert('Cita cancelada correctamente.'); fetchAgenda(); }
      else alert('Error: ' + data.error);
    } catch { alert('Error de red al intentar cancelar.'); }
  };

  const total = citas.length;
  const atendidas = citas.filter(c => c.estado === 'Atendida').length;
  const pendientes = citas.filter(c => c.estado === 'Programada').length;
  const fechaHoy = new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div style={s.page}>
      {/* Encabezado */}
      <div style={s.pageHeader}>
        <div style={s.headerLeft}>
          <div style={s.logoMark}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          </div>
          <div>
            <p style={s.pageTitle}>Agenda médica del día</p>
            <p style={s.pageDate}>{fechaHoy}</p>
          </div>
        </div>
        <button onClick={fetchAgenda} style={s.refreshBtn}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          Actualizar
        </button>
      </div>

      {/* Tarjetas resumen */}
      <div style={s.statsRow}>
        {[
          { label: 'Total de citas', value: total, color: 'var(--info)' },
          { label: 'Atendidas', value: atendidas, color: 'var(--accent)' },
          { label: 'Pendientes', value: pendientes, color: 'var(--warning)' },
        ].map(({ label, value, color }) => (
          <div key={label} style={s.statCard}>
            <span style={s.statLabel}>{label}</span>
            <span style={{ ...s.statValue, color }}>{value}</span>
          </div>
        ))}
      </div>

      {loading && (
        <div style={s.stateRow}>
          <div style={s.spinner} />
          Cargando citas médicas...
        </div>
      )}

      {error && !loading && (
        <div style={s.errorAlert}>
          <span style={s.errorDot} />{error}
        </div>
      )}

      {!loading && !error && (
        <div style={s.tableCard}>
          <table style={s.table}>
            <thead>
              <tr>
                {['Hora', 'Paciente', 'Estado', 'Pago', 'Acción'].map(h => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {citas.length === 0 ? (
                <tr><td colSpan={5} style={s.emptyCell}>No hay citas registradas para hoy.</td></tr>
              ) : citas.map((cita) => {
                const estado = cita.estado ?? 'Programada';
                const estadoPago = cita.estado_pago ?? 'Pendiente';
                const atendida = estado === 'Atendida';
                const cancelada = estado === 'Cancelada';
                const pagada = estadoPago === 'Pagado';

                const badge = atendida ? s.badgeAtendida : cancelada ? s.badgeCancelada : s.badgeProgramada;

                return (
                  <tr key={`${cita.id_paciente}-${cita.id_cita}`} style={s.tr}>
                    <td style={s.td}>
                      <span style={s.hora}>{cita.fecha_hora ? formatHora(cita.fecha_hora) : '--:--'}</span>
                      <span style={s.horaUnit}> hrs</span>
                    </td>
                    <td style={{ ...s.td, ...s.pacienteName }}>{cita.nombre} {cita.apellidos}</td>
                    <td style={s.td}><span style={badge}>{estado}</span></td>
                    <td style={s.td}>
                      <span style={pagada ? s.badgePagado : s.badgePendiente}>{estadoPago}</span>
                    </td>
                    <td style={s.td}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          style={!pagada || atendida || cancelada ? s.btnDisabled : s.btnAction}
                          disabled={!pagada || atendida || cancelada}
                          onClick={() => handleIniciarConsulta(cita)}
                        >
                          {!pagada ? 'Pendiente' : atendida ? 'Finalizada' : cancelada ? 'Cancelada' : 'Iniciar'}
                        </button>
                        <button
                          style={{
                            ...s.btnAction,
                            backgroundColor: cancelada || atendida ? 'var(--bg-hover)' : 'var(--danger)',
                            color: cancelada || atendida ? 'var(--text-faint)' : '#ffffff',
                            cursor: cancelada || atendida ? 'not-allowed' : 'pointer',
                          }}
                          disabled={cancelada || atendida}
                          onClick={() => handleCancelarCita(cita.id_cita)}
                        >
                          Cancelar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p style={s.footerNote}>HospitalNet · Acceso exclusivo para personal médico autorizado</p>
    </div>
  );
};

const s: Record<string, React.CSSProperties> = {
  page: { fontFamily: "'DM Sans','Segoe UI',system-ui,sans-serif", backgroundColor: 'var(--bg-app)', minHeight: '100vh', padding: '32px 28px', color: 'var(--text-primary)', animation: 'fadeSlideIn 0.4s ease' },
  pageHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', paddingBottom: '18px', borderBottom: '1px solid var(--border)' },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '14px' },
  logoMark: { width: '42px', height: '42px', borderRadius: '10px', background: 'var(--accent-soft)', border: '1px solid var(--accent-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  pageTitle: { fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', margin: 0, lineHeight: 1.2 },
  pageDate: { fontSize: '12px', color: 'var(--text-muted)', margin: 0, marginTop: '3px', textTransform: 'capitalize' as const },
  refreshBtn: { background: 'var(--accent-soft)', border: '1px solid var(--accent-border)', borderRadius: '8px', padding: '9px 16px', fontSize: '13px', color: 'var(--accent)', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '6px', transition: 'background 0.15s' },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px', marginBottom: '20px' },
  statCard: { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '16px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  statLabel: { fontSize: '12px', color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase' as const },
  statValue: { fontSize: '28px', fontWeight: 600 },
  tableCard: { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse' as const },
  th: { padding: '12px 16px', fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)', textAlign: 'left' as const, letterSpacing: '0.06em', textTransform: 'uppercase' as const, background: 'var(--accent-soft)', borderBottom: '1px solid var(--border)' },
  tr: { borderTop: '1px solid var(--border)' },
  td: { padding: '14px 16px', fontSize: '13px', color: 'var(--text-secondary)' },
  pacienteName: { fontWeight: 500, color: 'var(--text-primary)' },
  emptyCell: { padding: '28px', textAlign: 'center' as const, color: 'var(--text-faint)', fontSize: '13px', fontStyle: 'italic' },
  hora: { fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' },
  horaUnit: { fontSize: '11px', color: 'var(--text-muted)' },
  badgeProgramada: { background: 'var(--warning-soft)', color: 'var(--warning)', border: '1px solid rgba(240,165,0,0.25)', padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 500 },
  badgeAtendida: { background: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid var(--accent-border)', padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 500 },
  badgeCancelada: { background: 'var(--danger-soft)', color: 'var(--danger)', border: '1px solid rgba(224,92,92,0.25)', padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 500 },
  badgePagado: { background: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid var(--accent-border)', padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 500 },
  badgePendiente: { background: 'var(--danger-soft)', color: 'var(--danger-text)', border: '1px solid rgba(224,92,92,0.25)', padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 500 },
  btnAction: { background: 'var(--accent)', color: '#050e0b', border: 'none', padding: '7px 14px', borderRadius: '7px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'opacity 0.15s' },
  btnDisabled: { background: 'var(--bg-hover)', color: 'var(--text-faint)', border: 'none', padding: '7px 14px', borderRadius: '7px', fontSize: '12px', cursor: 'not-allowed', fontFamily: 'inherit' },
  stateRow: { display: 'flex', alignItems: 'center', gap: '10px', padding: '24px 0', color: 'var(--text-muted)', fontSize: '13px' },
  spinner: { width: '16px', height: '16px', border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 },
  errorAlert: { display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--danger-soft)', border: '1px solid rgba(224,92,92,0.25)', borderRadius: '8px', padding: '10px 14px', marginBottom: '20px', fontSize: '13px', color: 'var(--danger-text)', animation: 'fadeSlideIn 0.25s ease' },
  errorDot: { width: '6px', height: '6px', borderRadius: '50%', background: 'var(--danger)', flexShrink: 0 },
  footerNote: { textAlign: 'center' as const, fontSize: '11px', color: 'var(--text-faint)', marginTop: '28px', marginBottom: 0 },
};