require('dotenv').config({ path: '.env.test' });

// Estas pruebas borran sus colecciones. Solo se admiten bases locales de prueba.
const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/taller-test';
const testDatabase = /^mongodb:\/\/(?:localhost|127\.0\.0\.1):\d+\/[a-zA-Z0-9_-]*(?:test|tests)(?:\?.*)?$/.test(uri);
if (!testDatabase) throw new Error('Las pruebas requieren MongoDB local y una base terminada en test o tests.');
process.env.MONGODB_URI = uri;
process.env.JWT_SECRET = 'isolated-test-secret-not-for-production';
process.env.NODE_ENV = 'test';
