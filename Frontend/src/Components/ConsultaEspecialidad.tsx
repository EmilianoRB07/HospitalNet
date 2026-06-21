import React, { useState, useEffect, useRef } from 'react';
import { jsPDF } from 'jspdf';
import { apiFetch } from '../api';
import { OrdenesPanel } from './OrdenesPanel';
import type { InterconsultaPendiente } from './Interconsultas';

// ─── Interfaces ───────────────────────────────────────────────────────────────
interface Paciente {
    id_paciente: string | number;
    nombre: string;
    edad?: number;
    genero?: string;
    expediente?: string;
}

interface NotasInterconsulta {
    id_interconsulta?: number;
    medico_emisor: string;
    motivo: string;
    notas_previas: string;
    fecha?: string;
    especialidad?: string;
}

// FIX RF-06: esta vista nunca pedía los signos vitales capturados por
// enfermería, a diferencia de ConsultaMedica.tsx que sí lo hacía.
interface SignosVitales {
    frecuencia_cardiaca: number;
    presion_arterial: string;
    temperatura: number;
    peso: number;
    estatura: number;
}

interface ConsultaEspecialidadProps {
    paciente: Paciente;
    // FIX CU-05: antes este componente no recibía nada de la interconsulta
    // real y se inventaba datos con un setTimeout. Si el especialista entró
    // desde la bandeja de Interconsultas, aquí llegan los datos reales.
    interconsulta?: InterconsultaPendiente | null;
    onVolver: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
// FIX RF-09: el sistema debe resaltar valores fuera de rango con DOS asteriscos
// "**" (fuertemente resaltado) y los limítrofes con UN asterisco "*" (ligero),
// tal como lo exige explícitamente el documento del proyecto. Antes solo se
// usaban colores e iconos (⚠/⚡), que se ven bien en pantalla pero no cumplen
// la convención tipográfica pedida si el texto se copia a notas o a la receta.
// Ahora se agregan ambas cosas: el estilo visual Y los asteriscos literales.
const procesarLaboratorios = (texto: string): string => {
    if (!texto.trim()) return '<span style="color:#4a5568;font-style:italic;">Ingrese resultados de laboratorio...</span>';

    return texto
        .replace(
            /(\d+(?:\.\d+)?)\s*(mg\/dL|g\/dL|mEq\/L|U\/L|%)\s*\((Alto|Bajo|Crítico)\)/gi,
            (match) => `<span style="background:#3d1a1a;color:#ff6b6b;padding:1px 6px;border-radius:4px;font-weight:600;">⚠ **${match}**</span>`
        )
        .replace(
            /(\d+(?:\.\d+)?)\s*(mg\/dL|g\/dL|mEq\/L|U\/L|%)\s*\((Limítrofe|Borderline)\)/gi,
            (match) => `<span style="background:#2d2208;color:#f6ad55;padding:1px 6px;border-radius:4px;font-weight:600;">⚡ *${match}*</span>`
        )
        .replace(/\n/g, '<br/>');
};

const formatearFecha = (fecha?: string) =>
    fecha
        ? new Date(fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })
        : new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });

// ─── Subcomponentes ───────────────────────────────────────────────────────────
const Badge: React.FC<{ texto: string; color?: string }> = ({ texto, color = '#00c8a0' }) => (
    <span style={{
        background: `${color}22`,
        color,
        border: `1px solid ${color}44`,
        borderRadius: '999px',
        padding: '2px 10px',
        fontSize: '11px',
        fontWeight: 600,
        letterSpacing: '0.03em',
    }}>
        {texto}
    </span>
);

const InfoRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '10px' }}>
        <span style={{ color: '#4a5568', fontSize: '12px', minWidth: '120px', paddingTop: '1px' }}>{label}</span>
        <span style={{ color: '#e2e8f0', fontSize: '13px', flex: 1 }}>{value}</span>
    </div>
);

const SectionCard: React.FC<{ title: string; icon?: string; children: React.ReactNode; style?: React.CSSProperties }> = ({
    title, icon, children, style
}) => (
    <div style={{
        background: '#111827',
        borderRadius: '14px',
        border: '1px solid #1e2a3a',
        overflow: 'hidden',
        ...style
    }}>
        <div style={{
            padding: '14px 20px',
            borderBottom: '1px solid #1e2a3a',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
        }}>
            {icon && <span style={{ fontSize: '15px' }}>{icon}</span>}
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                {title}
            </span>
        </div>
        <div style={{ padding: '20px' }}>{children}</div>
    </div>
);

const StyledTextarea: React.FC<{
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    rows?: number;
    monospace?: boolean;
}> = ({ value, onChange, placeholder, rows = 5, monospace }) => (
    <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        style={{
            width: '100%',
            background: '#0a0f17',
            color: '#e2e8f0',
            border: '1px solid #1e2a3a',
            padding: '12px 14px',
            borderRadius: '10px',
            fontSize: '13px',
            lineHeight: '1.6',
            resize: 'vertical',
            outline: 'none',
            fontFamily: monospace ? 'monospace' : 'inherit',
            boxSizing: 'border-box',
            transition: 'border-color 0.2s',
        }}
        onFocus={(e) => { e.currentTarget.style.borderColor = '#00c8a0'; }}
        onBlur={(e) => { e.currentTarget.style.borderColor = '#1e2a3a'; }}
    />
);

const StyledInput: React.FC<{
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
}> = ({ value, onChange, placeholder }) => (
    <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        placeholder={placeholder}
        style={{
            width: '100%',
            background: '#0a0f17',
            color: '#e2e8f0',
            border: '1px solid #1e2a3a',
            padding: '10px 14px',
            borderRadius: '10px',
            fontSize: '13px',
            letterSpacing: '2px',
            fontWeight: 600,
            outline: 'none',
            boxSizing: 'border-box',
            transition: 'border-color 0.2s',
        }}
        onFocus={(e) => { e.currentTarget.style.borderColor = '#00c8a0'; }}
        onBlur={(e) => { e.currentTarget.style.borderColor = '#1e2a3a'; }}
    />
);

// ─── Componente principal ─────────────────────────────────────────────────────
export const ConsultaEspecialidad: React.FC<ConsultaEspecialidadProps> = ({ paciente, interconsulta, onVolver }) => {
    const [cargando, setCargando] = useState(true);
    const [notasInterconsulta, setNotasInterconsulta] = useState<NotasInterconsulta | null>(null);
    const [signos, setSignos] = useState<SignosVitales | null>(null);
    const [laboratorios, setLaboratorios] = useState('');
    const [diagnostico, setDiagnostico] = useState('');
    // FIX: antes el CIE-10 estaba hardcodeado a 'I10' (Hipertensión esencial)
    // sin importar el diagnóstico real capturado por el especialista. Ahora es
    // un campo capturado en el formulario, igual que en ConsultaMedica.tsx.
    const [cie10, setCie10] = useState('');
    const [tratamiento, setTratamiento] = useState('');
    const [notas, setNotas] = useState('');
    const [guardando, setGuardando] = useState(false);
    const [guardado, setGuardado] = useState(false);
    const [dandoAlta, setDandoAlta] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        setGuardado(false);
        setError(null);
        setCargando(true);

        (async () => {
            const idMedicoActual = localStorage.getItem('id_medico');

            // RF-06: el backend ya exige id_medico y valida RN-02 (consulta o
            // interconsulta activa) antes de devolver nada, así que esto es
            // seguro de pedir aquí igual que en ConsultaMedica.tsx.
            try {
                const resSignos = await apiFetch(
                    `/clinica/signos?id_paciente=${paciente.id_paciente}&id_medico=${idMedicoActual}`
                );
                const dataSignos = await resSignos.json();
                if (dataSignos.success && dataSignos.signos_vitales
                    && Object.keys(dataSignos.signos_vitales).length > 0) {
                    setSignos(dataSignos.signos_vitales);
                } else {
                    setSignos(null);
                }
            } catch {
                setSignos(null);
            }

            // FIX CU-05: ya no se simula con setTimeout ni se deja un texto
            // fijo. Si venimos de la bandeja de interconsultas, se traen las
            // notas reales del médico general vía /clinica/historial — el
            // acceso ya está habilitado server-side por la interconsulta
            // activa (interconsulta-iniciar la dejó en estado 'Activa').
            if (interconsulta) {
                let notasPrevias = 'El médico general aún no tiene notas registradas para este paciente.';
                try {
                    const resHist = await apiFetch(
                        `/clinica/historial?id_paciente=${paciente.id_paciente}&id_medico=${idMedicoActual}`
                    );
                    const dataHist = await resHist.json();
                    if (dataHist.success && Array.isArray(dataHist.historial) && dataHist.historial.length > 0) {
                        notasPrevias = dataHist.historial
                            .map((h: { fecha: string; diagnostico: string; notas_evolucion: string }) =>
                                `${new Date(h.fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })} — Dx: ${h.diagnostico}\n${h.notas_evolucion}`
                            )
                            .join('\n\n');
                    } else if (!dataHist.success) {
                        notasPrevias = `No se pudo cargar el historial: ${dataHist.error ?? 'error desconocido'}.`;
                    }
                } catch {
                    notasPrevias = 'Error de conexión al cargar el historial del médico general.';
                }

                setNotasInterconsulta({
                    id_interconsulta: interconsulta.id_interconsulta,
                    medico_emisor: interconsulta.nombre_emisor,
                    motivo: interconsulta.motivo_clinico,
                    notas_previas: notasPrevias,
                    fecha: interconsulta.created_at,
                    especialidad: interconsulta.especialidad,
                });
            } else {
                setNotasInterconsulta(null);
            }

            setCargando(false);
        })();
    }, [paciente.id_paciente, interconsulta]);

    // Limpiar toast al desmontar
    useEffect(() => () => { if (toastRef.current) clearTimeout(toastRef.current); }, []);

    // FIX CU-05/RN-02: faltaba esta acción explícita. El acceso excepcional
    // del especialista a las notas del médico general debe revocarse "en el
    // momento en que el especialista registra el alta médica del paciente"
    // — un acto distinto a simplemente guardar una consulta (puede haber
    // varias revisiones antes del alta final).
    const darDeAlta = async () => {
        if (!notasInterconsulta?.id_interconsulta) return;
        if (!window.confirm('¿Dar de alta a este paciente? Se revocará tu acceso a las notas del médico general.')) return;
        setDandoAlta(true);
        try {
            const res = await apiFetch('/clinica/interconsulta-alta', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id_interconsulta: notasInterconsulta.id_interconsulta }),
            });
            const data = await res.json();
            if (data.success) {
                alert('✓ Paciente dado de alta. Acceso a las notas del médico general revocado.');
                onVolver();
            } else {
                alert('Error al dar de alta: ' + data.error);
            }
        } catch {
            alert('Error de conexión al dar de alta.');
        } finally {
            setDandoAlta(false);
        }
    };

    const handleGuardar = async () => {
        if (!diagnostico.trim() || !tratamiento.trim()) return;
        setGuardando(true);
        setError(null);

        try {
            const response = await apiFetch('/clinica/guardar-especialidad', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id_paciente: paciente.id_paciente,
                    id_medico: localStorage.getItem('id_medico'),
                    // FIX: se envía el CIE-10 real capturado por el especialista,
                    // ya no el valor fijo 'I10'.
                    cie10: cie10,
                    diagnostico_especializado: diagnostico,
                    tratamiento: tratamiento,
                    notas_evolucion: notas,
                    laboratorios_revisados: laboratorios
                }),
            });

            const result = await response.json();
            if (result.success) {
                setGuardado(true);
                toastRef.current = setTimeout(() => {
                    setGuardado(false);
                    onVolver(); // <--- Regresa a la agenda automáticamente al guardar
                }, 2000);
            } else {
                setError(result.error || 'Error al guardar');
            }
        } catch {
            setError('Error de conexión con el servidor.');
        } finally {
            setGuardando(false);
        }
    };
    const generarRecetaPDF = () => {
        const doc = new jsPDF();
        const fecha = formatearFecha();

        // FIX RF-07: la receta debe llevar el nombre de quien la EMITE: el
        // especialista con sesión activa ahora, NO el médico_emisor de la
        // interconsulta (ese es quien derivó al paciente, no quien prescribe
        // en esta consulta). Se usa lo guardado por Login.tsx; si por alguna
        // razón no existe, se cae de regreso al dato de la interconsulta para
        // no dejar el campo vacío.
        const nombreEspecialistaActual =
            localStorage.getItem('nombre_medico') || notasInterconsulta?.medico_emisor || '';
        const especialidadActual =
            localStorage.getItem('especialidad_medico') || notasInterconsulta?.especialidad || '';

        doc.setFontSize(16);
        doc.text('Receta Médica', 105, 20, { align: 'center' });

        doc.setFontSize(11);
        doc.text(`Paciente: ${paciente.nombre}`, 15, 40);
        doc.text(`Fecha: ${fecha}`, 15, 48);
        if (nombreEspecialistaActual) {
            doc.text(
                `Médico: ${nombreEspecialistaActual}${especialidadActual ? ` (${especialidadActual})` : ''}`,
                15, 56
            );
        }

        doc.setFontSize(12);
        doc.text('Diagnóstico:', 15, 72);
        doc.setFontSize(10);
        const textoDiagnostico = cie10.trim() ? `${diagnostico} (CIE-10: ${cie10})` : diagnostico;
        const diagLines = doc.splitTextToSize(textoDiagnostico, 180);
        doc.text(diagLines, 15, 80);

        const nextY = 80 + diagLines.length * 6 + 10;
        doc.setFontSize(12);
        doc.text('Tratamiento:', 15, nextY);
        doc.setFontSize(10);
        const tratLines = doc.splitTextToSize(tratamiento, 180);
        doc.text(tratLines, 15, nextY + 8);

        if (notas.trim()) {
            const noY = nextY + 8 + tratLines.length * 6 + 10;
            doc.setFontSize(12);
            doc.text('Notas adicionales:', 15, noY);
            doc.setFontSize(10);
            const notasLines = doc.splitTextToSize(notas, 180);
            doc.text(notasLines, 15, noY + 8);
        }

        doc.save(`receta_${paciente.nombre.replace(/\s+/g, '_')}_${Date.now()}.pdf`);
    };

    const formReady = !!(diagnostico.trim() && tratamiento.trim());

    // ─── Loading ──────────────────────────────────────────────────────────────
    if (cargando) {
        return (
            <div style={{
                minHeight: '100vh',
                background: '#080d12',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                gap: '16px',
                color: '#4a5568',
                fontFamily: 'sans-serif',
            }}>
                <div style={{
                    width: '36px', height: '36px',
                    border: '3px solid #1e2a3a',
                    borderTopColor: '#00c8a0',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                <span style={{ fontSize: '14px' }}>Cargando consulta…</span>
            </div>
        );
    }

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
        <div style={{
            fontFamily: "'Inter', 'Segoe UI', sans-serif",
            background: '#080d12',
            minHeight: '100vh',
            color: '#e2e8f0',
            padding: '24px',
        }}>

            {/* Toast de guardado */}
            {guardado && (
                <div style={{
                    position: 'fixed', top: '24px', right: '24px', zIndex: 999,
                    background: '#0d2b22', border: '1px solid #00c8a066',
                    color: '#00c8a0', padding: '12px 20px', borderRadius: '10px',
                    fontSize: '13px', fontWeight: 600,
                    boxShadow: '0 4px 24px #00000066',
                    display: 'flex', alignItems: 'center', gap: '8px',
                }}>
                    ✓ Consulta guardada correctamente
                </div>
            )}

            {/* Toast de error */}
            {error && (
                <div style={{
                    position: 'fixed', top: '24px', right: '24px', zIndex: 999,
                    background: '#2d1010', border: '1px solid #ff6b6b66',
                    color: '#ff6b6b', padding: '12px 20px', borderRadius: '10px',
                    fontSize: '13px', fontWeight: 600,
                    boxShadow: '0 4px 24px #00000066',
                    display: 'flex', alignItems: 'center', gap: '8px',
                }}>
                    ✕ {error}
                    <span
                        style={{ cursor: 'pointer', marginLeft: '8px', opacity: 0.7 }}
                        onClick={() => setError(null)}
                    >✕</span>
                </div>
            )}

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                <div>
                    <button
                        onClick={onVolver}
                        style={{
                            background: 'none', border: '1px solid #1e2a3a',
                            color: '#94a3b8', cursor: 'pointer',
                            padding: '7px 16px', borderRadius: '8px',
                            fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px',
                            marginBottom: '16px', transition: 'all 0.15s',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = '#00c8a0';
                            e.currentTarget.style.color = '#00c8a0';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = '#1e2a3a';
                            e.currentTarget.style.color = '#94a3b8';
                        }}
                    >
                        ← Volver
                    </button>
                    <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: '#f1f5f9' }}>
                        Consulta de Especialidad
                    </h1>
                    <p style={{ margin: '4px 0 0', color: '#4a5568', fontSize: '13px' }}>
                        {formatearFecha(notasInterconsulta?.fecha)}
                    </p>
                </div>

                {/* Info del paciente */}
                <div style={{
                    background: '#111827',
                    border: '1px solid #1e2a3a',
                    borderRadius: '12px',
                    padding: '14px 18px',
                    minWidth: '240px',
                    textAlign: 'right',
                }}>
                    <p style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: 700, color: '#f1f5f9' }}>
                        {paciente.nombre}
                    </p>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        {paciente.edad && <Badge texto={`${paciente.edad} años`} color="#64748b" />}
                        {notasInterconsulta?.especialidad && (
                            <Badge texto={notasInterconsulta.especialidad} color="#00c8a0" />
                        )}
                    </div>
                </div>
            </div>

            {/* Signos vitales (RF-06) — capturados por enfermería, igual
                criterio que ConsultaMedica.tsx */}
            <SectionCard title="Signos vitales" icon="❤️" style={{ marginBottom: '20px' }}>
                {signos ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px' }}>
                        <InfoRow label="Frec. cardíaca" value={`${signos.frecuencia_cardiaca} lpm`} />
                        <InfoRow label="Presión arterial" value={`${signos.presion_arterial} mmHg`} />
                        <InfoRow label="Temperatura" value={`${signos.temperatura} °C`} />
                        <InfoRow label="Peso" value={`${signos.peso} kg`} />
                        <InfoRow label="Estatura" value={`${signos.estatura} m`} />
                    </div>
                ) : (
                    <p style={{ color: '#4a5568', fontSize: '13px', margin: 0 }}>
                        Sin signos vitales registrados para este paciente.
                    </p>
                )}
            </SectionCard>

            {/* Layout principal */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>

                {/* Interconsulta */}
                <SectionCard title="Interconsulta" icon="📋">
                    {notasInterconsulta ? (
                        <>
                            <InfoRow label="Médico emisor" value={notasInterconsulta.medico_emisor} />
                            <InfoRow label="Motivo" value={notasInterconsulta.motivo} />
                            <div style={{ marginTop: '12px' }}>
                                <span style={{ fontSize: '12px', color: '#4a5568', display: 'block', marginBottom: '6px' }}>
                                    Notas previas
                                </span>
                                <div style={{
                                    background: '#0a0f17',
                                    border: '1px solid #1e2a3a',
                                    borderRadius: '8px',
                                    padding: '12px',
                                    fontSize: '13px',
                                    color: '#94a3b8',
                                    lineHeight: '1.6',
                                    whiteSpace: 'pre-line',
                                    maxHeight: '220px',
                                    overflowY: 'auto',
                                }}>
                                    {notasInterconsulta.notas_previas}
                                </div>
                            </div>
                        </>
                    ) : (
                        <p style={{ color: '#4a5568', fontSize: '13px' }}>Sin datos de interconsulta.</p>
                    )}
                </SectionCard>

                {/* Laboratorios */}
                <SectionCard title="Laboratorios" icon="🧪">
                    <p style={{ fontSize: '12px', color: '#4a5568', marginTop: 0, marginBottom: '10px' }}>
                        Etiqueta resultados anormales con{' '}
                        <code style={{ color: '#ff6b6b', fontSize: '11px' }}>(Alto)</code>,{' '}
                        <code style={{ color: '#ff6b6b', fontSize: '11px' }}>(Bajo)</code> o{' '}
                        <code style={{ color: '#f6ad55', fontSize: '11px' }}>(Limítrofe)</code>.
                        {' '}El sistema marcará automáticamente los críticos con{' '}
                        <code style={{ color: '#ff6b6b', fontSize: '11px' }}>**</code> y los limítrofes con{' '}
                        <code style={{ color: '#f6ad55', fontSize: '11px' }}>*</code>.
                    </p>
                    <StyledTextarea
                        value={laboratorios}
                        onChange={setLaboratorios}
                        placeholder={'Glucosa: 126 mg/dL (Alto)\nHemoglobina: 11.2 g/dL (Bajo)\nColesterol: 195 mg/dL (Limítrofe)'}
                        rows={5}
                        monospace
                    />
                    {laboratorios.trim() && (
                        <div style={{
                            marginTop: '12px',
                            background: '#0a0f17',
                            border: '1px solid #1e2a3a',
                            borderRadius: '8px',
                            padding: '12px',
                            fontSize: '13px',
                            lineHeight: '1.8',
                        }}
                            dangerouslySetInnerHTML={{ __html: procesarLaboratorios(laboratorios) }}
                        />
                    )}
                </SectionCard>
            </div>

            {/* Segunda fila */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                <SectionCard title="Diagnóstico" icon="🩺">
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                        <div style={{ flex: 1 }}>
                            <StyledInput
                                value={cie10}
                                onChange={(v) => { setCie10(v); setGuardado(false); }}
                                placeholder="CIE-10, ej. G43"
                            />
                        </div>
                    </div>
                    <StyledTextarea
                        value={diagnostico}
                        onChange={(v) => { setDiagnostico(v); setGuardado(false); }}
                        placeholder="Describe el diagnóstico del especialista..."
                        rows={4}
                    />
                </SectionCard>

                <SectionCard title="Tratamiento" icon="💊">
                    <StyledTextarea
                        value={tratamiento}
                        onChange={(v) => { setTratamiento(v); setGuardado(false); }}
                        placeholder="Indica el plan terapéutico a seguir..."
                        rows={5}
                    />
                </SectionCard>
            </div>

            {/* RF-08/RF-09: órdenes reales de laboratorio/imagenología con
                criticidad calculada por el backend contra rangos reales. */}
            <div style={{ marginBottom: '20px' }}>
                <OrdenesPanel idPaciente={paciente.id_paciente} idMedico={localStorage.getItem('id_medico') ?? ''} />
            </div>

            {/* Notas adicionales */}
            <SectionCard title="Notas adicionales" icon="📝" style={{ marginBottom: '20px' }}>
                <StyledTextarea
                    value={notas}
                    onChange={(v) => { setNotas(v); setGuardado(false); }}
                    placeholder="Observaciones, seguimiento, próxima cita..."
                    rows={3}
                />
            </SectionCard>

            {/* Acciones */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                {notasInterconsulta?.id_interconsulta && (
                    <button
                        onClick={darDeAlta}
                        disabled={dandoAlta}
                        style={{
                            padding: '12px 22px',
                            background: 'transparent',
                            color: '#f6ad55',
                            border: '1px solid rgba(246,173,85,0.4)',
                            borderRadius: '10px',
                            cursor: dandoAlta ? 'not-allowed' : 'pointer',
                            fontSize: '13px',
                            fontWeight: 600,
                        }}
                    >
                        {dandoAlta ? 'Procesando...' : '🏁 Dar de alta y cerrar interconsulta'}
                    </button>
                )}
                <button
                    onClick={generarRecetaPDF}
                    disabled={!formReady}
                    style={{
                        padding: '12px 22px',
                        background: formReady ? '#0f2d26' : '#111827',
                        color: formReady ? '#00c8a0' : '#2d3748',
                        border: `1px solid ${formReady ? '#00c8a044' : '#1e2a3a'}`,
                        borderRadius: '10px',
                        cursor: formReady ? 'pointer' : 'not-allowed',
                        fontSize: '13px',
                        fontWeight: 600,
                        transition: 'all 0.2s',
                        display: 'flex', alignItems: 'center', gap: '6px',
                    }}
                >
                    📄 Generar receta PDF
                </button>

                <button
                    onClick={handleGuardar}
                    disabled={!formReady || guardando}
                    style={{
                        padding: '12px 28px',
                        background: formReady && !guardando ? '#00c8a0' : '#0d2b22',
                        color: formReady && !guardando ? '#050d0a' : '#1a4a3a',
                        border: 'none',
                        borderRadius: '10px',
                        cursor: formReady && !guardando ? 'pointer' : 'not-allowed',
                        fontSize: '14px',
                        fontWeight: 700,
                        transition: 'all 0.2s',
                        minWidth: '160px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    }}
                >
                    {guardando ? (
                        <>
                            <span style={{
                                display: 'inline-block',
                                width: '14px', height: '14px',
                                border: '2px solid #1a4a3a',
                                borderTopColor: '#00c8a0',
                                borderRadius: '50%',
                                animation: 'spin 0.8s linear infinite',
                            }} />
                            Guardando…
                        </>
                    ) : (
                        '✓ Guardar consulta'
                    )}
                </button>
            </div>

            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                textarea::placeholder { color: #2d3748; }
            `}</style>
        </div>
    );
};