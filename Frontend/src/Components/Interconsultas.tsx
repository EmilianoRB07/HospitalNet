import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../api';

// CU-05: "El especialista accede a la bandeja de 'Pacientes en interconsulta'
// e inicia la primera cita de revisión." Antes esto no existía en el
// frontend: ConsultaEspecialidad.tsx mostraba datos fijos con un setTimeout
// sin importar el paciente. Esta pantalla es la bandeja real.

export interface InterconsultaPendiente {
    id_interconsulta: number;
    id_paciente: number;
    estado: string;
    especialidad: string;
    motivo_clinico: string;
    created_at: string;
    nombre: string;
    apellidos: string;
    edad: number;
    sexo: string;
    tipo_sangre: string;
    alergias: string;
    nombre_emisor: string;
}

interface InterconsultasProps {
    onAtender: (info: InterconsultaPendiente) => void;
}

function formatearFecha(iso: string): string {
    return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export const Interconsultas: React.FC<InterconsultasProps> = ({ onAtender }) => {
    const [lista, setLista] = useState<InterconsultaPendiente[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState('');
    const [iniciando, setIniciando] = useState<number | null>(null);

    const fetchLista = useCallback(async () => {
        setCargando(true);
        setError('');
        const idMedico = localStorage.getItem('id_medico');
        if (!idMedico) { setError('No hay médico logueado.'); setCargando(false); return; }
        try {
            const res = await apiFetch(`/clinica/interconsultas-pendientes?id_medico=${idMedico}`);
            const data = await res.json();
            if (data.success) setLista(data.interconsultas);
            else setError(data.error ?? 'No se pudieron cargar las interconsultas.');
        } catch {
            setError('Error de conexión con el backend.');
        } finally {
            setCargando(false);
        }
    }, []);

    useEffect(() => { fetchLista(); }, [fetchLista]);

    const handleAtender = async (ic: InterconsultaPendiente) => {
        setIniciando(ic.id_interconsulta);
        try {
            // FIX CU-05/RN-02: hasta que esto se llama, la interconsulta sigue
            // en 'Pendiente' y el backend NO concede acceso a signos/historial
            // del paciente, aunque el especialista la vea en esta bandeja.
            const res = await apiFetch('/clinica/interconsulta-iniciar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id_interconsulta: ic.id_interconsulta }),
            });
            const data = await res.json();
            if (data.success) {
                onAtender(ic);
            } else {
                alert('No se pudo iniciar la interconsulta: ' + data.error);
                fetchLista();
            }
        } catch {
            alert('Error de conexión al iniciar la interconsulta.');
        } finally {
            setIniciando(null);
        }
    };

    const pendientes = lista.filter((i) => i.estado === 'Pendiente').length;
    const activas = lista.filter((i) => i.estado === 'Activa').length;

    return (
        <div style={s.page}>
            <div style={s.header}>
                <div>
                    <p style={s.title}>Interconsultas en espera</p>
                    <p style={s.subtitle}>Pacientes derivados por medicina general para tu valoración</p>
                </div>
                <button onClick={fetchLista} style={s.refreshBtn}>↻ Actualizar</button>
            </div>

            <div style={s.statsRow}>
                <div style={s.statCard}><span style={s.statLabel}>Pendientes</span><span style={{ ...s.statValue, color: '#f6ad55' }}>{pendientes}</span></div>
                <div style={s.statCard}><span style={s.statLabel}>Activas (en revisión)</span><span style={{ ...s.statValue, color: '#00c8a0' }}>{activas}</span></div>
            </div>

            {cargando && <p style={s.muted}>Cargando interconsultas...</p>}
            {error && !cargando && <p style={s.errorText}>{error}</p>}

            {!cargando && !error && (
                lista.length === 0 ? (
                    <p style={s.muted}>No tienes interconsultas pendientes en este momento.</p>
                ) : (
                    <div style={s.cardsGrid}>
                        {lista.map((ic) => (
                            <div key={ic.id_interconsulta} style={s.card}>
                                <div style={s.cardTop}>
                                    <span style={s.pacienteName}>{ic.nombre} {ic.apellidos}</span>
                                    <span style={{ ...s.badge, ...(ic.estado === 'Activa' ? s.badgeActiva : s.badgePendiente) }}>
                                        {ic.estado === 'Activa' ? 'En revisión' : 'Pendiente'}
                                    </span>
                                </div>
                                <p style={s.detalle}>{ic.edad} años · {ic.sexo} · Sangre {ic.tipo_sangre || 'N/D'}</p>
                                {ic.alergias && <p style={s.alergia}>⚠ Alergias: {ic.alergias}</p>}
                                <div style={s.divider} />
                                <p style={s.label}>Médico emisor</p>
                                <p style={s.valor}>{ic.nombre_emisor}</p>
                                <p style={s.label}>Motivo de la derivación</p>
                                <p style={s.valor}>{ic.motivo_clinico}</p>
                                <p style={s.fecha}>Derivado el {formatearFecha(ic.created_at)}</p>
                                <button
                                    onClick={() => handleAtender(ic)}
                                    disabled={iniciando === ic.id_interconsulta}
                                    style={s.btnAtender}
                                >
                                    {iniciando === ic.id_interconsulta ? 'Abriendo...' : (ic.estado === 'Activa' ? 'Continuar revisión →' : 'Iniciar revisión →')}
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
    statsRow: { display: 'flex', gap: '12px', marginBottom: '20px' },
    statCard: { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px 18px', display: 'flex', flexDirection: 'column' as const, gap: '4px', minWidth: '160px' },
    statLabel: { fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.05em' },
    statValue: { fontSize: '24px', fontWeight: 700 },
    muted: { color: 'var(--text-faint)', fontSize: '13px', fontStyle: 'italic' },
    errorText: { color: 'var(--danger-text)', fontSize: '13px' },
    cardsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '14px' },
    card: { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '18px' },
    cardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' },
    pacienteName: { fontSize: '15px', fontWeight: 600 },
    badge: { fontSize: '11px', padding: '3px 10px', borderRadius: '20px', fontWeight: 500 },
    badgePendiente: { background: 'var(--warning-soft)', color: 'var(--warning)', border: '1px solid rgba(240,165,0,0.25)' },
    badgeActiva: { background: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid var(--accent-border)' },
    detalle: { fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0' },
    alergia: { fontSize: '12px', color: 'var(--danger-text)', margin: '4px 0' },
    divider: { height: '1px', background: 'var(--border)', margin: '10px 0' },
    label: { fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.04em', margin: '8px 0 2px' },
    valor: { fontSize: '13px', color: 'var(--text-primary)', margin: 0 },
    fecha: { fontSize: '11px', color: 'var(--text-faint)', margin: '10px 0 12px' },
    btnAtender: { width: '100%', background: 'var(--accent)', color: '#050e0b', border: 'none', borderRadius: '8px', padding: '10px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
};