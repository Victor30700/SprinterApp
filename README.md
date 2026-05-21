# ⚡ SprinterApp: Ecosistema Integral para el Atleta de Alto Rendimiento

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi)
![Next.js](https://img.shields.io/badge/Next.js-15-000000?logo=next.js)
![Firebase](https://img.shields.io/badge/Firebase-Auth%20%7C%20Firestore-FFCA28?logo=firebase)

**SprinterApp** es una plataforma tecnológica diseñada específicamente para velocistas y atletas de pista. Combina seguimiento de rendimiento, análisis biomecánico asistido por IA y gestión de salud en una solución robusta y escalable.

---

## 🚀 Módulos del Proyecto

El ecosistema se divide en tres pilares fundamentales:

### 1. 📱 AppAtleta (Frontend)
Aplicación web progresiva para los atletas.
- **Seguimiento de Rendimiento:** Registro detallado de entrenamientos de pista y gimnasio.
- **Análisis de Video con IA:** Herramientas para cargar y analizar la técnica de carrera.
- **Health Profile:** Gestión de lesiones, peso corporal e historial antropométrico.
- **Coach IA:** Integración con ChatGPT para asesoramiento personalizado (Acceso Premium).
- **Calendario de Eventos:** Planificación y visualización de competencias.

### 2. ⚙️ Atletismo Backend (API & AI Service)
El motor de procesamiento desarrollado en FastAPI.
- **Procesamiento de Datos:** Gestión eficiente de registros deportivos.
- **Integración IA:** Backend optimizado para tareas de visión por computadora y análisis de datos con TensorFlow.
- **Seguridad:** Autenticación y gestión de datos mediante Firebase Admin SDK.

### 3. 🛡️ Sprinter App Admin (Panel de Control)
Dashboard administrativo desarrollado en Next.js.
- **Gestión de Usuarios:** Control total sobre la base de atletas y perfiles.
- **Monitoreo:** Supervisión de la actividad en la plataforma.

---

## 🛠️ Tecnologías Utilizadas

| Componente | Tecnologías Principales |
| :--- | :--- |
| **Frontend** | React 19, Vite, Tailwind CSS, Chart.js, Recharts, Framer Motion |
| **Backend** | FastAPI, Python 3.10+, TensorFlow, Pandas, NumPy, Pydantic |
| **Admin** | Next.js 15, SWR, Tailwind CSS |
| **Infraestructura** | Firebase (Auth, Firestore, Messaging, Storage) |

---

## 📋 Requisitos Previos

- **Node.js** (v18 o superior)
- **Python** (v3.10 o superior)
- **Cuenta de Firebase** con un proyecto configurado.
- **API Key de OpenAI** (para el módulo de Coach IA).

---

## 🔧 Instalación y Configuración

### Backend (atletismo_backend)
1. Navega a la carpeta: `cd atletismo_backend`
2. Crea un entorno virtual: `python -m venv venv`
3. Activa el entorno:
   - Windows: `.\venv\Scripts\activate`
   - Linux/Mac: `source venv/bin/activate`
4. Instala dependencias: `pip install -r requirements.txt`
5. Configura tu archivo `.env` con las credenciales de Firebase y OpenAI.
6. Ejecuta: `uvicorn app.main:app --reload`

### Frontend (appatleta)
1. Navega a la carpeta: `cd appatleta`
2. Instala dependencias: `npm install`
3. Configura el archivo `.env` con las claves de Firebase.
4. Ejecuta: `npm run dev`

### Admin (sprinter-app-admin)
1. Navega a la carpeta: `cd sprinter-app-admin`
2. Instala dependencias: `npm install`
3. Ejecuta: `npm run dev`

---

## 📈 Roadmap

- [ ] Implementación de análisis biomecánico en tiempo real.
- [ ] Integración con dispositivos wearables (Garmin, Apple Watch).
- [ ] Módulo de nutrición deportiva asistido por IA.
- [ ] App móvil nativa con Flutter.

---

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Consulta el archivo `LICENSE` para más detalles.

---

Desarrollado con ❤️ para la comunidad de atletismo.
