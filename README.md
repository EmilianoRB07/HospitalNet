# 🏥 HospitalNet - Sistema de Gestión Hospitalaria

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115.6-009688?logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18.3.1-61DAFB?logo=react)](https://reactjs.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql)](https://www.postgresql.org)

## 📋 Descripción

HospitalNet es un sistema centralizado de gestión clínica y administrativa diseñado para un hospital privado de especialidades de segundo nivel. Automatiza los flujos de trabajo de médicos generales y especialistas, reemplazando procesos basados en papel por una plataforma digital segura e integrada.

## ✨ Características Principales

- 🔐 **Autenticación Segura:** CAPTCHA en servidor + JWT
- 📅 **Agenda y Concurrencia:** Sin doble agendamiento
- 🩺 **Consulta Activa:** Acceso al expediente solo durante consulta
- 🤝 **Interconsultas:** Derivación entre especialidades
- 📄 **PDF de Recetas:** Generación en servidor
- 🔬 **Órdenes:** Laboratorio con marcado de valores críticos (** y *)
- 💰 **Reglas Financieras:** Pago previo ($500) y diferido ($1200)
- 📊 **Reportes:** Productividad por médico

## 🛠️ Tecnologías

| Capa | Tecnología |
|------|------------|
| **Backend** | FastAPI, Python, SQLAlchemy, PostgreSQL |
| **Frontend** | React, TypeScript, Vite |
| **Seguridad** | bcrypt, JWT, CAPTCHA |

## 📋 Requisitos Previos

- Python 3.10+
- Node.js 18+
- PostgreSQL 14+
- Git

## 🚀 Instalación y Ejecución

### 1. Clonar el repositorio
```bash
git clone https://github.com/EmilianoRB07/HospitalNet.git
cd HospitalNet
```

### 2. Configurar la Base de Datos
```bash
# Crear la base de datos en PostgreSQL
psql -U postgres -c "CREATE DATABASE hospitalnet_db;"
# Ejecutar el script de creación
psql -U postgres -d hospitalnet_db -f database/hospitalnet_bd
```

### 3. Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
# Crear archivo .env con:
# DATABASE_URL=postgresql://postgres:admin@localhost:5432/hospitalnet_db
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
El backend estará en: `http://localhost:8000`
```


### 4. Frontend
```bash
cd frontend
npm install
npm run dev
El frontend estará en: `http://localhost:5173`
```

## 🔑 Credenciales de Prueba

| Usuario | Email | Contraseña | Rol |
|---------|-------|------------|-----|
| Admin | admin@hospitalnet.com | Admin1234 | Administrador |
| Médico General | medico@hospitalnet.com | Admin1234 | Médico General |
| Médico Especialista | aramirez@hospitalnet.com | Admin1234 | Médico Especialista |

## 📁 Estructura del Proyecto

```
HospitalNet/
├── backend/           # API FastAPI
├── frontend/          # React + TypeScript
├── database/          # Scripts SQL
│   └── hospitalnet_bd
├── docs/              # Documentación
│   ├── pruebas.md
│   ├── diagrama_bd.png
│   └── evidencias/
└── README.md
```

## 👥 Equipo de Desarrollo

- **Galeana Garcia Ariana**
- **Macias Martinez Arturo Yael**
- **Ramirez Blanco Emiliano**
- **Vargas Hernández Keila**

**Grupo:** 5CV1 | **Ciclo:** 2026-2 | **ESCOM - IPN**

## 📄 Licencia

MIT License - ver el archivo [LICENSE](LICENSE)