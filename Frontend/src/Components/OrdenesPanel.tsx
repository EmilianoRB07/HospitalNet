import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../api';

// RF-08 / RF-09: este panel reemplaza el textarea de texto libre donde el
// médico escribía a mano "Glucosa: 126 mg/dL (Alto)". Ahora las órdenes y
// resultados se guardan como datos reales en `ordenes_servicio` /
// `resultados_estudios`, y el backend calcula la criticidad comparando el
// valor contra el rango de referencia capturado junto con el resultado
// (no contra una lista fija de nombres de prueba). Se usa tanto en
// ConsultaMedica.tsx (médico general) como en ConsultaEspecialidad.tsx.

interface Orden {
    id_orden: number;
    tipo_estudio: string;
    nombre_prueba: string;
    prioridad: string;
    estado: string;
    fecha_solicitud: string;
    fecha_resultado: string | null;
    valor_numerico: number | null;
    unidad_medida: string | null;
    rango_min_referencia: number | null;
    rango_max_referencia: number | null;
    criticidad: '**' | '*' | 'Normal' | null;
}

interface OrdenesPanelProps {
    idPaciente: number | string;
    idMedico: number | string;
}

function badgeCriticidad(c: Orden['criticidad']): React.CSSProperties {
    if (c === '**') return { color: '#ff6b6b', fontWeight: 700 };
    if (c === '*') return { color: '#f6ad55', fontWeight: 700 };
    if (c === 'Normal') return { color: '#00c8a0', fontWeight: 600 };
    return { color: '#4a5568' };
}

export const OrdenesPanel: React.FC<OrdenesPanelProps> = ({ idPaciente, idMedico }) => {
    const [ordenes, setOrdenes] = useState<Orden[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState('');

    const [tipoEstudio, setTipoEstudio] = useState('Laboratorio');
    const [nombrePrueba, setNombrePrueba] = useState('');
    const [prioridad, setPrioridad] = useState('Media');
    const [justificacion, setJustificacion] = useState('');
    const [creando, setCreando] = useState(false);

    const [idCapturando, setIdCapturando] = useState<number | null>(null);
    const [valorCaptura, setValorCaptura] = useState('');
    const [unidadCaptura, setUnidadCaptura] = useState('');
    const [rangoMinCaptura, setRangoMinCaptura] = useState('');
    const [rangoMaxCaptura, setRangoMaxCaptura] = useState('');
    const [guardandoResultado, setGuardandoResultado] = useState(false);

    const fetchOrdenes = useCallback(async () => {
        setCargando(true);
        setError('');
        try {
            const res = await apiFetch(`/clinica/ordenes?id_paciente=${idPaciente}`);
            const data = await res.json();
            if (data.success) setOrdenes(data.ordenes);
            else setError(data.error ?? 'No se pudieron cargar las órdenes.');
        } catch {
            setError('Error de conexión al cargar las órdenes.');
        } finally {
            setCargando(false);
        }
    }, [idPaciente]);

    useEffect(() => { fetchOrdenes(); }, [fetchOrdenes]);

    const crearOrden = async () => {
        if (!nombrePrueba.trim()) return;
        setCreando(true);
        try {
            const res = await apiFetch('/clinica/orden', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id_paciente: idPaciente,
                    id_medico_emisor: idMedico,
                    tipo_estudio: tipoEstudio,
                    nombre_prueba: nombrePrueba.trim(),
                    prioridad,
                    justificacion: justificacion.trim() || null,
                }),
            });
            const data = await res.json();
            if (data.success) {
                setNombrePrueba(''); setJustificacion(''); setPrioridad('Media');
                fetchOrdenes();
            } else {
                alert('Error al generar la orden: ' + data.error);
            }
        } catch {
            alert('Error de conexión al generar la orden.');
        } finally {
            setCreando(false);
        }
    };

    const guardarResultado = async (idOrden: number) => {
        const valor = parseFloat(valorCaptura);
        const rmin = parseFloat(rangoMinCaptura);
        const rmax = parseFloat(rangoMaxCaptura);
        if (Number.isNaN(valor) || Number.isNaN(rmin) || Number.isNaN(rmax) || !unidadCaptura.trim()) {
            alert('Completa valor, unidad y el rango de referencia (mínimo y máximo) antes de guardar.');
            return;
        }
        setGuardandoResultado(true);
        try {
            const res = await apiFetch('/clinica/resultado', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id_orden: idOrden,
                    id_paciente: idPaciente,
                    valor_numerico: valor,
                    unidad_medida: unidadCaptura.trim(),
                    rango_min_referencia: rmin,
                    rango_max_referencia: rmax,
                    capturado_por: idMedico,
                }),
            });
            const data = await res.json();
            if (data.success) {
                setIdCapturando(null);
                setValorCaptura(''); setUnidadCaptura(''); setRangoMinCaptura(''); setRangoMaxCaptura('');
                fetchOrdenes();
            } else {
                alert('Error al guardar el resultado: ' + data.error);
            }
        } catch {
            alert('Error de conexión al guardar el resultado.');
        } finally {
            setGuardandoResultado(false);
        }
    };

    return (
        <div style={st.wrap}>
            <div style={st.headerRow}>
                <span style={st.title}>🧪 Órdenes de laboratorio / imagenología</span>
                <button onClick={fetchOrdenes} style={st.refreshBtn}>↻ Actualizar</button>
            </div>

            {/* Nueva orden */}
            <div style={st.formRow}>
                <select value={tipoEstudio} onChange={(e) => setTipoEstudio(e.target.value)} style={st.select}>
                    <option value="Laboratorio">Laboratorio</option>
                    <option value="Imagenología">Imagenología</option>
                </select>
                <input
                    type="text" value={nombrePrueba} onChange={(e) => setNombrePrueba(e.target.value)}
                    placeholder="Nombre de la prueba (ej. Glucosa)" style={{ ...st.input, flex: 1 }}
                />
                <select value={prioridad} onChange={(e) => setPrioridad(e.target.value)} style={st.select}>
                    <option value="Alta">Prioridad alta</option>
                    <option value="Media">Prioridad media</option>
                    <option value="Baja">Prioridad baja</option>
                </select>
            </div>
            <div style={st.formRow}>
                <input
                    type="text" value={justificacion} onChange={(e) => setJustificacion(e.target.value)}
                    placeholder="Justificación clínica (opcional)" style={{ ...st.input, flex: 1 }}
                />
                <button onClick={crearOrden} disabled={creando || !nombrePrueba.trim()} style={st.addBtn}>
                    {creando ? 'Generando...' : '+ Generar orden'}
                </button>
            </div>

            {cargando && <p style={st.muted}>Cargando órdenes...</p>}
            {error && !cargando && <p style={st.errorText}>{error}</p>}

            {!cargando && !error && (
                ordenes.length === 0 ? (
                    <p style={st.muted}>Sin órdenes registradas para este paciente.</p>
                ) : (
                    <table style={st.table}>
                        <thead>
                            <tr>
                                {['Estudio', 'Prioridad', 'Estado', 'Resultado', 'Criticidad', ''].map((h) => (
                                    <th key={h} style={st.th}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {ordenes.map((o) => (
                                <React.Fragment key={o.id_orden}>
                                    <tr>
                                        <td style={st.td}>
                                            <strong>{o.nombre_prueba}</strong>
                                            <div style={st.subtle}>{o.tipo_estudio}</div>
                                        </td>
                                        <td style={st.td}>{o.prioridad}</td>
                                        <td style={st.td}>{o.estado}</td>
                                        <td style={st.td}>
                                            {o.valor_numerico != null
                                                ? `${o.valor_numerico} ${o.unidad_medida ?? ''} (ref. ${o.rango_min_referencia}–${o.rango_max_referencia})`
                                                : '—'}
                                        </td>
                                        <td style={{ ...st.td, ...badgeCriticidad(o.criticidad) }}>
                                            {o.criticidad ?? '—'}
                                        </td>
                                        <td style={st.td}>
                                            {o.estado === 'Solicitada' && (
                                                idCapturando === o.id_orden ? (
                                                    <button onClick={() => setIdCapturando(null)} style={st.smallBtnMuted}>Cancelar</button>
                                                ) : (
                                                    <button onClick={() => setIdCapturando(o.id_orden)} style={st.smallBtn}>Capturar resultado</button>
                                                )
                                            )}
                                        </td>
                                    </tr>
                                    {idCapturando === o.id_orden && (
                                        <tr>
                                            <td colSpan={6} style={{ ...st.td, background: 'rgba(0,200,160,0.05)' }}>
                                                <div style={st.captureRow}>
                                                    <input type="number" placeholder="Valor" value={valorCaptura}
                                                        onChange={(e) => setValorCaptura(e.target.value)} style={st.inputSmall} />
                                                    <input type="text" placeholder="Unidad (mg/dL...)" value={unidadCaptura}
                                                        onChange={(e) => setUnidadCaptura(e.target.value)} style={st.inputSmall} />
                                                    <input type="number" placeholder="Rango mín." value={rangoMinCaptura}
                                                        onChange={(e) => setRangoMinCaptura(e.target.value)} style={st.inputSmall} />
                                                    <input type="number" placeholder="Rango máx." value={rangoMaxCaptura}
                                                        onChange={(e) => setRangoMaxCaptura(e.target.value)} style={st.inputSmall} />
                                                    <button onClick={() => guardarResultado(o.id_orden)} disabled={guardandoResultado} style={st.smallBtn}>
                                                        {guardandoResultado ? 'Guardando...' : 'Guardar resultado'}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                )
            )}
        </div>
    );
};

const st: Record<string, React.CSSProperties> = {
    wrap: { background: '#111827', border: '1px solid #1e2a3a', borderRadius: '14px', padding: '20px' },
    headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' },
    title: { fontSize: '13px', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.05em', textTransform: 'uppercase' as const },
    refreshBtn: { background: 'transparent', border: '1px solid #1e2a3a', color: '#94a3b8', borderRadius: '7px', padding: '5px 12px', fontSize: '12px', cursor: 'pointer' },
    formRow: { display: 'flex', gap: '8px', marginBottom: '10px' },
    input: { background: '#0a0f17', color: '#e2e8f0', border: '1px solid #1e2a3a', borderRadius: '8px', padding: '9px 12px', fontSize: '13px', outline: 'none', fontFamily: 'inherit' },
    select: { background: '#0a0f17', color: '#e2e8f0', border: '1px solid #1e2a3a', borderRadius: '8px', padding: '9px 10px', fontSize: '13px', outline: 'none', fontFamily: 'inherit' },
    addBtn: { background: '#00c8a0', color: '#050e0b', border: 'none', borderRadius: '8px', padding: '9px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' as const },
    muted: { color: '#4a5568', fontSize: '13px', fontStyle: 'italic', margin: '10px 0' },
    errorText: { color: '#ff6b6b', fontSize: '13px', margin: '10px 0' },
    table: { width: '100%', borderCollapse: 'collapse' as const, marginTop: '12px' },
    th: { textAlign: 'left' as const, fontSize: '11px', color: '#4a5568', textTransform: 'uppercase' as const, letterSpacing: '0.05em', padding: '8px 10px', borderBottom: '1px solid #1e2a3a' },
    td: { padding: '10px 10px', fontSize: '13px', color: '#e2e8f0', borderBottom: '1px solid #1e2a3a' },
    subtle: { fontSize: '11px', color: '#4a5568', marginTop: '2px' },
    smallBtn: { background: 'rgba(0,200,160,0.12)', color: '#00c8a0', border: '1px solid rgba(0,200,160,0.3)', borderRadius: '6px', padding: '5px 10px', fontSize: '12px', cursor: 'pointer' },
    smallBtnMuted: { background: 'transparent', color: '#94a3b8', border: '1px solid #1e2a3a', borderRadius: '6px', padding: '5px 10px', fontSize: '12px', cursor: 'pointer' },
    captureRow: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' as const },
    inputSmall: { background: '#0a0f17', color: '#e2e8f0', border: '1px solid #1e2a3a', borderRadius: '6px', padding: '7px 10px', fontSize: '12px', outline: 'none', width: '110px', fontFamily: 'inherit' },
};