# crear_sesiones.py
from sqlalchemy import text
from app.database import engine

# Conectamos con PostgreSQL para inyectar la tabla que falta
try:
    with engine.connect() as conn:
        # Script SQL para estructurar la tabla de seguridad
        query = text("""
            CREATE TABLE IF NOT EXISTS sesiones_activas (
                id_sesion SERIAL PRIMARY KEY,
                token VARCHAR(255) NOT NULL,
                id_usuario INTEGER NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
                expira_en TIMESTAMP NOT NULL
            );
        """)
        conn.execute(query)
        conn.commit()
        
    print("¡Tabla 'sesiones_activas' creada con éxito y lista para operar!")
except Exception as e:
    print(f"Ocurrió un error: {e}")