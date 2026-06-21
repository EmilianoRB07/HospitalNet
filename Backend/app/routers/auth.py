# app/routers/auth.py - Versión final optimizada
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime, timedelta
import secrets
import bcrypt
from app.database import get_db

print(f"--- RUTA DEL ARCHIVO EJECUTÁNDOSE: {__file__} ---")

router = APIRouter(prefix="/auth", tags=["Autenticación"])

CAPTCHA_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
CAPTCHA_TTL_MIN = 5


def _crear_tabla_captcha(db: Session) -> None:
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS captcha_sesiones (
            captcha_id VARCHAR(64) PRIMARY KEY,
            codigo VARCHAR(10) NOT NULL,
            expira_en TIMESTAMP NOT NULL
        );
    """))
    db.commit()


@router.get("/captcha")
def generar_captcha(db: Session = Depends(get_db)):
    """RT-07: el código CAPTCHA nace y se valida en el servidor."""
    _crear_tabla_captcha(db)

    codigo = "".join(secrets.choice(CAPTCHA_CHARS) for _ in range(6))
    captcha_id = secrets.token_hex(16)
    expira = datetime.now() + timedelta(minutes=CAPTCHA_TTL_MIN)

    db.execute(text("""
        INSERT INTO captcha_sesiones (captcha_id, codigo, expira_en)
        VALUES (:id, :codigo, :expira)
    """), {"id": captcha_id, "codigo": codigo, "expira": expira})
    db.commit()

    return {"success": True, "captcha_id": captcha_id, "codigo": codigo}


class LoginRequest(BaseModel):
    email: str
    password: str
    captchaInput: str
    captchaId: str


@router.post("/login")
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    email = payload.email.strip()
    password = payload.password

    try:
        _crear_tabla_captcha(db)
        # NOTA: Ya no creamos sesiones_activas aquí, porque la crea crear_sesiones.py

        # Validación de CAPTCHA
        captcha = db.execute(text("""
            SELECT codigo, expira_en FROM captcha_sesiones WHERE captcha_id = :id
        """), {"id": payload.captchaId}).mappings().first()

        db.execute(text("DELETE FROM captcha_sesiones WHERE captcha_id = :id"),
                   {"id": payload.captchaId})
        db.commit()

        if not captcha:
            return {"success": False, "error": "ERR-01: CAPTCHA inválido o ya utilizado. Solicita uno nuevo."}
        if captcha["expira_en"] < datetime.now():
            return {"success": False, "error": "ERR-01: CAPTCHA expirado. Solicita uno nuevo."}
        if payload.captchaInput.strip().upper() != captcha["codigo"].strip().upper():
            return {"success": False, "error": "Código CAPTCHA incorrecto."}

        # Consulta de usuario
        query_usuario = text("""
            SELECT u.id_usuario, u.id_rol, u.password_hash, u.activo, r.nombre_rol,
                   m.nombre, m.especialidad, m.id_medico, u.email
            FROM usuarios u
            INNER JOIN roles r ON u.id_rol = r.id_rol
            LEFT JOIN medicos m ON LOWER(TRIM(u.email)) = LOWER(TRIM(m.correo_institucional))
            WHERE LOWER(TRIM(u.email)) = LOWER(:email)
        """)
        usuario = db.execute(query_usuario, {"email": email}).mappings().first()

        if not usuario:
            return {"success": False, "error": "Correo no registrado."}

        if not usuario['activo']:
            return {"success": False, "error": "Cuenta desactivada."}

        # Verificación de contraseña
        hash_bd = usuario['password_hash']
        
        if not hash_bd or len(hash_bd) < 20:
            return {"success": False, "error": "Error de autenticación. Contacte al administrador."}

        if hash_bd.startswith("$2y$"):
            hash_bd = "$2b$" + hash_bd[4:]

        try:
            valido = bcrypt.checkpw(password.encode('utf-8'), hash_bd.encode('utf-8'))
        except ValueError:
            valido = False

        if not valido:
            return {"success": False, "error": "Contraseña incorrecta."}

        # Generar token y sesión
        token = secrets.token_hex(32)
        expira = datetime.now() + timedelta(hours=8)

        db.execute(text("DELETE FROM sesiones_activas WHERE id_usuario = :uid"), 
                   {"uid": usuario['id_usuario']})

        db.execute(
            text("INSERT INTO sesiones_activas (token, id_usuario, expira_en) VALUES (:token, :uid, :expira)"),
            {"token": token, "uid": usuario['id_usuario'], "expira": expira}
        )
        
        db.commit()

        nombre_final = usuario['nombre'] if usuario['nombre'] else email.split('@')[0].capitalize()

        return {
            "success": True,
            "token": token,
            "rol": usuario['nombre_rol'],
            "id_rol": int(usuario['id_rol']),
            "id_medico": usuario['id_medico'],
            "nombre_completo": nombre_final,
            "especialidad": usuario['especialidad']
        }

    except Exception as e:
        db.rollback()
        print(f"Error en login: {str(e)}")
        return {"success": False, "error": f"Error BD: {str(e)}"}