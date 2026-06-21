import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../api';

// RF-11: "El sistema debe disparar alertas visuales inmediatas e
// ininterrumpidas en las terminales de los médicos adscritos al área de
// urgencias 24/7 ante el ingreso de un paciente crítico." El backend ya
// tenía /clinica/alertas, /clinica/alerta y /clinica/alerta-atender; esta
// pantalla es la primera que los usa.

interface Alerta {
    id_alerta: number;
    mensaje: string;
    activa: boolean;
    creado_en: string;
    paciente: string | null;
}

function formatearFecha(iso: string): string {
    return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

export const Alertas: React.FC = () => {
    const [alertas, setAlertas] = useState<Alerta[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState('');
    const [mensaje, setMensaje] = useState('');
    const [creando, setCreando] = useState(false);
    const [atendiendo, setAtendiendo] = useState<number | null>(null);

    const fetchAlertas = useCallback(async () => {
        setCargando(true);
        setError('');
        try {
            const res = await apiFetch('/clinica/alertas');
            const data = await res.json();
            if (data.success) setAlertas(data.alertas);
            else setError(data.error ?? 'No se pudieron cargar las alertas.');
        } catch {
            setError('Error de conexión con el backend.');
        } finally {
            setCargando(false);
        }
    }, []);

    useEffect(() => {
        fetchAlertas();
        // RF-11: ininterrumpidas -> se refresca solo cada 20s para que un
        // ingreso crítico aparezca en todas las terminales sin recargar.
        const intervalo = setInterval(fetchAlertas, 20_000);
        return () => clearInterval(intervalo);
    }, [fetchAlertas]);

    const crearAlerta = async () => {
        if (!mensaje.trim()) return;
        setCreando(true);
        try {
            const idUsuario = localStorage.getItem('id_medico');
            const res = await apiFetch('/clinica/alerta', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mensaje: mensaje.trim(), creado_por: idUsuario ? parseInt(idUsuario, 10) : null }),
            });
            const data = await res.json();
            if (data.success) { setMensaje(''); fetchAlertas(); }
            else alert('Error al crear la alerta: ' + data.error);
        } catch {
            alert('Error de conexión al crear la alerta.');
        } finally {
            setCreando(false);
        }
    };

    const atender = async (id: number) => {
        setAtendiendo(id);
        try {
            const res = await apiFetch(`/clinica/alerta-atender/${id}`, { method: 'POST' });
            const data = await res.json();
            if (data.success) fetchAlertas();
            else alert('Error al marcar como atendida: ' + data.error);
        } catch {
            alert('Error de conexión.');
        } finally {
            setAtendiendo(null);
        }
    };

    return (
        <div style={s.page}>
            <div style={s.header}>
                <div>
                    <p style={s.title}>🚨 Alertas de urgencia</p>
                    <p style={s.subtitle}>Visible para todo el personal médico — área de urgencias 24/7</p>
                </div>
                <button onClick={fetchAlertas} style={s.refreshBtn}>↻ Actualizar</button>
            </div>

            <div style={s.newAlertRow}>
                <input
                    type="text" value={mensaje} onChange={(e) => setMensaje(e.target.value)}
                    placeholder="Ej. Paciente crítico ingresando a urgencias, consultorio 3"
                    style={s.input}
                />
                <button onClick={crearAlerta} disabled={creando || !mensaje.trim()} style={s.btnCrear}>
                    {creando ? 'Enviando...' : '+ Emitir alerta'}
                </button>
            </div>

            {cargando && <p style={s.muted}>Cargando alertas...</p>}
            {error && !cargando && <p style={s.errorText}>{error}</p>}

            {!cargando && !error && (
                alertas.length === 0 ? (
                    <p style={s.muted}>No hay alertas activas en este momento.</p>
                ) : (
                    <div style={s.list}>
                        {alertas.map((a) => (
                            <div key={a.id_alerta} style={s.alertCard}>
                                <div style={s.alertDot} />
                                <div style={{ flex: 1 }}>
                                    <p style={s.alertMsg}>{a.mensaje}</p>
                                    <p style={s.alertMeta}>
                                        {a.paciente ? `Paciente: ${a.paciente} · ` : ''}{formatearFecha(a.creado_en)}
                                    </p>
                                </div>
                                <button onClick={() => atender(a.id_alerta)} disabled={atendiendo === a.id_alerta} style={s.btnAtender}>
                                    {atendiendo === a.id_alerta ? 'Marcando...' : '✓ Atendida'}
                                </button>
                            </div>
                        ))}
                    </div>
                )
            )}
        </div>
    );
};

const s: Record<string, React.CSSProperties> = {
    page: { fontFamily: "'DM Sans','Segoe UI',system-ui,sans-serif", color: 'var(--text-primary)' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px' },
    title: { fontSize: '18px', fontWeight: 600, margin: 0 },
    subtitle: { fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0' },
    refreshBtn: { background: 'var(--accent-soft)', border: '1px solid var(--accent-border)', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', color: 'var(--accent)', cursor: 'pointer', fontFamily: 'inherit' },
    newAlertRow: { display: 'flex', gap: '10px', marginBottom: '20px' },
    input: { flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit' },
    btnCrear: { background: 'var(--danger)', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '10px 18px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' as const },
    muted: { color: 'var(--text-faint)', fontSize: '13px', fontStyle: 'italic' },
    errorText: { color: 'var(--danger-text)', fontSize: '13px' },
    list: { display: 'flex', flexDirection: 'column' as const, gap: '10px' },
    alertCard: { display: 'flex', alignItems: 'center', gap: '14px', background: 'var(--danger-soft)', border: '1px solid rgba(224,92,92,0.3)', borderRadius: '10px', padding: '14px 16px' },
    alertDot: { width: '10px', height: '10px', borderRadius: '50%', background: 'var(--danger)', flexShrink: 0, animation: 'pulse 1.5s infinite' },
    alertMsg: { margin: 0, fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' },
    alertMeta: { margin: '3px 0 0', fontSize: '12px', color: 'var(--text-muted)' },
    btnAtender: { background: 'transparent', border: '1px solid var(--danger)', color: 'var(--danger-text)', borderRadius: '7px', padding: '7px 14px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' as const },
};