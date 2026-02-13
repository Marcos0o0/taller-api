// routes/appVersion.routes.js
// Ruta para servir información de la versión de la app

const express = require('express');
const router = express.Router();

/**
 * GET /api/app-version.json
 * Endpoint que retorna la información de la última versión de la app
 */
router.get('/app-version.json', (req, res) => {
  // ✅ Esta información la actualizas cada vez que sacas una nueva versión
  const versionInfo = {
    version: "1.0.0",           // Versión en formato legible (1.0.0, 1.1.0, etc.)
    versionCode: 1,             // Número entero que SIEMPRE incrementa (1, 2, 3, 4...)
    
    // URL donde está el APK - Opciones:
    // 1. GitHub Releases (Recomendado)
    downloadUrl: "https://github.com/TU-USUARIO/TU-REPO/releases/download/v1.0.0/taller-portezuelo.apk",
    
    // 2. O servirlo desde tu propio servidor Railway (ver más abajo)
    // downloadUrl: "https://taller-api-production-2c62.up.railway.app/downloads/taller-portezuelo-v1.0.0.apk",
    
    // Notas de la versión - Lo que el usuario verá
    releaseNotes: `
🎉 Primera versión oficial

✨ Funcionalidades:
• Gestión de clientes
• Presupuestos
• Órdenes de trabajo
• Inventario de repuestos
• Sistema de alertas

📱 Instalación limpia y rápida
    `.trim(),
    
    // Actualización obligatoria? 
    // true = el usuario DEBE actualizar (no puede cerrar el diálogo)
    // false = el usuario puede elegir "Más tarde"
    mandatory: false,
    
    // Versión mínima requerida (opcional)
    // Si un usuario tiene una versión menor, se le obliga a actualizar
    minVersion: "1.0.0"
  };

  // Enviar JSON
  res.json(versionInfo);
});

module.exports = router;