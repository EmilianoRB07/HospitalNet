# app/models/usuario.py
from sqlalchemy import Column, Integer, String
from app.database import Base

class UsuarioModel(Base):
    __tablename__ = "usuarios"

    # Ajustado a las columnas reales de tu tabla usuarios
    id_usuario = Column(String(50), primary_key=True, index=True)
    nombre_usuario = Column(String(100), nullable=False)
    contrasena = Column(String(255), nullable=False)
    rol = Column(String(50), nullable=False)