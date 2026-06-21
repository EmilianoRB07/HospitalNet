from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import auth, medicos, agenda, dashboard, clinica

app = FastAPI(title="HospitalNet API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(medicos.router)
app.include_router(agenda.router)
app.include_router(dashboard.router)
app.include_router(clinica.router)

@app.get("/")
def root():
    return {"mensaje": "HospitalNet operativo"}