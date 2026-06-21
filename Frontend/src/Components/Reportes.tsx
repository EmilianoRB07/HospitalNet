import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../api';

// RF-12: "El sistema debe generar reportes estadísticos y administrativos
// de productividad médica de forma separada por médico general y médico
// especialista." El botón en App.tsx solo mostraba un alert("próximamente");
// el endpoint /clinica/reportes ya hacía el cálculo real, solo faltaba esto.

interface FilaReporte {
    medico: string;
    especialidad: string;
    total_consultas: number;
    consultas_hoy: number;
    consultas_mes: number;
}

export const Reportes: React.FC = () => {
    const [reporte, setReporte] = useState<FilaReporte[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState('');
    const [filtro, setFiltro] = useState<'todos' | 'general' | 'especialista'>('todos');

    const fetchReporte = useCallback(async () => {
        setCargando(true);
        setError('');
        try {
            const res = await apiFetch('/clinica/reportes');
            const data = await res.json();
            if (data.success) setReporte(data.reporte);
            else setError(data.error ?? 'No se pudo generar el reporte.');
        } catch {
            setError('Error de conexión con el backend.');
        } finally {
            setCargando(false);
        }
    }, []);

    useEffect(() => { fetchReporte(); }, [fetchReporte]);

    // RF-12: segregado por médico general vs especialista.
    const filtrado = reporte.filter((r) => {
        if (filtro === 'todos') return true;
        if (filtro === 'general') return r.especialidad === 'Medicina General';
        return r.especialidad !== 'Medicina General';
    });

    const totalConsultas = filtrado.reduce((acc, r) => acc + Number(r.total_consultas), 0);
    const totalHoy = filtrado.reduce((acc, r) => acc + Number(r.consultas_hoy), 0);

    return (
        <div style={s.page}>
            <div style={s.header}>
                <div>
                    <p style={s.title}>Reportes de productividad</p>
                    <p style={s.subtitle}>Consultas registradas por médico, separadas por tipo (RF-12)</p>
                </div>
                <button onClick={fetchReporte} style={s.refreshBtn}>↻ Actualizar</button>
            </div>

            <div style={s.filtros}>
                {([
                    ['todos', 'Todos'],
                    ['general', 'Médicos generales'],
                    ['especialista', 'Especialistas'],
                ] as const).map(([val, label]) => (
                    <button
                        key={val}
                        onClick={() => setFiltro(val)}
                        style={filtro === val ? s.filtroActivo : s.filtroInactivo}
                    >
                        {label}
                    </button>
                ))}
            </div>

            <div style={s.statsRow}>
                <div style={s.statCard}><span style={s.statLabel}>Consultas totales</span><span style={s.statValue}>{totalConsultas}</span></div>
                <div style={s.statCard}><span style={s.statLabel}>Consultas hoy</span><span style={{ ...s.statValue, color: 'var(--accent)' }}>{totalHoy}</span></div>
                <div style={s.statCard}><span style={s.statLabel}>Médicos en el reporte</span><span style={s.statValue}>{filtrado.length}</span></div>
            </div>

            {cargando && <p style={s.muted}>Generando reporte...</p>}
            {error && !cargando && <p style={s.errorText}>{error}</p>}

            {!cargando && !error && (
                filtrado.length === 0 ? (
                    <p style={s.muted}>Sin datos para este filtro.</p>
                ) : (
                    <div style={s.tableCard}>
                        <table style={s.table}>
                            <thead>
                                <tr>
                                    {['Médico', 'Especialidad', 'Consultas hoy', 'Consultas del mes', 'Total histórico'].map((h) => (
                                        <th key={h} style={s.th}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filtrado
                                    .slice()
                                    .sort((a, b) => b.total_consultas - a.total_consultas)
                                    .map((r, i) => (
                                        <tr key={i}>
                                            <td style={{ ...s.td, fontWeight: 500 }}>{r.medico}</td>
                                            <td style={s.td}>{r.especialidad}</td>
                                            <td style={s.td}>{r.consultas_hoy}</td>
                                            <td style={s.td}>{r.consultas_mes}</td>
                                            <td style={s.td}>{r.total_consultas}</td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
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
    filtros: { display: 'flex', gap: '8px', marginBottom: '18px' },
    filtroActivo: { background: 'var(--accent)', color: '#050e0b', border: 'none', borderRadius: '20px', padding: '6px 16px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
    filtroInactivo: { background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: '20px', padding: '6px 16px', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' },
    statsRow: { display: 'flex', gap: '12px', marginBottom: '20px' },
    statCard: { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px 18px', display: 'flex', flexDirection: 'column' as const, gap: '4px', minWidth: '160px' },
    statLabel: { fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.05em' },
    statValue: { fontSize: '24px', fontWeight: 700 },
    muted: { color: 'var(--text-faint)', fontSize: '13px', fontStyle: 'italic' },
    errorText: { color: 'var(--danger-text)', fontSize: '13px' },
    tableCard: { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' },
    table: { width: '100%', borderCollapse: 'collapse' as const },
    th: { padding: '12px 16px', fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)', textAlign: 'left' as const, letterSpacing: '0.06em', textTransform: 'uppercase' as const, background: 'var(--accent-soft)', borderBottom: '1px solid var(--border)' },
    td: { padding: '12px 16px', fontSize: '13px', color: 'var(--text-secondary)', borderTop: '1px solid var(--border)' },
};