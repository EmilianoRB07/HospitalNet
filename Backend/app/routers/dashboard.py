# app/routers/dashboard.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.database import get_db
from app.security import requerir_admin

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("/admin")
def obtener_dashboard_admin(db: Session = Depends(get_db), usuario: dict = Depends(requerir_admin)):
    try:
        # Función auxiliar para contar de forma segura
        def contar(tabla):
            try:
                res = db.execute(text(f"SELECT COUNT(*) FROM public.{tabla}")).scalar()
                return res or 0
            except:
                return 0

        total_medicos = contar("medicos")
        total_pacientes = contar("expedientes_pacientes")
        total_citas = db.execute(text("SELECT COUNT(*) FROM public.citas WHERE DATE(fecha_hora) = CURRENT_DATE")).scalar() or 0

        # Obtener lista de médicos
        query_lista = text("SELECT nombre, especialidad FROM public.medicos ORDER BY id_medico DESC LIMIT 4")
        lista_medicos = [dict(m) for m in db.execute(query_lista).mappings().all()]

        return {
            "success": True,
            "stats": {
                "medicos": total_medicos,
                "pacientes": total_pacientes,
                "citas_hoy": total_citas
            },
            "medicos_recientes": lista_medicos
        }
    except Exception as e:
        return {"success": False, "error": str(e)}