# app/routers/consultas.py
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.database import get_db

router = APIRouter(prefix="/consultas", tags=["Consultas"])

class ConsultaData(BaseModel):
    id_paciente: int
    id_medico: int
    diagnostico: str
    cie10: str
    notas: str
    receta: str

@router.post("/guardar_consulta")
def guardar_consulta(data: ConsultaData, db: Session = Depends(get_db)):
    try:
        # 1. Validación de especialidad y pago (RN-03)
        medico = db.execute(text("SELECT especialidad FROM public.medicos WHERE id_medico = :id"), 
                            {"id": data.id_medico}).scalar()
        
        if medico == 'Medicina General':
            estado_pago = db.execute(text("""
                SELECT estado_pago FROM public.citas 
                WHERE id_paciente = :pid AND id_medico = :mid AND estado = 'Activa'
            """), {"pid": data.id_paciente, "mid": data.id_medico}).scalar()
            
            if estado_pago != 'Pagado':
                return {"success": False, "error": "ERR-03: Paciente sin registro de pago previo."}

        # 2. Transacción para guardar consulta y actualizar cita
        # Usamos db.begin_nested() o simplemente ejecutamos en orden dentro del bloque
        
        # A) Guardar expediente
        db.execute(text("""
            INSERT INTO public.consultas_medicas 
            (id_paciente, id_medico, diagnostico, cie10, notas_evolucion, receta_medica)
            VALUES (:pid, :mid, :diag, :cie10, :notas, :receta)
        """), {
            "pid": data.id_paciente, "mid": data.id_medico, "diag": data.diagnostico,
            "cie10": data.cie10, "notas": data.notas, "receta": data.receta
        })

        # B) Actualizar estado cita
        db.execute(text("""
            UPDATE public.citas SET estado = 'Atendida' 
            WHERE id_paciente = :pid AND estado = 'Activa'
        """), {"pid": data.id_paciente})
        
        db.commit()
        return {"success": True, "message": "Consulta registrada correctamente."}

    except Exception as e:
        db.rollback()
        return {"success": False, "error": f"Error clínico en la BD: {str(e)}"}
    
@router.post("/iniciar")
def iniciar_consulta(data: dict, db: Session = Depends(get_db)):
    try:
        # Actualizamos el estado de la cita a 'Activa'
        query = text("""
            UPDATE public.citas 
            SET estado = 'Activa' 
            WHERE id_cita = :id_cita 
            AND id_medico = :id_medico
        """)
        resultado = db.execute(query, {"id_cita": data['id_cita'], "id_medico": data['id_medico']})
        db.commit()
        
        if resultado.rowcount == 0:
            return {"success": False, "error": "No se encontró la cita para actualizar."}
        
        return {"success": True, "message": "Cita iniciada correctamente."}
    except Exception as e:
        db.rollback()
        return {"success": False, "error": str(e)}