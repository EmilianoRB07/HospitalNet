# Manual de Usuario - HospitalNet

## 1. Introducción

HospitalNet es un sistema de gestión hospitalaria diseñado para médicos generales y especialistas. Este manual explica cómo usar las funciones principales del sistema.

---

## 2. Acceso al Sistema

### 2.1 Iniciar Sesión

1. Abre el navegador y ve a: `http://localhost:5173`
2. Ingresa tu **email** y **contraseña**
3. Resuelve el **CAPTCHA** (escribe el código que ves en la imagen)
4. Haz clic en **"Ingresar"**

![Pantalla de inicio de sesión](./evidencias/P-21_login_exitoso.png)
*Figura 1. Pantalla de inicio de sesión*

### 2.2 Credenciales de Prueba

| Usuario | Email | Contraseña | Rol |
|---------|-------|------------|-----|
| Admin | admin@hospitalnet.com | Admin1234 | Administrador |
| Médico General | gsilva@hospitalnet.com | Admin1234 | Médico General |
| Médico Especialista | fmendez@hospitalnet.com | Admin1234 | Médico Especialista |

---

## 3. Médico General

### 3.1 Ver Agenda

1. Inicia sesión como médico general
2. En el menú principal, selecciona **"Mi agenda"**
3. Verás todas tus citas del día
4. Las citas con **pago pendiente** no se pueden abrir

![Agenda del médico](./evidencias/P-04_ver_agenda.png)
*Figura 2. Agenda diaria del médico*

### 3.2 Iniciar una Consulta

1. Selecciona una cita que tenga **estado "Pagado"**
2. Haz clic en **"Iniciar consulta"**
3. El expediente del paciente se desbloqueará automáticamente
4. Revisa los **signos vitales** precargados
5. Llena los campos obligatorios:
   - **Diagnóstico clínico**
   - **Código CIE-10**
   - **Notas de evolución**
   - **Tratamiento / Receta médica**
6. Haz clic en **"Finalizar consulta y guardar registro"**

![Consulta activa](./evidencias/P-06_consulta_pagada.png)
*Figura 3. Pantalla de consulta activa*

### 3.3 Generar Receta PDF

- Al finalizar la consulta, el sistema **genera automáticamente un PDF** de la receta
- El PDF se descarga en tu computadora
- También puedes generar la receta sin guardar la consulta usando el botón **"Descargar Receta PDF"**

![Receta médica en PDF](./evidencias/P-22_consulta_especializada.png)
*Figura 4. Ejemplo de receta médica en PDF*

### 3.4 Enviar Interconsulta

1. Durante una consulta, haz clic en **"Generar Interconsulta"**
2. Selecciona la **especialidad** del médico al que quieres derivar
3. Selecciona el **médico receptor**
4. Escribe el **motivo clínico** de la derivación
5. Haz clic en **"Enviar"**

![Envío de interconsulta](./evidencias/P-09_enviar_interconsulta.png)
*Figura 5. Envío de interconsulta*

### 3.5 Cancelar Cita

1. Ve a tu agenda
2. Selecciona la cita que quieres cancelar
3. Haz clic en **"Cancelar"**
4. Escribe el **motivo** de la cancelación
5. Haz clic en **"Confirmar"**

![Cancelación de cita](./evidencias/P-11_cancelar_cita.png)
*Figura 6. Cancelación de cita*

> ⚠️ **Nota:** Las citas de Medicina General que ya están **pagadas** no se pueden cancelar desde el consultorio. El paciente debe pasar a recepción.

---

## 4. Médico Especialista

### 4.1 Ver Agenda

1. Inicia sesión como médico especialista
2. En el menú principal, selecciona **"Mi agenda"**
3. Verás todas tus citas del día

### 4.2 Ver Interconsultas en Espera

1. En tu perfil, busca la sección **"Interconsultas en espera"**
2. Verás los pacientes derivados por médicos generales
3. Cada interconsulta muestra:
   - **Paciente** (nombre, edad, sexo)
   - **Médico emisor**
   - **Motivo de la derivación**
   - **Fecha de derivación**

![Interconsultas en espera](./evidencias/P-10_especialista_ve_interconsulta.png)
*Figura 7. Interconsultas pendientes para el especialista*

### 4.3 Iniciar Consulta Especializada

1. Selecciona una interconsulta o cita asignada
2. Haz clic en **"Iniciar revisión"** o **"Abrir consulta especializada"**
3. Revisa los resultados de laboratorio y estudios del paciente
4. Los **valores críticos** se muestran con ** (fuera de rango) o * (limítrofe)
5. Llena:
   - **Diagnóstico especializado**
   - **Tratamiento**
   - **Notas de evolución**
6. Haz clic en **"Finalizar"**

> 💰 **Importante:** Al finalizar una consulta de especialidad, el sistema genera automáticamente un cargo de **$1200** en cajas.

---

## 5. Funciones Generales

### 5.1 Signos Vitales

- Los signos vitales se **cargan automáticamente** desde enfermería
- Se muestran en la pantalla de consulta:
  - Frecuencia cardíaca (lpm)
  - Presión arterial (mmHg)
  - Temperatura (°C)
  - Peso y estatura
  - Índice de Masa Corporal (IMC)

### 5.2 Órdenes de Laboratorio

1. Durante una consulta, haz clic en el panel de **"Órdenes"**
2. Selecciona el tipo de estudio:
   - **Laboratorio**
   - **Imagenología**
3. Completa los datos de la prueba
4. La orden queda registrada en el expediente del paciente

### 5.3 Alertas de Urgencia

- Los médicos en urgencias reciben **alertas visuales inmediatas**
- Las alertas se muestran en la pantalla cuando un paciente crítico ingresa
- Los médicos pueden **atender** la alerta haciendo clic en el botón correspondiente

### 5.4 Reportes de Productividad

1. Ve al panel de **"Reportes"**
2. Selecciona el período que deseas consultar
3. Verás estadísticas separadas por:
   - Médico general
   - Médico especialista
   - Número de consultas por día/mes

![Reportes de productividad](./evidencias/P-24_reporte_productividad.png)
*Figura 8. Reportes de productividad*

---

## 6. Mensajes del Sistema

| Mensaje | Significado |
|---------|-------------|
| **MSG-01** | Inicio de sesión exitoso |
| **MSG-03** | Consulta guardada con éxito |
| **MSG-04** | Cita cancelada notificada |
| **MSG-05** | CAPTCHA incorrecto |
| **MSG-06** | Sesión cerrada por inactividad |
| **MSG-07** | Pago pendiente en cajas |
| **MSG-09** | Acceso denegado al expediente |
| **MSG-10** | Horario bloqueado por concurrencia |
| **MSG-11** | Interconsulta activa |

---

## 7. Solución de Problemas

### 7.1 No puedo iniciar sesión

- Verifica que el **CAPTCHA** sea correcto
- Revisa que el **email** y **contraseña** estén bien escritos
- Asegúrate de que el **servidor backend** esté corriendo

### 7.2 No puedo iniciar una consulta

- La cita debe tener **estado "Pagado"**
- Si es una cita de Medicina General sin pago, ve a **recepción** para pagar

### 7.3 No veo las interconsultas

- Solo los **especialistas** pueden ver interconsultas
- Las interconsultas aparecen en la sección **"Interconsultas en espera"**

### 7.4 La receta PDF no se descarga

- Verifica que el **backend** esté corriendo
- Revisa que tengas **ReportLab** instalado: `pip install reportlab`
- Asegúrate de haber completado todos los campos de la consulta

---

## 8. Contacto y Soporte

Para reportar problemas o solicitar ayuda:

- **Equipo de desarrollo:** ESCOM - IPN
- **Grupo:** 5CV1

---

**HospitalNet - Sistema de Gestión Hospitalaria**  
ESCOM - IPN | Ciclo 2026-2