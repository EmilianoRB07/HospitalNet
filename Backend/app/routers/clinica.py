"""
clinica.py — Todos los endpoints clínicos de HospitalNet
Cubre: RF-02 a RF-12, RN-01 a RN-03, CU-03 a CU-06
"""
from fastapi import APIRouter, Depends
from app.security import verificar_token, requerir_admin, requerir_medico_general, requerir_medico_especialista, requerir_medico
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.database import get_db
from pydantic import BaseModel
from typing import Optional
import bcrypt
from typing import Optional 

router = APIRouter(prefix="/clinica", tags=["Clínica"])


# ─── SIGNOS VITALES ───────────────────────────────────────────────────────────
def acceso_permitido(db: Session, id_medico: int, id_paciente: int) -> bool:
    """RN-02: solo hay acceso si existe consulta activa del médico con ese
    paciente, o una interconsulta activa donde él es el receptor."""
    fila = db.execute(text("""
        SELECT 1 FROM citas
        WHERE id_medico = :med AND id_paciente = :pac AND estado = 'Activa'
        UNION
        SELECT 1 FROM interconsultas
        WHERE id_medico_receptor = :med AND id_paciente = :pac AND estado = 'Activa'
        LIMIT 1
    """), {"med": id_medico, "pac": id_paciente}).first()
    return fila is not None


# FIX (bloqueante, descubierto al conectar el frontend): varios endpoints de
# este archivo (órdenes, resultados, cargos, alertas, interconsultas con
# especialidad/alta) asumen columnas y tablas que NUNCA llegaron a crearse en
# la base de datos real — el script de migración que las creaba no se aplicó
# correctamente. Sin esto, /clinica/orden, /clinica/ordenes, /clinica/alertas,
# /clinica/alerta, /clinica/cargos-pendientes, /clinica/cargo-pagar,
# /clinica/registrar-pago y /clinica/interconsulta (con especialidad) fallaban
# con "relation/column does not exist" en cuanto se les llamaba de verdad.
# Siguiendo el mismo patrón "autocreación blindada" que ya usa auth.py para
# sesiones_activas/captcha_sesiones, cada endpoint que toca estas tablas llama
# primero a este helper. Es idempotente: correrlo de más nunca rompe nada.
def _asegurar_esquema_clinico(db: Session) -> None:
    db.execute(text("""
        ALTER TABLE interconsultas
            ADD COLUMN IF NOT EXISTS especialidad VARCHAR(80),
            ADD COLUMN IF NOT EXISTS fecha_alta   TIMESTAMP;
    """))
    db.execute(text("""
        ALTER TABLE resultados_estudios
            ADD COLUMN IF NOT EXISTS id_orden      INTEGER,
            ADD COLUMN IF NOT EXISTS capturado_por INTEGER;
    """))
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS ordenes_servicio (
            id_orden         SERIAL        PRIMARY KEY,
            id_paciente      INTEGER       NOT NULL REFERENCES expedientes_pacientes(id_paciente),
            id_medico_emisor INTEGER       NOT NULL REFERENCES medicos(id_medico),
            tipo_estudio     VARCHAR(20)   NOT NULL CHECK (tipo_estudio IN ('Laboratorio','Imagenología')),
            nombre_prueba    VARCHAR(100)  NOT NULL,
            prioridad        VARCHAR(10)   NOT NULL DEFAULT 'Media'
                                 CHECK (prioridad IN ('Alta','Media','Baja')),
            justificacion    VARCHAR(255),
            estado           VARCHAR(20)   NOT NULL DEFAULT 'Solicitada'
                                 CHECK (estado IN ('Solicitada','Realizada')),
            fecha_solicitud  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
            fecha_resultado  TIMESTAMP
        );
    """))
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS cargos (
            id_cargo    SERIAL        PRIMARY KEY,
            id_paciente INTEGER       NOT NULL REFERENCES expedientes_pacientes(id_paciente),
            id_cita     INTEGER       REFERENCES citas(id_cita),
            concepto    VARCHAR(150)  NOT NULL,
            monto       NUMERIC(10,2) NOT NULL,
            tipo_medico VARCHAR(15)   NOT NULL CHECK (tipo_medico IN ('General','Especialista')),
            estado      VARCHAR(15)   NOT NULL DEFAULT 'Pendiente'
                            CHECK (estado IN ('Pendiente','Pagado')),
            creado_en   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
            pagado_en   TIMESTAMP
        );
    """))
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS alertas_urgencia (
            id_alerta   SERIAL       PRIMARY KEY,
            id_paciente INTEGER      REFERENCES expedientes_pacientes(id_paciente),
            mensaje     VARCHAR(255) NOT NULL,
            creado_por  INTEGER      REFERENCES usuarios(id_usuario),
            activa      BOOLEAN      NOT NULL DEFAULT TRUE,
            creado_en   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            atendida_en TIMESTAMP
        );
    """))
    db.commit()


@router.get("/signos")
def obtener_signos(id_paciente: int, id_medico: int, db: Session = Depends(get_db), usuario: dict = Depends(requerir_medico)):
    if not acceso_permitido(db, id_medico, id_paciente):
        return {"success": False, "error": "ERR-04: Acceso Denegado. No tiene permisos para visualizar este expediente fuera de una consulta activa."}
    try:
        res = db.execute(text("""
            SELECT * FROM signos_vitales
            WHERE id_paciente = :id
            ORDER BY created_at DESC LIMIT 1
        """), {"id": id_paciente}).mappings().first()
        return {"success": True, "signos_vitales": dict(res) if res else {}}
    except Exception as e:
        return {"success": False, "error": str(e)}


class SignosRequest(BaseModel):
    id_paciente: int
    frecuencia_cardiaca: int
    presion_arterial: str
    temperatura: float
    peso: float
    estatura: float


@router.post("/signos")
def guardar_signos(payload: SignosRequest, db: Session = Depends(get_db), usuario: dict = Depends(verificar_token)):
    try:
        db.execute(text("""
            INSERT INTO signos_vitales
                (id_paciente, frecuencia_cardiaca, presion_arterial,
                 temperatura, peso, estatura)
            VALUES (:pac, :fc, :pa, :temp, :peso, :est)
        """), {
            "pac": payload.id_paciente,
            "fc": payload.frecuencia_cardiaca,
            "pa": payload.presion_arterial,
            "temp": payload.temperatura,
            "peso": payload.peso,
            "est": payload.estatura,
        })
        db.commit()
        return {"success": True}
    except Exception as e:
        db.rollback()
        return {"success": False, "error": str(e)}

def registrar_evento(db: Session, id_usuario: int, tipo: str, descripcion: str, ip: str = "0.0.0.0"):
    try:
        db.execute(text("""
            INSERT INTO bitacora_auditoria (id_usuario, tipo_evento, descripcion, ip_origen)
            VALUES (:id, :tipo, :desc, :ip)
        """), {"id": id_usuario, "tipo": tipo, "desc": descripcion, "ip": ip})
        db.commit()
    except Exception as e:
        print(f"Error al auditar: {e}")


# ─── HISTORIAL CLÍNICO ────────────────────────────────────────────────────────
@router.get("/historial")
def obtener_historial(id_paciente: int, id_medico: int, db: Session = Depends(get_db), usuario: dict = Depends(requerir_medico)):
    if not acceso_permitido(db, id_medico, id_paciente):
        return {"success": False, "error": "ERR-04: Acceso Denegado. No tiene permisos para visualizar este expediente fuera de una consulta activa."}
    try:
        rows = db.execute(text("""
            SELECT fecha_consulta AS fecha, diagnostico, cie10,
                   notas_evolucion, receta_medica
            FROM consultas_medicas
            WHERE id_paciente = :id
            ORDER BY fecha_consulta DESC
        """), {"id": id_paciente}).mappings().all()
        return {"success": True, "historial": [dict(r) for r in rows]}
    except Exception as e:
        return {"success": False, "error": str(e)}


# 1. Endpoint para el selector de especialidades (necesario para RegistroMedico.tsx)
@router.get("/especialidades")
def obtener_especialidades(db: Session = Depends(get_db), usuario: dict = Depends(verificar_token)):
    # Asumiendo que las especialidades están en la tabla medicos
    query = text("SELECT DISTINCT especialidad FROM medicos WHERE especialidad IS NOT NULL")
    res = db.execute(query).scalars().all()
    return {"success": True, "especialidades": res}

@router.get("/especialidades-disponibles")
def obtener_especialidades_lista(db: Session = Depends(get_db), usuario: dict = Depends(verificar_token)):
    # Esto te sirve para poblar el dropdown de RegistroMedico.tsx
    res = db.execute(text("SELECT DISTINCT especialidad FROM medicos")).scalars().all()
    return {"success": True, "especialidades": res}

# ─── INICIAR CONSULTA (RN-02 expediente, RN-03 pago) ─────────────────────────
class IniciarRequest(BaseModel):
    id_cita: int
    id_medico: int


@router.post("/iniciar")
def iniciar_consulta(payload: IniciarRequest, db: Session = Depends(get_db), usuario: dict = Depends(verificar_token)):
    try:
        cita = db.execute(text("""
            SELECT c.id_medico, c.estado, c.estado_pago, m.especialidad
            FROM citas c
            JOIN medicos m ON m.id_medico = c.id_medico
            WHERE c.id_cita = :id
        """), {"id": payload.id_cita}).mappings().first()

        if not cita:
            return {"success": False, "error": "La cita no existe."}
        if cita["estado"] in ("Atendida", "Cancelada"):
            return {"success": False, "error": "La consulta ya finalizó o fue cancelada."}
        if cita["estado"] == "Activa" and cita["id_medico"] != payload.id_medico:
            return {"success": False,
                    "error": "MSG-09: Acceso denegado — expediente en uso por otro médico. (ERR-04)"}

        # RN-03: pago obligatorio solo para Medicina General
        if cita["especialidad"] == "Medicina General" and cita["estado_pago"] != "Pagado":
            return {"success": False,
                    "error": "ERR-03: El paciente no tiene pago registrado en cajas."}

        db.execute(text("UPDATE citas SET estado='Activa' WHERE id_cita=:id"),
                   {"id": payload.id_cita})
        db.commit()
        return {"success": True, "mensaje": "Expediente desbloqueado y consulta activa."}
    except Exception as e:
        db.rollback()
        return {"success": False, "error": str(e)}


# ─── GUARDAR CONSULTA GENERAL ─────────────────────────────────────────────────
class GuardarConsultaRequest(BaseModel):
    id_paciente: int
    id_medico: int
    diagnostico: str
    cie10: str
    notas_evolucion: str
    receta_medica: str
    id_cita: Optional[int] = None


@router.post("/guardar")
def guardar_consulta(payload: GuardarConsultaRequest, db: Session = Depends(get_db), usuario: dict = Depends(requerir_medico_general)):
    if not all([payload.diagnostico.strip(), payload.cie10.strip(),
                payload.notas_evolucion.strip(), payload.receta_medica.strip()]):
        return {"success": False,
                "error": "Diagnóstico, CIE-10, Notas y Tratamiento son obligatorios."}
    try:
        # RN-03 server-side
        esp = db.execute(text("SELECT especialidad FROM medicos WHERE id_medico=:id"),
                         {"id": payload.id_medico}).scalar()
        if esp == "Medicina General":
            pago = db.execute(text("""
                SELECT estado_pago FROM citas
                WHERE id_paciente=:p AND id_medico=:m AND estado='Activa'
            """), {"p": payload.id_paciente, "m": payload.id_medico}).scalar()
            if pago != "Pagado":
                return {"success": False,
                        "error": "ERR-03: El paciente no tiene pago previo en cajas."}

        db.execute(text("""
            INSERT INTO consultas_medicas
                (id_paciente, id_medico, id_cita, diagnostico, cie10,
                 notas_evolucion, receta_medica)
            VALUES (:p, :m, :c, :diag, :cie, :notas, :receta)
        """), {
            "p": payload.id_paciente, "m": payload.id_medico,
            "c": payload.id_cita,
            "diag": payload.diagnostico, "cie": payload.cie10.upper(),
            "notas": payload.notas_evolucion, "receta": payload.receta_medica,
        })
        if payload.id_cita:
            db.execute(text("UPDATE citas SET estado='Atendida' WHERE id_cita=:id"),
                       {"id": payload.id_cita})
        db.commit()
        return {"success": True, "message": "Consulta guardada correctamente."}
    except Exception as e:
        db.rollback()
        return {"success": False, "error": str(e)}


# ─── GUARDAR CONSULTA ESPECIALISTA ───────────────────────────────────────────
class GuardarEspecialidadRequest(BaseModel):
    id_paciente: int
    id_medico: int
    diagnostico_especializado: str
    cie10: str
    tratamiento: str
    notas_evolucion: str
    laboratorios_revisados: Optional[str] = ""
    id_cita: Optional[int] = None


@router.post("/guardar-especialidad")
def guardar_especialidad(payload: GuardarEspecialidadRequest, db: Session = Depends(get_db), usuario: dict = Depends(requerir_medico_especialista)):
    try:
        _asegurar_esquema_clinico(db)
        db.execute(text("""
            INSERT INTO consultas_medicas
                (id_paciente, id_medico, id_cita, diagnostico, cie10,
                 notas_evolucion, receta_medica, laboratorios)
            VALUES (:p, :m, :c, :diag, :cie, :notas, :trat, :labs)
        """), {
            "p": payload.id_paciente, "m": payload.id_medico,
            "c": payload.id_cita,
            "diag": payload.diagnostico_especializado, "cie": payload.cie10.upper(),
            "notas": payload.notas_evolucion, "trat": payload.tratamiento,
            "labs": payload.laboratorios_revisados,
        })
        if payload.id_cita:
            db.execute(text("""
                UPDATE citas SET estado='Atendida', estado_pago='Pendiente_Especialidad'
                WHERE id_cita=:id
            """), {"id": payload.id_cita})

        # FIX CU-04 (criterio de aceptación 2): el cobro de $1200 por consulta
        # de especialidad debe inyectarse automáticamente al finalizar, sin
        # depender de que recepción lo capture manualmente después. Antes
        # este INSERT no existía: solo se cambiaba estado_pago en citas, y
        # la tabla `cargos` se quedaba vacía para estas consultas.
        db.execute(text("""
            INSERT INTO cargos (id_paciente, id_cita, concepto, monto, tipo_medico, estado)
            VALUES (:pac, :cita, :concepto, 1200.00, 'Especialista', 'Pendiente')
        """), {
            "pac": payload.id_paciente,
            "cita": payload.id_cita,
            "concepto": f"Consulta de especialidad (CIE-10 {payload.cie10.upper()})",
        })

        db.commit()
        return {"success": True, "message": "Consulta especializada guardada. Cargo de $1200 generado en cajas."}
    except Exception as e:
        db.rollback()
        return {"success": False, "error": str(e)}


# ─── INTERCONSULTAS ──────────────────────────────────────────────────────────
class InterconsultaRequest(BaseModel):
    id_paciente: int
    id_medico_emisor: int
    id_medico_receptor: int
    especialidad: str
    motivo_clinico: str


@router.post("/interconsulta")
def crear_interconsulta(payload: InterconsultaRequest, db: Session = Depends(get_db), usuario: dict = Depends(requerir_medico)):
    try:
        _asegurar_esquema_clinico(db)
        db.execute(text("""
            INSERT INTO interconsultas
                (id_paciente, id_medico_emisor, id_medico_receptor,
                 especialidad, motivo_clinico, estado)
            VALUES (:pac, :emisor, :receptor, :esp, :motivo, 'Pendiente')
        """), {
            "pac": payload.id_paciente,
            "emisor": payload.id_medico_emisor,
            "receptor": payload.id_medico_receptor,
            "esp": payload.especialidad,
            "motivo": payload.motivo_clinico,
        })
        db.commit()
        return {"success": True}
    except Exception as e:
        db.rollback()
        return {"success": False, "error": str(e)}


@router.get("/interconsultas-pendientes")
def interconsultas_pendientes(id_medico: int, db: Session = Depends(get_db), usuario: dict = Depends(requerir_medico_especialista)):
    """Interconsultas que el especialista tiene pendientes o activas (CU-05)."""
    try:
        _asegurar_esquema_clinico(db)
        rows = db.execute(text("""
            SELECT i.id_interconsulta, i.id_paciente, i.estado,
                   i.especialidad, i.motivo_clinico, i.created_at,
                   p.nombre, p.apellidos, p.edad, p.sexo,
                   p.tipo_sangre, p.alergias,
                   me.nombre AS nombre_emisor
            FROM interconsultas i
            JOIN expedientes_pacientes p ON p.id_paciente = i.id_paciente
            JOIN medicos me ON me.id_medico = i.id_medico_emisor
            WHERE i.id_medico_receptor = :id
              AND i.estado IN ('Pendiente', 'Activa')
            ORDER BY i.created_at DESC
        """), {"id": id_medico}).mappings().all()
        return {"success": True, "interconsultas": [dict(r) for r in rows]}
    except Exception as e:
        return {"success": False, "error": str(e)}


class IniciarInterconsultaRequest(BaseModel):
    id_interconsulta: int


# FIX CU-05/RN-02: faltaba el paso intermedio. acceso_permitido() solo
# concede lectura del expediente si la interconsulta está en estado
# 'Activa', pero crear_interconsulta() siempre la deja en 'Pendiente' y
# nada la pasaba a 'Activa'. Resultado: aunque el especialista viera la
# interconsulta en su bandeja, el acceso a signos/historial seguía
# bloqueado. Este endpoint hace esa transición cuando el especialista
# realmente abre la primera cita de revisión.
@router.post("/interconsulta-iniciar")
def iniciar_interconsulta(payload: IniciarInterconsultaRequest, db: Session = Depends(get_db), usuario: dict = Depends(requerir_medico_especialista)):
    try:
        _asegurar_esquema_clinico(db)
        fila = db.execute(text("""
            UPDATE interconsultas SET estado='Activa'
            WHERE id_interconsulta=:id AND estado IN ('Pendiente','Activa')
            RETURNING id_interconsulta
        """), {"id": payload.id_interconsulta}).first()
        db.commit()
        if not fila:
            return {"success": False, "error": "La interconsulta no existe o ya fue dada de alta."}
        return {"success": True, "mensaje": "Interconsulta activa. Acceso al expediente habilitado."}
    except Exception as e:
        db.rollback()
        return {"success": False, "error": str(e)}


class AltaInterconsultaRequest(BaseModel):
    id_interconsulta: int


@router.post("/interconsulta-alta")
def dar_alta_interconsulta(payload: AltaInterconsultaRequest, db: Session = Depends(get_db), usuario: dict = Depends(requerir_medico_especialista)):
    """Da de alta la interconsulta — revoca el acceso del especialista (CU-05 RN-02)."""
    try:
        _asegurar_esquema_clinico(db)
        db.execute(text("""
            UPDATE interconsultas
            SET estado='Alta', fecha_alta=NOW()
            WHERE id_interconsulta=:id
        """), {"id": payload.id_interconsulta})
        db.commit()
        return {"success": True, "mensaje": "Interconsulta cerrada. Acceso al expediente revocado."}
    except Exception as e:
        db.rollback()
        return {"success": False, "error": str(e)}


# ─── MÉDICOS POR ESPECIALIDAD (selector interconsulta) ───────────────────────
@router.get("/medicos-por-especialidad")
def medicos_por_especialidad(especialidad: str, db: Session = Depends(get_db), usuario: dict = Depends(verificar_token)):
    try:
        rows = db.execute(text("""
            SELECT id_medico, nombre FROM medicos
            WHERE especialidad=:esp ORDER BY nombre ASC
        """), {"esp": especialidad}).mappings().all()
        return {"success": True, "medicos": [dict(r) for r in rows]}
    except Exception as e:
        return {"success": False, "error": str(e)}


# ─── PACIENTES ────────────────────────────────────────────────────────────────
class PacienteRequest(BaseModel):
    nombre: str
    apellidos: str = ""
    edad: int
    sexo: str = "No especificado"
    tipo_sangre: str = "No registrado"
    telefono: str = "Sin teléfono"
    alergias: str = "Ninguna conocida"
    medico_asignado: Optional[int] = None


@router.post("/paciente")
def registrar_paciente(payload: PacienteRequest, db: Session = Depends(get_db), usuario: dict = Depends(verificar_token)):
    try:
        medico_id = payload.medico_asignado
        if not medico_id:
            medico_id = db.execute(text("""
                SELECT id_medico FROM medicos
                WHERE especialidad='Medicina General'
                ORDER BY RANDOM() LIMIT 1
            """)).scalar()

        id_pac = db.execute(text("""
            INSERT INTO expedientes_pacientes
                (nombre, apellidos, edad, sexo, tipo_sangre, telefono, alergias, medico_asignado)
            VALUES (:n, :ap, :e, :s, :ts, :tel, :al, :med)
            RETURNING id_paciente
        """), {
            "n": payload.nombre, "ap": payload.apellidos, "e": payload.edad,
            "s": payload.sexo, "ts": payload.tipo_sangre, "tel": payload.telefono,
            "al": payload.alergias, "med": medico_id,
        }).scalar()
        db.commit()
        return {"success": True, "id_paciente": id_pac}
    except Exception as e:
        db.rollback()
        return {"success": False, "error": str(e)}


# ─── REGISTRO DE MÉDICO (RN-01) ──────────────────────────────────────────────
class RegistroMedicoRequest(BaseModel):
    nombre: str
    fecha_alta: str
    sexo: str
    curp: str
    telefono: str
    correo_institucional: str
    especialidad: str
    horario: str
    cedula_profesional: str
    email: Optional[str] = None # <-- Hacemos que sea opcional
    password: str


@router.post("/medico")
def registrar_medico(payload: RegistroMedicoRequest, db: Session = Depends(get_db), usuario: dict = Depends(requerir_admin)):
    try:
        # Lógica de respaldo: Si payload.email es None o vacío, usa el institucional
        email_final = payload.email if (payload.email and payload.email.strip()) else payload.correo_institucional
        
        # Validar que después del respaldo sí tengamos un email
        if not email_final:
            return {"success": False, "error": "El correo electrónico es obligatorio."}

        id_rol = 2 if payload.especialidad == "Medicina General" else 3
        password_hash = bcrypt.hashpw(
            payload.password.encode(), bcrypt.gensalt()
        ).decode()

        # Usamos email_final en lugar de payload.email
        result = db.execute(text("""
            INSERT INTO usuarios (id_rol, email, password_hash, activo)
            VALUES (:rol, :email, :hash, true)
            RETURNING id_usuario
        """), {"rol": id_rol, "email": email_final, "hash": password_hash})
        
        id_usuario = result.scalar()

        # El resto del INSERT en medicos sigue igual...
        db.execute(text("""
            INSERT INTO medicos
                (id_medico, nombre, fecha_alta, sexo, curp, telefono,
                 correo_institucional, especialidad, horario, cedula_profesional)
            VALUES (:id, :nombre, :fecha, :sexo, :curp, :tel,
                    :correo, :esp, :horario, :cedula)
        """), {
            "id": id_usuario, "nombre": payload.nombre, "fecha": payload.fecha_alta,
            "sexo": payload.sexo, "curp": payload.curp, "tel": payload.telefono,
            "correo": payload.correo_institucional, "esp": payload.especialidad,
            "horario": payload.horario, "cedula": payload.cedula_profesional,
        })
        db.commit()
        return {"success": True, "message": "Médico registrado con éxito."}
    except Exception as e:
        db.rollback()
        # Imprime esto para ver qué está fallando realmente
        print(f"Error en registro: {e}")
        return {"success": False, "error": "Error interno al registrar médico."}

# ─── ALERTAS DE URGENCIA (RF-11) ─────────────────────────────────────────────
@router.get("/alertas")
def obtener_alertas(db: Session = Depends(get_db), usuario: dict = Depends(verificar_token)):
    try:
        _asegurar_esquema_clinico(db)
        rows = db.execute(text("""
            SELECT a.id_alerta, a.mensaje, a.activa, a.creado_en,
                   p.nombre || ' ' || p.apellidos AS paciente
            FROM alertas_urgencia a
            LEFT JOIN expedientes_pacientes p ON p.id_paciente = a.id_paciente
            WHERE a.activa = true
            ORDER BY a.creado_en DESC
        """)).mappings().all()
        return {"success": True, "alertas": [dict(r) for r in rows]}
    except Exception as e:
        return {"success": False, "error": str(e)}


class AlertaRequest(BaseModel):
    id_paciente: Optional[int] = None
    mensaje: str
    creado_por: Optional[int] = None


@router.post("/alerta")
def crear_alerta(payload: AlertaRequest, db: Session = Depends(get_db), usuario: dict = Depends(verificar_token)):
    try:
        _asegurar_esquema_clinico(db)
        db.execute(text("""
            INSERT INTO alertas_urgencia (id_paciente, mensaje, creado_por)
            VALUES (:pac, :msg, :por)
        """), {"pac": payload.id_paciente, "msg": payload.mensaje, "por": payload.creado_por})
        db.commit()
        return {"success": True}
    except Exception as e:
        db.rollback()
        return {"success": False, "error": str(e)}


@router.post("/alerta-atender/{id_alerta}")
def atender_alerta(id_alerta: int, db: Session = Depends(get_db), usuario: dict = Depends(verificar_token)):
    try:
        db.execute(text("""
            UPDATE alertas_urgencia SET activa=false, atendida_en=NOW()
            WHERE id_alerta=:id
        """), {"id": id_alerta})
        db.commit()
        return {"success": True}
    except Exception as e:
        db.rollback()
        return {"success": False, "error": str(e)}


# ─── CARGOS / CAJAS (RN-03/CU-04) ───────────────────────────────────────────
@router.get("/cargos-pendientes")
def cargos_pendientes(db: Session = Depends(get_db), usuario: dict = Depends(requerir_admin)):
    """Vista de cajas/recepción: muestra todos los cobros pendientes."""
    try:
        _asegurar_esquema_clinico(db)
        rows = db.execute(text("""
            SELECT cg.id_cargo, cg.concepto, cg.monto, cg.tipo_medico,
                   cg.estado, cg.creado_en,
                   p.nombre || ' ' || p.apellidos AS paciente
            FROM cargos cg
            JOIN expedientes_pacientes p ON p.id_paciente = cg.id_paciente
            WHERE cg.estado = 'Pendiente'
            ORDER BY cg.creado_en DESC
        """)).mappings().all()
        return {"success": True, "cargos": [dict(r) for r in rows]}
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.post("/cargo-pagar/{id_cargo}")
def marcar_pagado(id_cargo: int, db: Session = Depends(get_db), usuario: dict = Depends(requerir_admin)):
    try:
        db.execute(text("""
            UPDATE cargos SET estado='Pagado', pagado_en=NOW() WHERE id_cargo=:id
        """), {"id": id_cargo})
        # Si el cargo está vinculado a una cita de medicina general, actualizar estado_pago
        db.execute(text("""
            UPDATE citas SET estado_pago='Pagado'
            WHERE id_cita = (SELECT id_cita FROM cargos WHERE id_cargo=:id)
              AND id_cita IS NOT NULL
        """), {"id": id_cargo})
        db.commit()
        return {"success": True}
    except Exception as e:
        db.rollback()
        return {"success": False, "error": str(e)}


# ─── REGISTRAR PAGO DIRECTO (recepción cobra sin cargo previo) ───────────────
class PagoDirectoRequest(BaseModel):
    id_cita: int
    id_paciente: int
    tipo_medico: str  # 'General' o 'Especialista'


@router.post("/registrar-pago")
def registrar_pago(payload: PagoDirectoRequest, db: Session = Depends(get_db), usuario: dict = Depends(requerir_admin)):
    """Recepción registra el pago de una cita antes de que el médico la atienda."""
    try:
        _asegurar_esquema_clinico(db)
        monto = 500.00 if payload.tipo_medico == "General" else 1200.00
        concepto = f"Consulta Médico {'General' if payload.tipo_medico == 'General' else 'Especialista'}"

        db.execute(text("""
            INSERT INTO cargos (id_paciente, id_cita, concepto, monto, tipo_medico, estado, pagado_en)
            VALUES (:pac, :cita, :concepto, :monto, :tipo, 'Pagado', NOW())
        """), {
            "pac": payload.id_paciente, "cita": payload.id_cita,
            "concepto": concepto, "monto": monto, "tipo": payload.tipo_medico,
        })
        nuevo_estado = "Pagado" if payload.tipo_medico == "General" else "Pagado_Especialidad"
        db.execute(text("UPDATE citas SET estado_pago=:ep WHERE id_cita=:id"),
                   {"ep": nuevo_estado, "id": payload.id_cita})
        db.commit()
        return {"success": True, "monto": monto}
    except Exception as e:
        db.rollback()
        return {"success": False, "error": str(e)}


# ─── REPORTES DE PRODUCTIVIDAD (RF-12) ───────────────────────────────────────
@router.get("/reportes")
def reportes_productividad(db: Session = Depends(get_db), usuario: dict = Depends(verificar_token)):
    try:
        rows = db.execute(text("""
            SELECT
                m.nombre AS medico,
                m.especialidad,
                COUNT(cm.id_consulta) AS total_consultas,
                COUNT(cm.id_consulta) FILTER (
                    WHERE DATE(cm.fecha_consulta) = CURRENT_DATE
                ) AS consultas_hoy,
                COUNT(cm.id_consulta) FILTER (
                    WHERE cm.fecha_consulta >= DATE_TRUNC('month', NOW())
                ) AS consultas_mes
            FROM medicos m
            LEFT JOIN consultas_medicas cm ON cm.id_medico = m.id_medico
            GROUP BY m.id_medico, m.nombre, m.especialidad
            ORDER BY total_consultas DESC
        """)).mappings().all()
        return {"success": True, "reporte": [dict(r) for r in rows]}
    except Exception as e:
        return {"success": False, "error": str(e)}


# ─── ÓRDENES DE LABORATORIO / IMAGENOLOGÍA (RF-08) ───────────────────────────
class OrdenRequest(BaseModel):
    id_paciente: int
    id_medico_emisor: int
    tipo_estudio: str   # 'Laboratorio' o 'Imagenología'
    nombre_prueba: str
    prioridad: str = "Media"
    justificacion: Optional[str] = None


@router.post("/orden")
def crear_orden(payload: OrdenRequest, db: Session = Depends(get_db), usuario: dict = Depends(verificar_token)):
    try:
        _asegurar_esquema_clinico(db)
        id_orden = db.execute(text("""
            INSERT INTO ordenes_servicio
                (id_paciente, id_medico_emisor, tipo_estudio,
                 nombre_prueba, prioridad, justificacion)
            VALUES (:pac, :med, :tipo, :prueba, :prior, :just)
            RETURNING id_orden
        """), {
            "pac": payload.id_paciente, "med": payload.id_medico_emisor,
            "tipo": payload.tipo_estudio, "prueba": payload.nombre_prueba,
            "prior": payload.prioridad, "just": payload.justificacion,
        }).scalar()
        db.commit()
        return {"success": True, "id_orden": id_orden}
    except Exception as e:
        db.rollback()
        return {"success": False, "error": str(e)}


@router.get("/ordenes")
def obtener_ordenes(id_paciente: int, db: Session = Depends(get_db), usuario: dict = Depends(verificar_token)):
    """RF-08/RF-09: lista las órdenes del paciente con su resultado (si ya
    existe) y la criticidad calculada con el rango de referencia REAL
    capturado junto al resultado — no con nombres de prueba hardcodeados.

    Convención exigida por el documento del proyecto:
      '**' -> valor fuera del rango de referencia (fuertemente resaltado)
      '*'  -> valor dentro del rango pero cerca de un límite (limítrofe)
      'Normal' -> dentro de rango, lejos de los límites
    """
    try:
        _asegurar_esquema_clinico(db)
        rows = db.execute(text("""
            SELECT o.id_orden, o.tipo_estudio, o.nombre_prueba, o.prioridad,
                   o.estado, o.fecha_solicitud, o.fecha_resultado,
                   r.valor_numerico, r.unidad_medida,
                   r.rango_min_referencia, r.rango_max_referencia,
                   r.created_at AS capturado_en,
                   CASE
                     WHEN r.valor_numerico IS NULL THEN NULL
                     WHEN r.valor_numerico < r.rango_min_referencia
                       OR r.valor_numerico > r.rango_max_referencia THEN '**'
                     WHEN r.valor_numerico <= r.rango_min_referencia
                            + (r.rango_max_referencia - r.rango_min_referencia) * 0.1
                       OR r.valor_numerico >= r.rango_max_referencia
                            - (r.rango_max_referencia - r.rango_min_referencia) * 0.1
                     THEN '*'
                     ELSE 'Normal'
                   END AS criticidad
            FROM ordenes_servicio o
            LEFT JOIN resultados_estudios r ON r.id_orden = o.id_orden
            WHERE o.id_paciente = :id
            ORDER BY o.fecha_solicitud DESC
        """), {"id": id_paciente}).mappings().all()
        return {"success": True, "ordenes": [dict(r) for r in rows]}
    except Exception as e:
        return {"success": False, "error": str(e)}


# FIX RF-08: antes no existía ningún endpoint para capturar el VALOR de un
# estudio ya solicitado. /clinica/orden creaba la orden pero no había forma
# de cerrar el ciclo (capturar resultado -> marcar 'Realizada' -> disparar
# el marcado automático de criticidad de RF-09). Este endpoint lo cierra.
class ResultadoRequest(BaseModel):
    id_orden: int
    id_paciente: int
    valor_numerico: float
    unidad_medida: str
    rango_min_referencia: float
    rango_max_referencia: float
    capturado_por: Optional[int] = None


@router.post("/resultado")
def capturar_resultado(payload: ResultadoRequest, db: Session = Depends(get_db), usuario: dict = Depends(verificar_token)):
    try:
        _asegurar_esquema_clinico(db)

        orden = db.execute(text("SELECT nombre_prueba, tipo_estudio FROM ordenes_servicio WHERE id_orden=:id"),
                            {"id": payload.id_orden}).mappings().first()
        if not orden:
            return {"success": False, "error": "La orden no existe."}

        db.execute(text("""
            INSERT INTO resultados_estudios
                (id_paciente, tipo_estudio, nombre_prueba, valor_numerico,
                 unidad_medida, rango_min_referencia, rango_max_referencia,
                 id_orden, capturado_por)
            VALUES (:pac, :tipo, :prueba, :valor, :unidad, :rmin, :rmax, :orden, :por)
        """), {
            "pac": payload.id_paciente, "tipo": orden["tipo_estudio"],
            "prueba": orden["nombre_prueba"], "valor": payload.valor_numerico,
            "unidad": payload.unidad_medida, "rmin": payload.rango_min_referencia,
            "rmax": payload.rango_max_referencia, "orden": payload.id_orden,
            "por": payload.capturado_por,
        })
        db.execute(text("""
            UPDATE ordenes_servicio SET estado='Realizada', fecha_resultado=NOW()
            WHERE id_orden=:id
        """), {"id": payload.id_orden})
        db.commit()
        return {"success": True, "message": "Resultado capturado correctamente."}
    except Exception as e:
        db.rollback()
        return {"success": False, "error": str(e)}
    
# ─── GENERACIÓN DE PDF (RT-05) ──────────────────────────────────────────────
from fastapi.responses import StreamingResponse
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch, cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from io import BytesIO
from datetime import datetime

def generar_receta_pdf(datos):
    """
    Genera un PDF de receta médica con ReportLab
    """
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, 
                           topMargin=2*cm, bottomMargin=2*cm,
                           leftMargin=2*cm, rightMargin=2*cm)
    
    styles = getSampleStyleSheet()
    style_normal = styles['Normal']
    style_heading = ParagraphStyle(
        'Heading1',
        parent=styles['Heading1'],
        fontSize=16,
        alignment=TA_CENTER,
        spaceAfter=20,
        textColor=colors.HexColor('#1a5276')
    )
    style_subheading = ParagraphStyle(
        'Heading2',
        parent=styles['Heading2'],
        fontSize=12,
        spaceAfter=10,
        textColor=colors.HexColor('#2c3e50')
    )
    style_bold = ParagraphStyle(
        'Bold',
        parent=styles['Normal'],
        fontSize=11,
        fontName='Helvetica-Bold'
    )
    
    story = []
    
    # Encabezado
    story.append(Paragraph("HOSPITALNET", style_heading))
    story.append(Paragraph("Sistema de Atención Médica", style_normal))
    story.append(Spacer(1, 0.3*inch))
    story.append(Paragraph("RECETA MÉDICA", style_heading))
    story.append(Spacer(1, 0.3*inch))
    story.append(Paragraph("_"*80, style_normal))
    story.append(Spacer(1, 0.2*inch))
    
    # Datos del paciente
    story.append(Paragraph(f"<b>Paciente:</b> {datos['paciente']}", style_normal))
    story.append(Paragraph(f"<b>Edad:</b> {datos.get('edad', 'N/A')} años", style_normal))
    story.append(Spacer(1, 0.1*inch))
    
    # Datos del médico
    story.append(Paragraph(f"<b>Médico:</b> {datos['medico']}", style_normal))
    story.append(Paragraph(f"<b>Especialidad:</b> {datos.get('especialidad', 'Médico General')}", style_normal))
    story.append(Paragraph(f"<b>Fecha:</b> {datos['fecha']}", style_normal))
    story.append(Spacer(1, 0.2*inch))
    
    # Diagnóstico
    story.append(Paragraph(f"<b>Diagnóstico:</b> {datos['diagnostico']}", style_normal))
    story.append(Spacer(1, 0.2*inch))
    
    # Tabla de medicamentos
    story.append(Paragraph("<b>Medicamentos recetados:</b>", style_subheading))
    
    tabla_datos = [
        ['Medicamento', 'Dosis', 'Frecuencia', 'Duración']
    ]
    
    for med in datos.get('medicamentos', []):
        tabla_datos.append([
            med.get('nombre', ''),
            med.get('dosis', ''),
            med.get('frecuencia', ''),
            med.get('duracion', '')
        ])
    
    if len(tabla_datos) > 1:
        tabla = Table(tabla_datos, colWidths=[2.5*inch, 1.2*inch, 1.5*inch, 1.5*inch])
        tabla.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2c3e50')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        story.append(tabla)
        story.append(Spacer(1, 0.2*inch))
    else:
        story.append(Paragraph("No hay medicamentos registrados", style_normal))
        story.append(Spacer(1, 0.2*inch))
    
    # Indicaciones
    if datos.get('indicaciones'):
        story.append(Paragraph("<b>Indicaciones:</b>", style_subheading))
        story.append(Paragraph(datos['indicaciones'], style_normal))
        story.append(Spacer(1, 0.2*inch))
    
    # Firma
    story.append(Paragraph("_" * 60, style_normal))
    story.append(Spacer(1, 0.1*inch))
    story.append(Paragraph(datos['medico'], style_bold))
    story.append(Paragraph("Médico Tratante", style_normal))
    
    doc.build(story)
    buffer.seek(0)
    return buffer


@router.get("/receta/{id_paciente}")
def generar_receta(
    id_paciente: int,
    db: Session = Depends(get_db),
    usuario: dict = Depends(verificar_token)
):
    """
    RT-05: Genera una receta médica en PDF desde el servidor.
    """
    try:
        # Obtener datos del paciente
        paciente = db.execute(
            text("""
                SELECT nombre, apellidos, edad 
                FROM expedientes_pacientes 
                WHERE id_paciente = :id
            """),
            {"id": id_paciente}
        ).mappings().first()
        
        if not paciente:
            return {"success": False, "error": "Paciente no encontrado"}
        
        # Obtener la última consulta del paciente
        consulta = db.execute(
            text("""
                SELECT diagnostico, receta_medica, fecha_consulta
                FROM consultas_medicas
                WHERE id_paciente = :id_paciente
                ORDER BY fecha_consulta DESC
                LIMIT 1
            """),
            {"id_paciente": id_paciente}
        ).mappings().first()
        
        # Obtener datos del médico (desde el usuario autenticado)
        medico = db.execute(
            text("""
                SELECT m.nombre, m.especialidad 
                FROM medicos m
                JOIN usuarios u ON u.email = m.correo_institucional
                WHERE u.id_usuario = :id_usuario
            """),
            {"id_usuario": usuario['id_usuario']}
        ).mappings().first()
        
        # Parsear receta médica
        medicamentos = []
        if consulta and consulta.get('receta_medica'):
            lineas = consulta['receta_medica'].split('\n')
            for linea in lineas:
                linea = linea.strip()
                if linea and not linea.startswith('-'):
                    partes = [p.strip() for p in linea.split(',')]
                    if len(partes) >= 2:
                        medicamentos.append({
                            'nombre': partes[0],
                            'dosis': partes[1] if len(partes) > 1 else '1',
                            'frecuencia': partes[2] if len(partes) > 2 else 'c/24h',
                            'duracion': partes[3] if len(partes) > 3 else '30 días'
                        })
                    else:
                        medicamentos.append({
                            'nombre': linea,
                            'dosis': '1',
                            'frecuencia': 'c/24h',
                            'duracion': '30 días'
                        })
        
        if not medicamentos:
            medicamentos = [
                {'nombre': 'Paracetamol', 'dosis': '500mg', 'frecuencia': 'c/8h', 'duracion': '7 días'},
            ]
        
        # Datos para el PDF
        datos_pdf = {
            'paciente': f"{paciente['nombre']} {paciente['apellidos'] or ''}".strip(),
            'edad': paciente['edad'] or 0,
            'medico': medico['nombre'] if medico else 'Médico',
            'especialidad': medico['especialidad'] if medico else 'Médico General',
            'fecha': datetime.now().strftime('%Y-%m-%d %H:%M'),
            'diagnostico': consulta['diagnostico'] if consulta else 'Sin diagnóstico registrado',
            'medicamentos': medicamentos,
            'indicaciones': 'Tomar los medicamentos según lo indicado. No suspender sin consultar al médico.'
        }
        
        # Generar PDF
        pdf_buffer = generar_receta_pdf(datos_pdf)
        
        return StreamingResponse(
            pdf_buffer,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=receta_{id_paciente}_{datetime.now().strftime('%Y%m%d_%H%M')}.pdf"
            }
        )
        
    except Exception as e:
        print(f"Error generando receta: {e}")
        return {"success": False, "error": str(e)}