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
    version: "2.0.0",     // ← Cambiar
    versionCode: 99,      // ← Cambiar a número alto
    downloadUrl: "https://google.com",
    releaseNotes: "🧪 PRUEBA DE ACTUALIZACIÓN\n\nEsta es una prueba del sistema.\n\n✨ Funciona correctamente!",
    mandatory: false,
  };

  // Enviar JSON
  res.json(versionInfo);
});

module.exports = router;