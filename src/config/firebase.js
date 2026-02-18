// config/firebase.js
const admin = require('firebase-admin');
const path = require('path');

let firebaseInitialized = false;

const initializeFirebase = () => {
  if (firebaseInitialized) {
    return admin;
  }

  try {
    // Opción 1: Desde archivo (desarrollo local)
    const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');
    const fs = require('fs');

    if (fs.existsSync(serviceAccountPath)) {
      const serviceAccount = require('./serviceAccountKey.json');
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      
      console.log('✅ Firebase Admin inicializado desde archivo');
    } 
    // Opción 2: Desde variable de entorno (Railway/producción)
    else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      
      console.log('✅ Firebase Admin inicializado desde variable de entorno');
    } else {
      console.warn('⚠️ Firebase Admin: No se encontró configuración');
      console.warn('   Opciones:');
      console.warn('   1. Coloca serviceAccountKey.json en config/');
      console.warn('   2. Configura FIREBASE_SERVICE_ACCOUNT en variables de entorno');
      return null;
    }

    firebaseInitialized = true;
    return admin;

  } catch (error) {
    console.error('❌ Error inicializando Firebase Admin:', error.message);
    return null;
  }
};

module.exports = { initializeFirebase, admin };