# app/routers/medicos.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.database import get_db
from app.security import verificar_token

router = APIRouter(prefix="/medicos", tags=["Médicos"])

@router.get("/{id_medico}")
def obtener_perfil_medico(id_medico: int, db: Session = Depends(get_db), usuario: dict = Depends(verificar_token)):
    # Buscamos al médico por su ID
    query = text("""
        SELECT nombre, especialidad, horario, cedula_profesional, telefono, correo_institucional 
        FROM medicos 
        WHERE id_medico = :id
    """)
    medico = db.execute(query, {"id": id_medico}).mappings().first()
    
    if not medico:
        raise HTTPException(status_code=404, detail="Médico no encontrado")
        
    return dict(medico)