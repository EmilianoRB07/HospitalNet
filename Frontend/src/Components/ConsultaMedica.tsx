import React, { useState, useEffect } from 'react';
import { apiFetch } from '../api';
import { OrdenesPanel } from './OrdenesPanel';


// ─── Tipos ─────────────────────────────────────────────────────────────────────

interface SignosVitales {
    id_signos_vitales: number;
    frecuencia_cardiaca: number;
    presion_arterial: string;
    temperatura: number;
    peso: number;
    estatura: number;
    imc: number;
}

interface Paciente {
    id_paciente: number;
    nombre: string;
    apellidos: string;
    edad: number;
    sexo: string;
    tipo_sangre: string;
    telefono: string;
    alergias: string;
    medico_asignado: string;
}

interface ConsultaHistorial {
    fecha: string;
    diagnostico: string;
    medicamento: string;
}

interface ConsultaMedicaProps {
    paciente: Paciente;
    historial: ConsultaHistorial[];
    onVolver: () => void;
}

// ─── Helpers clínicos ──────────────────────────────────────────────────────────

function evaluarFC(fc: number): { label: string; clase: 'ok' | 'warn' | 'alert' } {
    if (fc < 60) return { label: 'Bradicardia', clase: 'alert' };
    if (fc <= 100) return { label: 'Normal', clase: 'ok' };
    return { label: 'Taquicardia', clase: 'alert' };
}

function evaluarTemp(t: number): { label: string; clase: 'ok' | 'warn' | 'alert' } {
    if (t < 36.0) return { label: 'Hipotermia', clase: 'alert' };
    if (t <= 37.2) return { label: 'Normal', clase: 'ok' };
    if (t <= 38.0) return { label: 'Febrícula', clase: 'warn' };
    return { label: 'Fiebre', clase: 'alert' };
}

function evaluarIMC(imc: number): { label: string; clase: 'ok' | 'warn' | 'alert'; pct: number } {
    if (imc < 18.5) return { label: 'Bajo peso', clase: 'warn', pct: 15 };
    if (imc < 25.0) return { label: 'Peso normal', clase: 'ok', pct: 38 };
    if (imc < 30.0) return { label: 'Sobrepeso', clase: 'warn', pct: 62 };
    return { label: 'Obesidad', clase: 'alert', pct: 85 };
}

function evaluarPA(pa: string): { label: string; clase: 'ok' | 'warn' | 'alert' } {
    const sistolica = parseInt(pa.split('/')[0] ?? '0', 10);
    if (sistolica < 90) return { label: 'Hipotensión', clase: 'alert' };
    if (sistolica <= 120) return { label: 'Normal', clase: 'ok' };
    if (sistolica <= 139) return { label: 'Elevada', clase: 'warn' };
    return { label: 'Hipertensión', clase: 'alert' };
}

function formatearFecha(iso: string): string {
    return new Date(iso).toLocaleDateString('es-MX', {
        day: '2-digit', month: 'long', year: 'numeric',
    });
}

function iniciales(nombre: string, apellidos: string): string {
    return `${nombre.charAt(0)}${apellidos.charAt(0)}`.toUpperCase();
}

// ─── Subcomponente: tarjeta de signo vital ─────────────────────────────────────

interface VitalCardProps {
    label: string;
    valor: string;
    unidad: string;
    estado: { label: string; clase: 'ok' | 'warn' | 'alert' };
}

const badgeClases: Record<string, React.CSSProperties> = {
    ok: { background: 'rgba(0,200,160,0.12)', color: '#00c8a0', border: '1px solid rgba(0,200,160,0.2)' },
    warn: { background: 'rgba(240,165,0,0.12)', color: '#f0a500', border: '1px solid rgba(240,165,0,0.2)' },
    alert: { background: 'rgba(224,92,92,0.12)', color: '#e05c5c', border: '1px solid rgba(224,92,92,0.2)' },
};

const VitalCard: React.FC<VitalCardProps> = ({ label, valor, unidad, estado }) => (
    <div style={s.vitalCard}>
        <p style={s.vitalLabel}>{label}</p>
        <div style={s.vitalValRow}>
            <span style={s.vitalVal}>{valor}</span>
            <span style={s.vitalUnit}>{unidad}</span>
        </div>
        <span style={{ ...s.badge, ...badgeClases[estado.clase] }}>{estado.label}</span>
    </div>
);

// ─── Componente principal ──────────────────────────────────────────────────────

export const ConsultaMedica: React.FC<ConsultaMedicaProps> = ({ paciente, historial, onVolver }) => {
    const [signos, setSignos] = useState<SignosVitales | null>(null);
    const [cargando, setCargando] = useState<boolean>(true);
    const [error, setError] = useState<string>('');

    const [diagnostico, setDiagnostico] = useState<string>('');
    const [cie10, setCie10] = useState<string>('');
    const [notas, setNotas] = useState<string>('');
    const [receta, setReceta] = useState<string>('');

    const [guardando, setGuardando] = useState<boolean>(false);
    const [guardado, setGuardado] = useState<boolean>(false);
    const [historialDinamico, setHistorialDinamico] = useState<ConsultaHistorial[]>(historial);
    const [showModal, setShowModal] = useState(false);
    const [motivo, setMotivo] = useState('');
    const [especialidad, setEspecialidad] = useState('');
    const [medicosReceptor, setMedicosReceptor] = useState<{ id_medico: number; nombre: string }[]>([]);
    const [idMedicoReceptor, setIdMedicoReceptor] = useState<string>('');
    const [cargandoMedicos, setCargandoMedicos] = useState<boolean>(false);

    const [focusedField, setFocusedField] = useState<string>('');

    useEffect(() => {
        const fetchDatosClinicos = async (): Promise<void> => {
            setCargando(true);
            setError('');
            try {
                const idMedicoActual = localStorage.getItem('id_medico');
                const resSignos = await apiFetch(
                    `/clinica/signos?id_paciente=${paciente.id_paciente}&id_medico=${idMedicoActual}`
                );

                const dataSignos = await resSignos.json();
                if (dataSignos.success && dataSignos.signos_vitales) {
                    const sv = dataSignos.signos_vitales;
                    const imcCalculado = sv.peso / (sv.estatura * sv.estatura);
                    setSignos({
                        ...sv,
                        imc: imcCalculado
                    });
                }
                
                const resHistorial = await apiFetch(
                    `/clinica/historial?id_paciente=${paciente.id_paciente}&id_medico=${idMedicoActual}`
                );
                const dataHistorial = await resHistorial.json();
                if (dataHistorial.success) setHistorialDinamico(dataHistorial.historial);
            } catch {
                setError('Error de conexión con el servidor. Verifica que el backend esté activo.');
            } finally {
                setCargando(false);
            }
        };

        fetchDatosClinicos();
    }, [paciente.id_paciente]);

    // ─── Generación de receta en PDF (RT-05: servidor) ──────────────────────────

    const generarRecetaPDF = async () => {
        try {
            const response = await apiFetch(`/clinica/receta/${paciente.id_paciente}`, {
                method: 'GET',
            });

            if (!response.ok) {
                const error = await response.json();
                alert(`Error al generar la receta: ${error.error || error.detail || 'Error desconocido'}`);
                return;
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Receta_${paciente.nombre}_${paciente.apellidos}_${new Date().toISOString().split('T')[0]}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

        } catch (error) {
            console.error('Error descargando receta:', error);
            alert('Error de conexión al generar la receta. Verifica que el backend esté activo.');
        }
    };

    // ─── Guardar consulta ──────────────────────────────────────────────────────────

    const handleGuardar = async (): Promise<void> => {
        if (!notas.trim() || !diagnostico.trim() || !cie10.trim() || !receta.trim()) {
            alert('Por favor rellena el Diagnóstico, el código CIE-10, el Tratamiento y las Notas antes de finalizar.');
            return;
        }
        setGuardando(true);
        try {
            const idMedico = localStorage.getItem('id_medico');
            
            const response = await apiFetch('/clinica/guardar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id_paciente: paciente.id_paciente,
                    id_medico: idMedico ? parseInt(idMedico, 10) : null,
                    diagnostico,
                    cie10,
                    notas_evolucion: notas,
                    receta_medica: receta,
                }),
            });
            
            const data = await response.json();
            if (data.success) {
                setGuardado(true);
                await generarRecetaPDF();
                alert('✓ Consulta guardada. Se descargará la receta en PDF.');
            } else {
                alert('Error al guardar: ' + data.error);
            }
        } catch (error) {
            console.error('Error guardando consulta:', error);
            alert('Error de conexión al guardar la consulta.');
        } finally {
            setGuardando(false);
        }
    };

    // ─── Enviar interconsulta ─────────────────────────────────────────────────────

    const handleEspecialidadChange = async (valor: string): Promise<void> => {
        setEspecialidad(valor);
        setIdMedicoReceptor('');
        setMedicosReceptor([]);
        if (!valor) return;

        setCargandoMedicos(true);
        try {
            const res = await apiFetch(
                `/clinica/medicos-por-especialidad?especialidad=${encodeURIComponent(valor)}`
            );
            const data = await res.json();
            if (data.success) setMedicosReceptor(data.medicos);
        } catch {
            // si falla, la lista queda vacía
        } finally {
            setCargandoMedicos(false);
        }
    };

    const enviarInterconsulta = async () => {
        const idMedicoActual = localStorage.getItem('id_medico');

        if (!idMedicoActual || !idMedicoReceptor) {
            alert('Selecciona la especialidad y el médico receptor antes de enviar la interconsulta.');
            return;
        }

        const response = await apiFetch('/clinica/interconsulta', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id_paciente: paciente.id_paciente,
                id_medico_emisor: parseInt(idMedicoActual, 10),
                id_medico_receptor: parseInt(idMedicoReceptor, 10),
                motivo_clinico: motivo,
                especialidad: especialidad,
            }),
        });

        const data = await response.json();
        if (!data.success) {
            console.error('Error al enviar interconsulta:', data.error);
            alert('No se pudo enviar la interconsulta: ' + (data.error ?? 'Error desconocido.'));
            return;
        }
        setShowModal(false);
        setMotivo('');
        setEspecialidad('');
        setIdMedicoReceptor('');
        alert('✓ Interconsulta enviada correctamente.');
    };

    const evalFC = signos ? evaluarFC(signos.frecuencia_cardiaca) : null;
    const evalTemp = signos ? evaluarTemp(signos.temperatura) : null;
    const evalPA = signos ? evaluarPA(signos.presion_arterial) : null;
    const evalIMC = signos ? evaluarIMC(signos.imc) : null;

    const formReady: boolean = !!(notas.trim() && diagnostico.trim() && cie10.trim() && receta.trim());

    return (
        <div style={s.page}>

            {/* Barra superior */}
            <div style={s.topbar}>
                <button onClick={onVolver} style={s.backBtn} aria-label="Volver a la agenda">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="19" y1="12" x2="5" y2="12" />
                        <polyline points="12 19 5 12 12 5" />
                    </svg>
                    Volver a agenda
                </button>
                <div style={s.topbarCenter}>
                    <div style={s.logoMark}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                            stroke="#00c8a0" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                        </svg>
                    </div>
                    <span style={s.topbarLabel}>Consulta médica activa</span>
                </div>
                <div style={s.topbarRight} />
            </div>

            <div style={s.grid}>

                {/* ── Columna izquierda ──────────────────────────────────────────────── */}
                <div style={s.col}>

                    {/* Datos del paciente */}
                    <div style={s.card}>
                        <div style={s.cardHeader}>
                            <div style={s.avatar}>
                                {iniciales(paciente.nombre, paciente.apellidos)}
                            </div>
                            <div>
                                <p style={s.ptName}>{paciente.nombre} {paciente.apellidos}</p>
                                <p style={s.ptSub}>Paciente #{paciente.id_paciente} · {paciente.sexo}</p>
                            </div>
                        </div>
                        <div style={s.divider} />
                        {[
                            { label: 'Edad', val: `${paciente.edad} años`, icon: 'ti-cake' },
                            { label: 'Tipo de sangre', val: paciente.tipo_sangre, icon: 'ti-droplet' },
                            { label: 'Teléfono', val: paciente.telefono, icon: 'ti-phone' },
                            { label: 'Médico', val: paciente.medico_asignado, icon: 'ti-stethoscope' },
                        ].map(({ label, val, icon }) => (
                            <div key={label} style={s.infoRow}>
                                <span style={s.infoLabel}>
                                    <i className={`ti ${icon}`} style={{ fontSize: '14px', marginRight: '6px', opacity: 0.6 }} aria-hidden="true" />
                                    {label}
                                </span>
                                <span style={s.infoVal}>{val}</span>
                            </div>
                        ))}
                        <div style={{ ...s.infoRow, borderBottom: 'none' }}>
                            <span style={s.infoLabel}>
                                <i className="ti ti-alert-triangle" style={{ fontSize: '14px', marginRight: '6px', opacity: 0.6 }} aria-hidden="true" />
                                Alergias
                            </span>
                            <span style={{ ...s.infoVal, color: '#e05c5c' }}>{paciente.alergias}</span>
                        </div>
                    </div>

                    {/* Historial de consultas */}
                    <div style={s.card}>
                        <p style={s.secTitle}>
                            <i className="ti ti-history" style={{ fontSize: '15px', marginRight: '6px', color: '#00c8a0' }} aria-hidden="true" />
                            Historial reciente
                        </p>
                        {historialDinamico.length === 0 ? (
                            <p style={s.emptyMsg}>Sin consultas previas registradas.</p>
                        ) : (
                            historialDinamico.map((c, i) => (
                                <div key={i} style={{ ...s.histItem, ...(i === historialDinamico.length - 1 ? { borderBottom: 'none' } : {}) }}>
                                    <p style={s.histFecha}>{formatearFecha(c.fecha)}</p>
                                    <p style={s.histDiag}>{c.diagnostico}</p>
                                    <p style={s.histMed}>{c.medicamento}</p>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* ── Columna derecha ────────────────────────────────────────────────── */}
                <div style={s.col}>

                    {/* Signos vitales */}
                    <div style={s.card}>
                        <p style={s.secTitle}>
                            <i className="ti ti-heart-rate-monitor" style={{ fontSize: '15px', marginRight: '6px', color: '#e05c5c' }} aria-hidden="true" />
                            Signos vitales · Última medición
                        </p>

                        {cargando && (
                            <div style={s.stateRow}>
                                <div style={s.spinner} />
                                Cargando signos vitales...
                            </div>
                        )}

                        {error && !cargando && (
                            <div style={s.errorAlert} role="alert">
                                <span style={s.errorDot} />
                                {error}
                            </div>
                        )}

                        {signos && !cargando && evalFC && evalTemp && evalPA && evalIMC && (
                            <>
                                <div style={s.vitalsGrid}>
                                    <VitalCard label="Frecuencia cardíaca" valor={String(signos.frecuencia_cardiaca)} unidad="lpm" estado={evalFC} />
                                    <VitalCard label="Presión arterial" valor={signos.presion_arterial} unidad="mmHg" estado={evalPA} />
                                    <VitalCard label="Temperatura" valor={signos.temperatura.toFixed(1)} unidad="°C" estado={evalTemp} />
                                    <VitalCard
                                        label="Peso / Estatura"
                                        valor={`${signos.peso}`}
                                        unidad={`kg · ${signos.estatura} m`}
                                        estado={{ label: 'Registrado', clase: 'ok' }}
                                    />
                                </div>

                                {/* IMC */}
                                <div style={s.imcCard}>
                                    <div style={s.imcRow}>
                                        <div>
                                            <p style={s.vitalLabel}>Índice de masa corporal (IMC)</p>
                                            <div style={s.vitalValRow}>
                                                <span style={s.vitalVal}>{signos?.imc ? signos.imc.toFixed(1) : '0.0'}</span>
                                                <span style={s.vitalUnit}>kg/m²</span>
                                            </div>
                                        </div>
                                        <span style={{ ...s.badge, ...badgeClases[evalIMC.clase] }}>{evalIMC.label}</span>
                                    </div>
                                    <div style={s.imcBarBg}>
                                        <div style={{ ...s.imcBarFill, width: `${evalIMC.pct}%` }} />
                                    </div>
                                    <div style={s.imcBarLabels}>
                                        <span>Bajo peso</span><span>Normal</span><span>Sobrepeso</span><span>Obesidad</span>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Registro clínico y receta */}
                    <div style={s.card}>
                        <p style={s.secTitle}>
                            <i className="ti ti-notes-medical" style={{ fontSize: '15px', marginRight: '6px', color: '#00c8a0' }} aria-hidden="true" />
                            Registro clínico y receta médica
                        </p>

                        <div style={{ display: 'flex', gap: '12px', marginBottom: '14px' }}>
                            <div style={{ flex: 2 }}>
                                <label style={s.inputLabel} htmlFor="diag">Diagnóstico clínico</label>
                                <div style={s.inputWrapper}>
                                    <i className="ti ti-clipboard-text" style={s.inputIconStyle} aria-hidden="true" />
                                    <input
                                        id="diag"
                                        type="text"
                                        value={diagnostico}
                                        onChange={(e) => setDiagnostico(e.target.value)}
                                        onFocus={() => setFocusedField('diag')}
                                        onBlur={() => setFocusedField('')}
                                        placeholder="Ej. Rinofaringitis aguda"
                                        style={{
                                            ...s.input,
                                            ...(focusedField === 'diag' ? s.inputFocused : {}),
                                        }}
                                    />
                                </div>
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={s.inputLabel} htmlFor="cie10">Código CIE-10</label>
                                <div style={s.inputWrapper}>
                                    <i className="ti ti-hash" style={s.inputIconStyle} aria-hidden="true" />
                                    <input
                                        id="cie10"
                                        type="text"
                                        value={cie10}
                                        onChange={(e) => setCie10(e.target.value.toUpperCase())}
                                        onFocus={() => setFocusedField('cie10')}
                                        onBlur={() => setFocusedField('')}
                                        placeholder="Ej. J00"
                                        style={{
                                            ...s.input,
                                            ...(focusedField === 'cie10' ? s.inputFocused : {}),
                                            letterSpacing: '2px',
                                            fontWeight: 600,
                                        }}
                                    />
                                </div>
                            </div>
                        </div>

                        <label style={s.inputLabel} htmlFor="notas">Notas de evolución / Síntomas</label>
                        <textarea
                            id="notas"
                            value={notas}
                            onChange={(e) => setNotas(e.target.value)}
                            onFocus={() => setFocusedField('notas')}
                            onBlur={() => setFocusedField('')}
                            placeholder="Escribe aquí la exploración física, síntomas y observaciones..."
                            rows={4}
                            style={{
                                ...s.textarea,
                                ...(focusedField === 'notas' ? s.inputFocused : {}),
                                marginBottom: '14px',
                            }}
                        />

                        <label style={s.inputLabel} htmlFor="receta">Tratamiento / Receta médica</label>
                        <textarea
                            id="receta"
                            value={receta}
                            onChange={(e) => setReceta(e.target.value)}
                            onFocus={() => setFocusedField('receta')}
                            onBlur={() => setFocusedField('')}
                            placeholder="Medicamentos, dosis y duración del tratamiento..."
                            rows={4}
                            style={{
                                ...s.textarea,
                                ...(focusedField === 'receta' ? s.inputFocused : {}),
                                marginBottom: '18px',
                            }}
                        />

                        <button
                            onClick={handleGuardar}
                            disabled={guardando || !formReady}
                            style={{
                                ...s.submitBtn,
                                ...(guardando || !formReady ? s.submitBtnDisabled : {}),
                                ...(guardado ? { background: 'rgba(0,200,160,0.15)', color: '#00c8a0', border: '1px solid rgba(0,200,160,0.3)' } : {}),
                            }}
                        >
                            {guardando ? (
                                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                                    <span style={s.spinner} />
                                    Guardando en base de datos...
                                </span>
                            ) : guardado ? (
                                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                    <i className="ti ti-circle-check" style={{ fontSize: '16px' }} aria-hidden="true" />
                                    Consulta finalizada con éxito
                                </span>
                            ) : (
                                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                    <i className="ti ti-device-floppy" style={{ fontSize: '16px' }} aria-hidden="true" />
                                    Finalizar consulta y guardar registro
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                                        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="5" y1="12" x2="19" y2="12" />
                                        <polyline points="12 5 19 12 12 19" />
                                    </svg>
                                </span>
                            )}
                        </button>

                        {/* Botón para descargar receta sin guardar */}
                        <button
                            type="button"
                            onClick={generarRecetaPDF}
                            style={{
                                ...s.submitBtn,
                                marginTop: '10px',
                                background: 'rgba(0,200,160,0.15)',
                                color: '#00c8a0',
                                border: '1px solid rgba(0,200,160,0.3)'
                            }}
                        >
                            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                <i className="ti ti-file-pdf" style={{ fontSize: '16px' }} aria-hidden="true" />
                                Descargar Receta PDF
                            </span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setShowModal(true)}
                            style={{ ...s.submitBtn, marginTop: '10px', background: '#666' }}
                        >
                            Generar Interconsulta
                        </button>
                    </div>

                    <OrdenesPanel idPaciente={paciente.id_paciente} idMedico={localStorage.getItem('id_medico') ?? ''} />
                </div>
            </div>

            <p style={s.footerNote}>HospitalNet · Acceso exclusivo para personal médico autorizado</p>

            <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

            {showModal && (
                <div style={s.modalOverlay}>
                    <div style={s.modalCard}>
                        <h3 style={{ color: '#fff' }}>Nueva Interconsulta</h3>
                        <textarea
                            placeholder="Motivo clínico de la derivación..."
                            value={motivo}
                            onChange={(e) => setMotivo(e.target.value)}
                            style={s.textarea}
                        />
                        <select
                            value={especialidad}
                            onChange={(e) => handleEspecialidadChange(e.target.value)}
                            style={{ ...s.textarea, minHeight: 'unset', resize: 'none' }}
                        >
                            <option value="">Selecciona especialidad...</option>
                            <option value="Cardiología">Cardiología</option>
                            <option value="Neurología">Neurología</option>
                            <option value="Dermatología">Dermatología</option>
                            <option value="Ortopedia">Ortopedia</option>
                        </select>
                        <select
                            value={idMedicoReceptor}
                            onChange={(e) => setIdMedicoReceptor(e.target.value)}
                            disabled={!especialidad || cargandoMedicos}
                            style={{ ...s.textarea, minHeight: 'unset', resize: 'none' }}
                        >
                            <option value="">
                                {cargandoMedicos
                                    ? 'Buscando médicos...'
                                    : especialidad
                                        ? (medicosReceptor.length === 0 ? 'Sin médicos registrados en esta especialidad' : 'Selecciona médico receptor...')
                                        : 'Primero elige una especialidad'}
                            </option>
                            {medicosReceptor.map((m) => (
                                <option key={m.id_medico} value={m.id_medico}>{m.nombre}</option>
                            ))}
                        </select>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                            <button
                                onClick={enviarInterconsulta}
                                disabled={!motivo.trim() || !idMedicoReceptor}
                                style={{ ...s.submitBtn, ...((!motivo.trim() || !idMedicoReceptor) ? s.submitBtnDisabled : {}) }}
                            >
                                Enviar
                            </button>
                            <button onClick={() => setShowModal(false)} style={{ ...s.submitBtn, background: '#444' }}>Cancelar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── Estilos ───────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
    page: {
        fontFamily: "'DM Sans','Segoe UI',system-ui,sans-serif",
        backgroundColor: '#080d12',
        minHeight: '100vh',
        padding: '24px 28px 40px',
        color: '#ffffff',
        animation: 'fadeSlideIn 0.4s ease',
    },
    grid: {
        display: 'grid',
        gridTemplateColumns: '300px 1fr',
        gap: '16px',
    },
    col: {
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
    },
    topbar: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '22px',
        paddingBottom: '18px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
    },
    topbarCenter: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
    },
    topbarRight: {
        width: '130px',
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
    topbarLabel: {
        fontSize: '14px',
        fontWeight: 500,
        color: 'rgba(255,255,255,0.5)',
        letterSpacing: '0.02em',
    },
    backBtn: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        background: 'rgba(0,200,160,0.06)',
        border: '1px solid rgba(0,200,160,0.15)',
        borderRadius: '8px',
        padding: '8px 14px',
        fontSize: '13px',
        color: '#00c8a0',
        cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'background 0.15s',
    },
    card: {
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '12px',
        padding: '20px',
    },
    cardHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        marginBottom: '16px',
    },
    divider: {
        height: '1px',
        background: 'rgba(255,255,255,0.06)',
        marginBottom: '14px',
    },
    secTitle: {
        fontSize: '13px',
        fontWeight: 500,
        color: 'rgba(255,255,255,0.6)',
        marginBottom: '16px',
        letterSpacing: '0.02em',
        display: 'flex',
        alignItems: 'center',
    },
    avatar: {
        width: '52px',
        height: '52px',
        borderRadius: '50%',
        background: 'rgba(0,200,160,0.1)',
        border: '1px solid rgba(0,200,160,0.25)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '17px',
        fontWeight: 600,
        color: '#00c8a0',
        flexShrink: 0,
    },
    ptName: {
        fontSize: '16px',
        fontWeight: 600,
        color: '#ffffff',
        margin: 0,
        lineHeight: 1.2,
    },
    ptSub: {
        fontSize: '12px',
        color: 'rgba(255,255,255,0.35)',
        margin: '3px 0 0',
    },
    infoRow: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 0',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        fontSize: '13px',
    },
    infoLabel: {
        color: 'rgba(255,255,255,0.35)',
        display: 'flex',
        alignItems: 'center',
    },
    infoVal: {
        color: '#ffffff',
        fontWeight: 500,
        textAlign: 'right',
    },
    histItem: {
        padding: '10px 0',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
    },
    histFecha: {
        fontSize: '11px',
        color: 'rgba(255,255,255,0.3)',
        margin: '0 0 3px',
        letterSpacing: '0.02em',
    },
    histDiag: {
        fontSize: '13px',
        fontWeight: 500,
        color: '#ffffff',
        margin: 0,
    },
    histMed: {
        fontSize: '12px',
        color: 'rgba(255,255,255,0.4)',
        margin: '2px 0 0',
    },
    emptyMsg: {
        fontSize: '13px',
        color: 'rgba(255,255,255,0.2)',
        fontStyle: 'italic',
    },
    vitalsGrid: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '10px',
        marginBottom: '12px',
    },
    vitalCard: {
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '8px',
        padding: '14px',
    },
    vitalLabel: {
        fontSize: '11px',
        color: 'rgba(255,255,255,0.35)',
        marginBottom: '6px',
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
    },
    vitalValRow: {
        display: 'flex',
        alignItems: 'baseline',
        gap: '4px',
        marginBottom: '6px',
    },
    vitalVal: {
        fontSize: '22px',
        fontWeight: 600,
        color: '#ffffff',
    },
    vitalUnit: {
        fontSize: '11px',
        color: 'rgba(255,255,255,0.3)',
    },
    badge: {
        display: 'inline-block',
        fontSize: '11px',
        padding: '2px 9px',
        borderRadius: '20px',
        fontWeight: 500,
    },
    imcCard: {
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '8px',
        padding: '14px',
    },
    imcRow: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '10px',
    },
    imcBarBg: {
        height: '4px',
        background: 'rgba(255,255,255,0.08)',
        borderRadius: '2px',
        marginBottom: '6px',
    },
    imcBarFill: {
        height: '4px',
        borderRadius: '2px',
        background: '#00c8a0',
        transition: 'width 0.5s ease',
    },
    imcBarLabels: {
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '10px',
        color: 'rgba(255,255,255,0.25)',
        letterSpacing: '0.02em',
    },
    inputLabel: {
        display: 'block',
        fontSize: '11px',
        fontWeight: 500,
        color: 'rgba(255,255,255,0.35)',
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        marginBottom: '6px',
    },
    inputWrapper: {
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
    },
    inputIconStyle: {
        position: 'absolute',
        left: '11px',
        color: 'rgba(255,255,255,0.25)',
        fontSize: '14px',
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
    inputFocused: {
        borderColor: 'rgba(0,200,160,0.5)',
        background: 'rgba(0,200,160,0.04)',
    },
    textarea: {
        width: '100%',
        boxSizing: 'border-box',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '8px',
        padding: '10px 12px',
        fontSize: '13px',
        fontFamily: 'inherit',
        color: '#ffffff',
        resize: 'vertical',
        minHeight: '90px',
        outline: 'none',
        display: 'block',
        transition: 'border-color 0.2s, background 0.2s',
    },
    submitBtn: {
        width: '100%',
        padding: '13px',
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
    },
    submitBtnDisabled: {
        opacity: 0.45,
        cursor: 'not-allowed',
    },
    stateRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '16px 0',
        color: 'rgba(255,255,255,0.35)',
        fontSize: '13px',
    },
    spinner: {
        display: 'inline-block',
        width: '14px',
        height: '14px',
        border: '2px solid rgba(255,255,255,0.08)',
        borderTopColor: '#00c8a0',
        borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
        flexShrink: 0,
    },
    errorAlert: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        background: 'rgba(224,92,92,0.1)',
        border: '1px solid rgba(224,92,92,0.25)',
        borderRadius: '8px',
        padding: '10px 14px',
        marginBottom: '4px',
        fontSize: '13px',
        color: '#f08080',
        animation: 'fadeSlideIn 0.25s ease',
    },
    errorDot: {
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        background: '#e05c5c',
        flexShrink: 0,
    },
    footerNote: {
        textAlign: 'center',
        fontSize: '11px',
        color: 'rgba(255,255,255,0.18)',
        marginTop: '32px',
        marginBottom: 0,
    },
    modalOverlay: {
        position: 'fixed' as const,
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.8)',
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        zIndex: 9999,
    },
    modalCard: {
        background: '#1a2540', padding: '24px', borderRadius: '12px',
        width: '400px', border: '1px solid #333',
    },
};