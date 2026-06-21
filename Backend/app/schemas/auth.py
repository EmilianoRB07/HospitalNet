# app/schemas/auth.py
from pydantic import BaseModel

# Esquema para validar los datos que entran desde el Login de React
class LoginRequest(BaseModel):
    username: str
    password: str