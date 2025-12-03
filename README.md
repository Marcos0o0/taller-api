# Sistema de Gestión de Taller Mecánico

Sistema backend para digitalizar la gestión de presupuestos y órdenes de trabajo de talleres mecánicos automotrices, con notificaciones automáticas por correo electrónico.

**Versión:** 1.0.0  
**Equipo:** Marcos Godoy, Álvaro Sandoval, Vicente Ortiz, Martín Valdebenito

---

## Tabla de Contenidos

- [Descripción](#descripción)
- [Características Principales](#características-principales)
- [Requisitos Previos](#requisitos-previos)
- [Instalación y Configuración](#instalación-y-configuración)
- [Uso](#uso)
- [Documentación API](#documentación-api)
- [Flujo de Trabajo](#flujo-de-trabajo)
- [Testing](#testing)
- [Despliegue en Producción](#despliegue-en-producción)
- [Solución de Problemas](#solución-de-problemas)
- [Tecnologías](#tecnologías)
- [Licencia](#licencia)

---

## Descripción

Sistema backend RESTful que permite a talleres mecánicos automatizar y digitalizar sus procesos operativos, eliminando el uso de papel y mejorando la comunicación con los clientes.

### Problema que Resuelve

Los talleres mecánicos tradicionales enfrentan:
- Gestión manual de presupuestos en papel
- Pérdida de documentación importante
- Clientes deben llamar constantemente para conocer el estado de su vehículo
- Falta de seguimiento y trazabilidad de las órdenes de trabajo
- Comunicación ineficiente entre administradores, mecánicos y clientes

### Solución

Este sistema digitaliza completamente el flujo de trabajo del taller, desde la creación del presupuesto hasta la entrega del vehículo, con notificaciones automáticas en cada etapa crítica.

---

## Características Principales

### Gestión de Presupuestos
- Creación digital de presupuestos con información detallada del vehículo
- Envío automático por correo electrónico al cliente
- Aprobación/rechazo con un solo clic desde el correo (sin necesidad de login)
- Tokens de seguridad con expiración para prevenir accesos no autorizados
- Validación de vigencia de presupuestos

### Órdenes de Trabajo
- Creación automática de órdenes al aprobar presupuestos
- Asignación de mecánicos con validación de disponibilidad
- Seguimiento de estados con historial completo
- Actualización de costos finales y trabajos adicionales
- Notificaciones automáticas cuando el vehículo está listo

### Gestión de Usuarios
- Sistema de autenticación JWT con tokens de acceso y refresh
- Roles diferenciados (Admin y Mecánico)
- Protección contra fuerza bruta (bloqueo temporal después de 5 intentos fallidos)
- Soft delete para mantener integridad de datos históricos

### Notificaciones
- Email automático al enviar presupuesto con botones de acción
- Email automático cuando el vehículo está listo para retirar
- Plantillas HTML responsive y profesionales
- Sistema de reintentos en caso de fallos de envío

### Seguridad
- Autenticación basada en JWT
- Rate limiting diferenciado por rol
- Helmet.js para headers de seguridad
- Validación exhaustiva de inputs
- Logging completo de todas las operaciones críticas

### Caché y Rendimiento
- Redis para caché de consultas frecuentes
- Invalidación inteligente de caché
- Optimización de queries con índices MongoDB
- Paginación en listados

---

## Requisitos Previos

### Software Requerido
- **Docker** v28.0 o superior
- **Docker Compose** v2.0 o superior

### Opcional (para desarrollo sin Docker)
- **Node.js** v18.0 o superior
- **MongoDB** v6.0 o superior
- **Redis** v7.0 o superior

### Servicios Externos
- Cuenta de Gmail con autenticación de 2 pasos (para envío de correos)
- ngrok (opcional, para pruebas con URLs públicas en desarrollo)

---

## Instalación y Configuración

### Instalación Rápida con Docker

#### 1. Clonar el repositorio
```bash
git clone https://github.com/marcos0o0/taller-api.git
cd taller-api
```

#### 2. Configurar variables de entorno
```bash
# Linux/Mac
cp .env.example .env
nano .env

# Windows
copy .env.example .env
code .env
```

#### 3. Configurar Gmail para envío de correos

**Paso 1: Habilitar Verificación en 2 Pasos**
1. Ir a [Cuenta de Google](https://myaccount.google.com)
2. Navegar a **Seguridad**
3. Habilitar **Verificación en 2 pasos**

**Paso 2: Generar Contraseña de Aplicación**
1. Ir a [Contraseñas de Aplicaciones](https://myaccount.google.com/apppasswords)
2. Seleccionar **Correo** y **Otro (nombre personalizado)**
3. Ingresar "Taller API"
4. Copiar la contraseña generada (16 caracteres)
5. Usar esta contraseña en `SMTP_PASS` del archivo `.env`

**Variables mínimas requeridas en `.env`:**
```env
# Autenticación (CAMBIAR en producción)
JWT_SECRET=tu-clave-secreta-minimo-32-caracteres-aqui

# SMTP - Gmail
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu-correo@gmail.com
SMTP_PASS=tu-contraseña-de-aplicacion-16-caracteres

# URL Base (cambiar según entorno)
FRONTEND_URL=http://localhost:3001

# Información del Taller
WORKSHOP_NAME=Taller Mecánico Automotriz
WORKSHOP_EMAIL=contacto@taller.com
WORKSHOP_PHONE=+56912345678
WORKSHOP_ADDRESS=Calle Principal 123, Ciudad
```

> **Ver todas las variables disponibles en `.env.example`**

#### 4. Iniciar servicios
```bash
docker-compose up -d
```

#### 5. Verificar que todo esté corriendo
```bash
docker-compose ps

# Deberías ver:
# taller_api    - Running
# taller_mongo  - Running  
# taller_redis  - Running
```

#### 6. Crear datos de prueba (opcional)
```bash
docker-compose exec api npm run seed
```

Esto crea:
- **Admin:** username: `admin`, password: `admin123`
- **Mecánicos:** username: `mechanic1` / `mechanic2`, password: `mech123`
- 6 clientes de ejemplo
- 5 presupuestos con diferentes estados

**IMPORTANTE:** Cambiar estas credenciales inmediatamente en producción.

**API disponible en:** `http://localhost:3001`

---

### Configuración para Desarrollo Local (ngrok)

Para que los botones en los correos funcionen durante desarrollo local:

#### Instalación de ngrok
```bash
# Windows
choco install ngrok

# macOS
brew install ngrok

# Linux
curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc
echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | sudo tee /etc/apt/sources.list.d/ngrok.list
sudo apt update && sudo apt install ngrok
```

#### Uso
```bash
# 1. Registrarse en https://ngrok.com/signup (gratuito)

# 2. Autenticar
ngrok config add-authtoken TU_TOKEN_AQUI

# 3. Iniciar túnel
ngrok http 3001

# 4. Copiar URL HTTPS (ej: https://abc123.ngrok.io)

# 5. Actualizar .env
FRONTEND_URL=https://abc123.ngrok.io

# 6. Reiniciar
docker-compose restart api
```

> **Nota:** En plan gratuito, la URL cambia cada vez que reinicias ngrok.

---

### Instalación sin Docker (Desarrollo)

```bash
# 1. Instalar dependencias
npm install

# 2. Asegurar MongoDB y Redis corriendo localmente
# MongoDB en puerto 27017
# Redis en puerto 6379

# 3. Configurar .env con URLs locales
MONGODB_URI=mongodb://localhost:27017/taller
REDIS_URL=redis://localhost:6379

# 4. Iniciar servidor
npm run dev
```

---

## Uso

### Comandos Docker

```bash
# Iniciar servicios
docker-compose up -d

# Ver logs en tiempo real
docker-compose logs -f              # Todos
docker-compose logs -f api          # Solo API
docker-compose logs --tail=100 api  # Últimas 100 líneas

# Estado de servicios
docker-compose ps

# Reiniciar servicios
docker-compose restart              # Todos
docker-compose restart api          # Solo API

# Detener servicios
docker-compose stop

# Eliminar todo (borra datos)
docker-compose down -v

# Reconstruir después de cambios
docker-compose up -d --build

# Acceder a contenedor
docker-compose exec api bash
```

### Scripts NPM

```bash
# Desarrollo
npm run dev          # Servidor con auto-reload

# Producción
npm start            # Servidor normal

# Base de datos
npm run seed         # Crear datos de prueba
npm run db:clean     # Limpiar base de datos

# Testing
npm test                  # Todos los tests
npm run test:coverage     # Con cobertura
npm run test:watch        # Modo watch

# Calidad de código
npm run lint         # Verificar código
```

---

## Documentación API

### Base URL
```
http://localhost:3001/api
```

### Autenticación

La mayoría de endpoints requieren JWT en header:
```
Authorization: Bearer <tu-token-jwt>
```

### Endpoints Principales

#### Autenticación

**Login**
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc...",
    "user": {
      "_id": "...",
      "username": "admin",
      "role": "admin"
    }
  }
}
```

**Otros endpoints de auth:**
- `POST /api/auth/refresh` - Renovar token
- `POST /api/auth/logout` - Cerrar sesión
- `GET /api/auth/me` - Usuario actual

---

#### Clientes

```http
GET    /api/clients                    # Listar
POST   /api/clients                    # Crear
GET    /api/clients/:id                # Obtener
PUT    /api/clients/:id                # Actualizar
DELETE /api/clients/:id                # Eliminar (soft)
GET    /api/clients/:id/history        # Historial
```

**Ejemplo - Crear cliente:**
```json
POST /api/clients
{
  "firstName": "Juan",
  "lastName1": "Pérez",
  "lastName2": "González",
  "phone": "+56912345678",
  "email": "juan.perez@example.com"
}
```

---

#### Presupuestos

```http
GET    /api/quotes                     # Listar
POST   /api/quotes                     # Crear
GET    /api/quotes/:id                 # Obtener
PUT    /api/quotes/:id                 # Actualizar
DELETE /api/quotes/:id                 # Eliminar (soft)
POST   /api/quotes/:id/send-email      # Enviar por email
PUT    /api/quotes/:id/approve         # Aprobar (admin)
PUT    /api/quotes/:id/reject          # Rechazar (admin)
```

**Endpoints públicos (sin autenticación):**
```http
GET /api/quotes/:id/approve?token=xxx  # Aprobar (cliente)
GET /api/quotes/:id/reject?token=xxx   # Rechazar (cliente)
```

**Ejemplo - Crear presupuesto:**
```json
POST /api/quotes
{
  "clientId": "507f1f77bcf86cd799439011",
  "vehicle": {
    "brand": "Toyota",
    "model": "Corolla",
    "year": 2020,
    "licensePlate": "ABC123",
    "mileage": 50000
  },
  "description": "Ruidos extraños en el motor al acelerar",
  "proposedWork": "Revisión completa del motor, cambio de aceite",
  "estimatedCost": 150000,
  "notes": "Cliente solicita urgencia"
}
```

---

#### Órdenes de Trabajo

```http
GET    /api/orders                     # Listar
GET    /api/orders/:id                 # Obtener
PUT    /api/orders/:id                 # Actualizar detalles
PUT    /api/orders/:id/status          # Cambiar estado
PUT    /api/orders/:id/assign          # Asignar mecánico (admin)
DELETE /api/orders/:id                 # Eliminar (solo pendiente_asignacion)
```

**Estados de orden:**
- `pendiente_asignacion` - Sin mecánico
- `asignada` - Mecánico asignado
- `en_progreso` - En reparación
- `listo` - Terminada (envía email automático)
- `entregado` - Entregada al cliente

**Ejemplo - Cambiar estado:**
```json
PUT /api/orders/:id/status
{
  "status": "listo",
  "notes": "Reparación completada"
}
```

---

#### Otros Módulos

**Mecánicos:**
```http
GET    /api/mechanics                  # Listar
POST   /api/mechanics                  # Crear
GET    /api/mechanics/:id              # Obtener
PUT    /api/mechanics/:id              # Actualizar
GET    /api/mechanics/:id/orders       # Órdenes del mecánico
```

**Usuarios:**
```http
GET    /api/users                      # Listar
POST   /api/users                      # Crear
GET    /api/users/:id                  # Obtener
PUT    /api/users/:id                  # Actualizar
PUT    /api/users/:id/password         # Cambiar contraseña
PUT    /api/users/:id/toggle-status    # Activar/Desactivar
DELETE /api/users/:id                  # Eliminar (soft)
```

**Dashboard:**
```http
GET /api/dashboard/stats               # Estadísticas generales
GET /api/dashboard/mechanics-stats     # Por mecánico
GET /api/dashboard/recent-activity     # Actividad reciente
GET /api/dashboard/trends              # Tendencias (7 días)
```

**Logs:**
```http
GET /api/logs?level=error&module=auth  # Logs del sistema
```

---

### Códigos de Respuesta

| Código | Significado |
|--------|-------------|
| 200 | OK - Solicitud exitosa |
| 201 | Created - Recurso creado |
| 400 | Bad Request - Datos inválidos |
| 401 | Unauthorized - No autenticado |
| 403 | Forbidden - Sin permisos |
| 404 | Not Found - Recurso no encontrado |
| 409 | Conflict - Duplicado |
| 423 | Locked - Cuenta bloqueada |
| 429 | Too Many Requests - Rate limit |
| 500 | Internal Server Error |

### Formato de Respuestas

**Éxito:**
```json
{
  "success": true,
  "data": { ... },
  "message": "Operación exitosa"
}
```

**Error:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Descripción del error",
    "details": [
      {
        "field": "email",
        "message": "Email no válido"
      }
    ]
  }
}
```

---

## Flujo de Trabajo

### Diagrama de Estados

```
Presupuesto Creado
        |
        v
Enviado por Email
        |
        v
    Cliente Decide
        |
   /---------\
   |         |
Aprueba  Rechaza
   |         |
   v         v
Orden     FIN
Creada
   |
   v
Pendiente → Asignada → En Progreso → Listo → Entregado
```

### Proceso Paso a Paso

1. **Recepción del Cliente**
   - Cliente llega con su vehículo
   - Admin registra cliente (si es nuevo)

2. **Crear Presupuesto**
   ```bash
   POST /api/quotes
   ```
   - Sistema genera número único (PRES-XXXX)

3. **Enviar por Email**
   ```bash
   POST /api/quotes/:id/send-email
   ```
   - Cliente recibe email con botones

4. **Cliente Aprueba**
   - Clic en "Aprobar" desde email
   - Sistema crea orden automáticamente (ORD-XXXX)

5. **Asignar Mecánico**
   ```bash
   PUT /api/orders/:id/assign
   ```
   - Estado: `pendiente_asignacion` → `asignada`

6. **Mecánico Trabaja**
   ```bash
   PUT /api/orders/:id/status
   { "status": "en_progreso" }
   ```

7. **Finalizar Trabajo**
   ```bash
   PUT /api/orders/:id/status
   { "status": "listo" }
   ```
   - **Sistema envía email automático al cliente**

8. **Entregar Vehículo**
   ```bash
   PUT /api/orders/:id/status
   { "status": "entregado" }
   ```

---

## Testing

### Ejecutar Tests

```bash
# Todos los tests
npm test

# Con cobertura
npm run test:coverage

# Modo watch
npm run test:watch

# Tests específicos
npm test -- tests/integration
npm test -- tests/unit
npm test -- tests/smoke
```

### Tests Disponibles

**Unitarios:**
- User Model: Creación, validación, autenticación, bloqueo

**Integración:**
- Auth API: Login, logout, refresh token

**Smoke:**
- Flujo completo: Crear cliente → Entregar vehículo

---

## Despliegue en Producción

### Checklist Pre-Despliegue

- [ ] Generar `JWT_SECRET` aleatorio de 32+ caracteres
- [ ] Cambiar credenciales por defecto (admin/admin123)
- [ ] Configurar dominio con HTTPS/SSL
- [ ] Configurar SMTP con credenciales de producción
- [ ] Configurar firewall (solo 443, 22)
- [ ] Configurar backups automáticos
- [ ] Configurar monitoreo de logs

### Instalación en Servidor

```bash
# 1. Clonar repositorio
git clone https://github.com/marcos0o0/taller-api.git
cd taller-api

# 2. Configurar .env (usar .env.example como base)
cp .env.example .env
nano .env

# Variables críticas:
# JWT_SECRET=<generar-con-openssl-rand-base64-32>
# FRONTEND_URL=https://tudominio.com
# SMTP_USER=tu-correo-produccion@gmail.com
# SMTP_PASS=tu-password-aplicacion

# 3. Iniciar servicios
docker-compose up -d

# 4. Crear admin y cambiar password inmediatamente
docker-compose exec api npm run seed
# Luego: PUT /api/users/:id/password

# 5. Verificar
curl https://tudominio.com/health
```

### Actualizar en Producción

```bash
# 1. Backup
/root/backup-taller.sh

# 2. Actualizar código
git pull origin main

# 3. Reconstruir
docker-compose down
docker-compose up -d --build

# 4. Verificar
docker-compose ps
curl https://tudominio.com/health
```

---

## Solución de Problemas

### El servidor no inicia

**Verificar servicios:**
```bash
docker-compose ps
docker-compose logs api
```

**Puerto en uso:**
```bash
# Ver qué usa el puerto
netstat -ano | findstr :3001  # Windows
lsof -i :3001                  # Linux/Mac

# Cambiar puerto en .env si es necesario
PORT=3002
```

---

### Los correos no se envían

**Diagnóstico:**
```bash
# Ver configuración
docker-compose exec api node -e "console.log(process.env.SMTP_USER)"

# Ver logs de email
docker-compose logs api | grep email

# Probar conexión SMTP
docker-compose exec api node -e "
const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});
transporter.verify()
  .then(() => console.log('SMTP OK'))
  .catch(console.error);
"
```

**Soluciones comunes:**
- Verificar que `SMTP_PASS` sea contraseña de aplicación (16 caracteres)
- Confirmar verificación en 2 pasos habilitada en Gmail
- Revisar que `SMTP_USER` sea correcto

---

### Los botones del email no funcionan

**Causa:** `FRONTEND_URL` incorrecta

**Solución:**
- **Desarrollo:** Usar ngrok (ver [Configuración para Desarrollo Local](#configuración-para-desarrollo-local-ngrok))
- **Producción:** Usar dominio real con HTTPS
  ```env
  FRONTEND_URL=https://tudominio.com
  ```

---

### Error de conexión a MongoDB

```bash
# Reiniciar limpio
docker-compose down -v
docker-compose up -d
```

---

### Redis no disponible

No es crítico, el sistema funciona sin caché (solo más lento).

```bash
# Si deseas Redis:
docker-compose restart redis
docker-compose logs redis
```

---

### Tokens de presupuesto no funcionan

**Verificar:**
```bash
curl http://localhost:3001/api/quotes/<ID> \
  -H "Authorization: Bearer <token>"
```

**Revisar:**
- `status` debe ser `"pending"`
- `validUntil` debe ser fecha futura
- `approvalTokens[].used` debe ser `false`

**Causas comunes:**
- Token ya usado (solo 1 uso)
- Presupuesto expirado (7 días validez)
- Presupuesto ya procesado

---

### Error al hacer seed

```bash
# Limpiar primero
docker-compose exec api npm run db:clean

# Luego seed
docker-compose exec api npm run seed
```

---

## Tecnologías

### Backend
- **Node.js** v18+ - Runtime
- **Express** v4.18+ - Framework web
- **MongoDB** v6.0+ - Base de datos
- **Mongoose** v7.6+ - ODM
- **Redis** v7.0+ - Caché
- **JWT** - Autenticación
- **bcryptjs** - Hash de passwords
- **Nodemailer** - Envío de emails

### Seguridad
- **helmet** - Headers seguros
- **express-rate-limit** - Rate limiting
- **express-validator** - Validación
- **uuid** - Tokens únicos

### DevOps
- **Docker** v28+ - Contenedores
- **Docker Compose** v2+ - Orquestación

### Testing
- **Jest** - Framework de testing
- **Supertest** - Testing de APIs

---

## Arquitectura

### Estructura del Proyecto

```
taller-api/
├── src/
│   ├── config/           # DB, Redis
│   ├── controllers/      # Lógica de endpoints
│   ├── middlewares/      # Auth, validación
│   ├── models/           # Schemas Mongoose
│   ├── routes/           # Definición de rutas
│   ├── services/         # Email, caché
│   ├── utils/            # Logger, helpers
│   ├── app.js            # Config Express
│   └── server.js         # Entry point
├── tests/                # Tests
├── logs/                 # Log files
├── .env                  # Variables (no en Git)
├── docker-compose.yml    # Orquestación
└── package.json          # Dependencias
```

### Patrón MVC

- **Models:** Mongoose schemas con validaciones
- **Controllers:** Lógica de negocio
- **Routes:** Endpoints y middlewares
- **Services:** Email, caché (reutilizables)

### Base de Datos

**MongoDB - Colecciones:**
- `users` - Admin/mecánicos
- `clients` - Clientes del taller
- `quotes` - Presupuestos (con workOrder embebido)
- `mechanics` - Perfiles de mecánicos
- `systemlogs` - Auditoría completa

**Redis - Caché:**
- Listados (clientes, presupuestos, órdenes)
- Estadísticas dashboard
- TTL configurable

---

## Recursos Adicionales

### Documentación
- [Express.js](https://expressjs.com/)
- [Mongoose](https://mongoosejs.com/)
- [JWT Best Practices](https://jwt.io/introduction)
- [Docker](https://docs.docker.com/)
- [Nodemailer](https://nodemailer.com/)

---

## Licencia

MIT License - Ver archivo `LICENSE` para detalles.

---

## Contacto

### Equipo de Desarrollo
- **Marcos Godoy**
- **Álvaro Sandoval**
- **Vicente Ortiz**
- **Martín Valdebenito**

### Reportar Issues
[GitHub Issues](https://github.com/marcos0o0/taller-api/issues)

---

## FAQ

**¿Puedo usar sin Docker?**  
Sí, con Node.js + MongoDB + Redis locales.

**¿Cómo cambio el puerto?**  
Modifica `PORT` en `.env` y `docker-compose.yml`.

**¿Puedo usar otro SMTP?**  
Sí, configura `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` para tu proveedor.

**¿Cómo escalo el sistema?**
```bash
docker-compose up -d --scale api=3
```
+ Balanceador de carga + MongoDB Replica Set + Redis Cluster

---

**¡Gracias por usar el Sistema de Gestión de Taller Mecánico!**