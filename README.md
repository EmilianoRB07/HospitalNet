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

## 🚀 Instalación Rápida

### Requisitos
- Python 3.10+
- Node.js 18+
- PostgreSQL 14+

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
# Copiar .env.example a .env y configurar
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000