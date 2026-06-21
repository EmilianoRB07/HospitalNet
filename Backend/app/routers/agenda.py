from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.database import get_db
from app.security import verificar_token, requerir_admin
from app.routers.clinica import _asegurar_esquema_clinico
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/agenda", tags=["Agenda"])


# ─── VALIDACIÓN DE CONCURRENCIA (RNF-05) ─────────────────────────────────────

def validar_concurrencia_agenda(
    db: Session,
    id_medico: int,
    fecha_hora: str,
    id_cita_excluir: Optional[int] = None
) -> bool:
    """
    RNF-05: Verifica si ya existe una cita en el mismo horario y médico.
    Retorna True si hay conflicto, False si está libre.
    """
    query = """
        SELECT 1 FROM citas
        WHERE id_medico = :medico
        AND fecha_hora = :fecha_hora
        AND estado NOT IN ('Cancelada', 'Atendida')
    """
    params = {"medico": id_medico, "fecha_hora": fecha_hora}
    
    if id_cita_excluir:
        query += " AND id_cita != :id_cita"
        params["id_cita"] = id_cita_excluir
    
    query += " LIMIT 1"
    
    conflicto = db.execute(text(query), params).first()
    return conflicto is not None


# ─── ENDPOINTS ─────────────────────────────────────────────────────────────────

@router.get("/")
def obtener_agenda(id_medico: int, db: Session = Depends(get_db), usuario: dict = Depends(verificar_token)):
    try:
        query = text("""
            SELECT
                c.id_cita, c.fecha_hora, c.estado, c.estado_pago,
                p.id_paciente, p.nombre, p.apellidos, p.edad,
                p.sexo, p.tipo_sangre, p.telefono, p.alergias,
                p.medico_asignado
            FROM citas c
            INNER JOIN expedientes_pacientes p ON p.id_paciente = c.id_paciente
            WHERE c.id_medico = :id_medico
              AND c.estado != 'Cancelada'
            ORDER BY c.fecha_hora ASC
        """)
        resultados = db.execute(query, {"id_medico": id_medico}).mappings().all()
        return {"success": True, "agenda": [dict(r) for r in resultados]}
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.get("/verificar-disponibilidad")
def verificar_disponibilidad(
    id_medico: int,
    fecha_hora: str,
    db: Session = Depends(get_db),
    usuario: dict = Depends(verificar_token)
):
    """
    RNF-05: Verifica si un horario está disponible antes de agendar.
    """
    try:
        disponible = not validar_concurrencia_agenda(db, id_medico, fecha_hora)
        return {
            "success": True,
            "disponible": disponible,
            "mensaje": "Horario disponible" if disponible else "MSG-10: Error de Concurrencia: El horario seleccionado ya se encuentra bloqueado por otra consulta."
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


class CancelarCitaRequest(BaseModel):
    id_cita: int
    motivo: str


@router.post("/cancelar")
def cancelar_cita(payload: CancelarCitaRequest, db: Session = Depends(get_db), usuario: dict = Depends(verificar_token)):
    try:
        check = db.execute(text("""
            SELECT c.estado_pago, m.especialidad
            FROM citas c
            JOIN medicos m ON m.id_medico = c.id_medico
            WHERE c.id_cita = :id_cita
        """), {"id_cita": payload.id_cita}).mappings().first()

        if check and check["especialidad"] == "Medicina General" and check["estado_pago"] == "Pagado":
            return {
                "success": False,
                "error": "Esta cita ya fue pagada. Indica al paciente que pase a recepción para cancelarla."
            }

        db.execute(text("""
            UPDATE citas SET estado = 'Cancelada', motivo_cancelacion = :motivo
            WHERE id_cita = :id_cita
        """), {"motivo": payload.motivo, "id_cita": payload.id_cita})
        db.commit()
        return {"success": True}
    except Exception as e:
        db.rollback()
        return {"success": False, "error": str(e)}


class AgendarCitaRequest(BaseModel):
    id_paciente: int
    id_medico: int
    fecha_hora: str
    motivo: Optional[str] = None
    tipo: str = "primera_vez"


@router.post("/agendar")
def agendar_cita(
    payload: AgendarCitaRequest,
    db: Session = Depends(get_db),
    usuario: dict = Depends(requerir_admin)
):
    """
    RNF-05: Agendar una nueva cita con validación de concurrencia.
    """
    try:
        # 1. Validar concurrencia (RNF-05)
        if validar_concurrencia_agenda(db, payload.id_medico, payload.fecha_hora):
            return {
                "success": False,
                "error": "ERR-05: El horario seleccionado ya se encuentra bloqueado por otra consulta.",
                "mensaje": "MSG-10: Error de Concurrencia: El horario seleccionado ya se encuentra bloqueado por otra consulta."
            }
        
        # 2. Verificar que el paciente existe
        paciente = db.execute(
            text("SELECT id_paciente FROM expedientes_pacientes WHERE id_paciente = :id"),
            {"id": payload.id_paciente}
        ).first()
        
        if not paciente:
            return {"success": False, "error": "Paciente no encontrado."}
        
        # 3. Verificar que el médico existe y obtener su especialidad
        medico = db.execute(
            text("SELECT id_medico, especialidad FROM medicos WHERE id_medico = :id"),
            {"id": payload.id_medico}
        ).first()
        
        if not medico:
            return {"success": False, "error": "Médico no encontrado."}
        
        # 4. Insertar la cita
        result = db.execute(text("""
            INSERT INTO citas (id_paciente, id_medico, fecha_hora, motivo, estado, estado_pago, tipo)
            VALUES (:paciente, :medico, :fecha_hora, :motivo, 'Programada', 'Pendiente', :tipo)
            RETURNING id_cita
        """), {
            "paciente": payload.id_paciente,
            "medico": payload.id_medico,
            "fecha_hora": payload.fecha_hora,
            "motivo": payload.motivo,
            "tipo": payload.tipo,
        })
        
        id_cita = result.scalar()
        
        # RN-03: Si es medicina general, generar el cargo de $500
        if medico["especialidad"] == "Medicina General":
            db.execute(text("""
                INSERT INTO cargos (id_paciente, id_cita, concepto, monto, tipo_medico, estado)
                VALUES (:pac, :cita, 'Consulta de medicina general', 500.00, 'General', 'Pendiente')
            """), {"pac": payload.id_paciente, "cita": id_cita})
        
        db.commit()
        
        return {
            "success": True,
            "message": "Cita agendada correctamente.",
            "id_cita": id_cita
        }
        
    except Exception as e:
        db.rollback()
        return {"success": False, "error": str(e)}


@router.post("/generar-lote")
def generar_citas_lote(db: Session = Depends(get_db), usuario: dict = Depends(requerir_admin)):
    try:
        _asegurar_esquema_clinico(db)

        sin_cita = db.execute(text("""
            SELECT e.id_paciente, e.medico_asignado, m.especialidad
            FROM expedientes_pacientes e
            JOIN medicos m ON m.id_medico = e.medico_asignado
            WHERE e.medico_asignado IS NOT NULL
              AND NOT EXISTS (
                  SELECT 1 FROM citas c
                  WHERE c.id_paciente = e.id_paciente
                    AND DATE(c.fecha_hora) = CURRENT_DATE
                    AND c.estado != 'Cancelada'
              )
            LIMIT 50
        """)).mappings().all()

        generadas = 0
        for fila in sin_cita:
            # Buscar un slot libre usando validación de concurrencia
            slot = None
            for n in range(0, 20):
                slot_candidato = db.execute(text("""
                    SELECT CURRENT_DATE + INTERVAL '8 hours' + (:n * INTERVAL '30 minutes')
                """), {"n": n}).scalar()
                
                if not validar_concurrencia_agenda(db, fila["medico_asignado"], slot_candidato):
                    slot = slot_candidato
                    break

            if slot:
                id_cita = db.execute(text("""
                    INSERT INTO citas (id_paciente, id_medico, fecha_hora, estado, estado_pago, tipo)
                    VALUES (:paciente, :medico, :slot, 'Programada', 'Pendiente', 'primera_vez')
                    RETURNING id_cita
                """), {"paciente": fila["id_paciente"], "medico": fila["medico_asignado"], "slot": slot}).scalar()

                if fila["especialidad"] == "Medicina General":
                    db.execute(text("""
                        INSERT INTO cargos (id_paciente, id_cita, concepto, monto, tipo_medico, estado)
                        VALUES (:pac, :cita, 'Consulta de medicina general', 500.00, 'General', 'Pendiente')
                    """), {"pac": fila["id_paciente"], "cita": id_cita})

                generadas += 1

        db.commit()
        return {
            "success": True,
            "citas_generadas": generadas,
            "mensaje": f"Se generaron {generadas} cita(s) para hoy."
        }
    except Exception as e:
        db.rollback()
        return {"success": False, "error": str(e)}