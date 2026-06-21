# app/security.py
"""
Dependencias de seguridad para HospitalNet.

verificar_token: exige un header 'Authorization: Bearer <token>' válido
y no expirado contra la tabla sesiones_activas. Se usa en todos los
endpoints clínicos/administrativos.

requerir_admin: además de exigir sesión válida, exige que el rol sea
'Administrador'. Se usa en endpoints exclusivos de recepción/admin.

requerir_medico_general: exige que el usuario sea Médico General (id_rol = 2)
requerir_medico_especialista: exige que el usuario sea Médico Especialista (id_rol = 3)
requerir_medico: permite a cualquier médico (General o Especialista)
"""
from fastapi import Header, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime
from app.database import get_db


def verificar_token(authorization: str = Header(None), db: Session = Depends(get_db)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="ERR-06: Sesión no válida. Inicia sesión nuevamente."
        )

    token = authorization.replace("Bearer ", "", 1).strip()

    sesion = db.execute(text("""
        SELECT s.id_usuario, s.expira_en, u.id_rol, u.email, r.nombre_rol
        FROM sesiones_activas s
        JOIN usuarios u ON u.id_usuario = s.id_usuario
        JOIN roles r ON r.id_rol = u.id_rol
        WHERE s.token = :token
    """), {"token": token}).mappings().first()

    if not sesion:
        raise HTTPException(
            status_code=401,
            detail="ERR-06: Sesión no válida. Inicia sesión nuevamente."
        )

    if sesion["expira_en"] < datetime.now():
        db.execute(text("DELETE FROM sesiones_activas WHERE token = :token"), {"token": token})
        db.commit()
        raise HTTPException(
            status_code=401,
            detail="ERR-02: Sesión cerrada automáticamente por inactividad/expiración."
        )

    return {
        "id_usuario": sesion["id_usuario"],
        "id_rol": sesion["id_rol"],
        "rol": sesion["nombre_rol"],
        "email": sesion["email"],
        "token": token,
    }


def requerir_admin(usuario: dict = Depends(verificar_token)) -> dict:
    """RN-01: Solo Administradores pueden acceder a endpoints administrativos"""
    if usuario["rol"] != "Administrador":
        raise HTTPException(
            status_code=403,
            detail="Acceso restringido a personal administrativo."
        )
    return usuario


# ─── NUEVAS FUNCIONES PARA RN-01 ──────────────────────────────────────────────

def requerir_medico_general(usuario: dict = Depends(verificar_token)) -> dict:
    """
    RN-01: Exclusividad de rol profesional.
    Solo permite acceso a médicos generales (id_rol = 2).
    Un especialista no puede actuar como médico general.
    """
    if usuario.get("id_rol") != 2:  # 2 = Médico General
        raise HTTPException(
            status_code=403,
            detail="Acceso denegado. Solo médicos generales pueden realizar esta acción. (RN-01)"
        )
    return usuario


def requerir_medico_especialista(usuario: dict = Depends(verificar_token)) -> dict:
    """
    RN-01: Exclusividad de rol profesional.
    Solo permite acceso a médicos especialistas (id_rol = 3).
    Un médico general no puede actuar como especialista.
    """
    if usuario.get("id_rol") != 3:  # 3 = Médico Especialista
        raise HTTPException(
            status_code=403,
            detail="Acceso denegado. Solo médicos especialistas pueden realizar esta acción. (RN-01)"
        )
    return usuario


def requerir_medico(usuario: dict = Depends(verificar_token)) -> dict:
    """
    Permite acceso a cualquier médico (General o Especialista).
    Usar en endpoints que ambos roles pueden usar (ej: ver agenda, ver signos).
    """
    if usuario.get("id_rol") not in [2, 3]:  # 2 = General, 3 = Especialista
        raise HTTPException(
            status_code=403,
            detail="Acceso denegado. Se requiere rol de médico."
        )
    return usuario