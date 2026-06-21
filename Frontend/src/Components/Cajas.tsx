import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../api';

// Antes la única forma de que una cita quedara "Pagada" era editando la BD
// a mano. Esta pantalla conecta /clinica/cargos-pendientes y
// /clinica/cargo-pagar (que ya existían en el backend sin frontend) para
// que recepción pueda cobrar de verdad y el flujo de RN-03 sea real.

interface Cargo {
    id_cargo: number;
    concepto: string;
    monto: number;
    tipo_medico: string;
    estado: string;
    creado_en: string;
    paciente: string;
}

function formatearFecha(iso: string): string {
    return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export const Cajas: React.FC = () => {
    const [cargos, setCargos] = useState<Cargo[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState('');
    const [pagando, setPagando] = useState<number | null>(null);

    const fetchCargos = useCallback(async () => {
        setCargando(true);
        setError('');
        try {
            const res = await apiFetch('/clinica/cargos-pendientes');
            const data = await res.json();
            if (data.success) setCargos(data.cargos);
            else setError(data.error ?? 'No se pudieron cargar los cobros pendientes.');
        } catch {
            setError('Error de conexión con el backend.');
        } finally {
            setCargando(false);
        }
    }, []);

    useEffect(() => { fetchCargos(); }, [fetchCargos]);

    const marcarPagado = async (idCargo: number) => {
        setPagando(idCargo);
        try {
            const res = await apiFetch(`/clinica/cargo-pagar/${idCargo}`, { method: 'POST' });
            const data = await res.json();
            if (data.success) fetchCargos();
            else alert('Error al registrar el pago: ' + data.error);
        } catch {
            alert('Error de conexión al registrar el pago.');
        } finally {
            setPagando(null);
        }
    };

    const totalPendiente = cargos.reduce((acc, c) => acc + Number(c.monto), 0);

    return (
        <div style={s.page}>
            <div style={s.header}>
                <div>
                    <p style={s.title}>Cajas — cobros pendientes</p>
                    <p style={s.subtitle}>Confirma el pago antes de que el médico pueda iniciar la consulta (RN-03)</p>
                </div>
                <button onClick={fetchCargos} style={s.refreshBtn}>↻ Actualizar</button>
            </div>

            <div style={s.statsRow}>
                <div style={s.statCard}>
                    <span style={s.statLabel}>Cobros pendientes</span>
                    <span style={s.statValue}>{cargos.length}</span>
                </div>
                <div style={s.statCard}>
                    <span style={s.statLabel}>Monto total pendiente</span>
                    <span style={{ ...s.statValue, color: 'var(--warning)' }}>${totalPendiente.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                </div>
            </div>

            {cargando && <p style={s.muted}>Cargando cobros pendientes...</p>}
            {error && !cargando && <p style={s.errorText}>{error}</p>}

            {!cargando && !error && (
                cargos.length === 0 ? (
                    <p style={s.muted}>No hay cobros pendientes en este momento.</p>
                ) : (
                    <div style={s.tableCard}>
                        <table style={s.table}>
                            <thead>
                                <tr>
                                    {['Paciente', 'Concepto', 'Tipo', 'Monto', 'Fecha', ''].map((h) => (
                                        <th key={h} style={s.th}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {cargos.map((c) => (
                                    <tr key={c.id_cargo}>
                                        <td style={{ ...s.td, fontWeight: 500 }}>{c.paciente}</td>
                                        <td style={s.td}>{c.concepto}</td>
                                        <td style={s.td}>{c.tipo_medico}</td>
                                        <td style={s.td}>${Number(c.monto).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                                        <td style={s.td}>{formatearFecha(c.creado_en)}</td>
                                        <td style={s.td}>
                                            <button
                                                onClick={() => marcarPagado(c.id_cargo)}
                                                disabled={pagando === c.id_cargo}
                                                style={s.btnPagar}
                                            >
                                                {pagando === c.id_cargo ? 'Procesando...' : 'Marcar pagado'}
                                            </button>
                                        </td>
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
    statsRow: { display: 'flex', gap: '12px', marginBottom: '20px' },
    statCard: { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px 18px', display: 'flex', flexDirection: 'column' as const, gap: '4px', minWidth: '180px' },
    statLabel: { fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.05em' },
    statValue: { fontSize: '24px', fontWeight: 700 },
    muted: { color: 'var(--text-faint)', fontSize: '13px', fontStyle: 'italic' },
    errorText: { color: 'var(--danger-text)', fontSize: '13px' },
    tableCard: { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' },
    table: { width: '100%', borderCollapse: 'collapse' as const },
    th: { padding: '12px 16px', fontSize: '11px', fontWeight: 500, color: 'var(--text-muted)', textAlign: 'left' as const, letterSpacing: '0.06em', textTransform: 'uppercase' as const, background: 'var(--accent-soft)', borderBottom: '1px solid var(--border)' },
    td: { padding: '12px 16px', fontSize: '13px', color: 'var(--text-secondary)', borderTop: '1px solid var(--border)' },
    btnPagar: { background: 'var(--accent)', color: '#050e0b', border: 'none', borderRadius: '7px', padding: '7px 14px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
};