require('dotenv').config();
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const util = require('util');

const execPromise = util.promisify(exec);

const BACKUP_DIR = path.join(process.cwd(), 'backups');
const MAX_BACKUPS = 7; // Mantener últimos 7 backups

/**
 * Crear backup de MongoDB
 */
async function createBackup() {
  try {
    console.log('Iniciando backup de MongoDB...\n');

    // Crear directorio de backups si no existe
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
      console.log('Directorio de backups creado\n');
    }

    // Generar nombre del backup con timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const backupName = `backup-${timestamp}`;
    const backupPath = path.join(BACKUP_DIR, backupName);

    // Extraer información de la URI de MongoDB
    const mongoUri = process.env.MONGODB_URI;
    let host, port, database;

    if (mongoUri.includes('mongodb://')) {
      // MongoDB local
      const match = mongoUri.match(/mongodb:\/\/([^:]+):(\d+)\/(.+)/);
      if (match) {
        host = match[1];
        port = match[2];
        database = match[3];
      }
    } else if (mongoUri.includes('mongodb+srv://')) {
      // MongoDB Atlas - usar mongodump con URI completa
      console.log('Detectado MongoDB Atlas\n');
      const command = `mongodump --uri="${mongoUri}" --out="${backupPath}"`;
      
      console.log('Ejecutando backup...');
      const { stdout, stderr } = await execPromise(command);
      
      if (stderr && !stderr.includes('writing')) {
        console.error('Advertencias:', stderr);
      }
      
      console.log('Backup completado exitosamente\n');
      console.log(`Ubicación: ${backupPath}`);
      
      // Comprimir backup
      await compressBackup(backupPath, backupName);
      
      // Limpiar backups antiguos
      await cleanOldBackups();
      
      return backupPath;
    }

    // Para MongoDB local
    if (host && port && database) {
      const command = `mongodump --host ${host} --port ${port} --db ${database} --out "${backupPath}"`;
      
      console.log('Ejecutando backup...');
      const { stdout, stderr } = await execPromise(command);
      
      if (stderr && !stderr.includes('writing')) {
        console.error('Advertencias:', stderr);
      }
      
      console.log('Backup completado exitosamente\n');
      console.log(`Ubicación: ${backupPath}`);
      
      // Comprimir backup
      await compressBackup(backupPath, backupName);
      
      // Limpiar backups antiguos
      await cleanOldBackups();
      
      return backupPath;
    } else {
      throw new Error('No se pudo parsear MONGODB_URI');
    }

  } catch (error) {
    console.error('Error creando backup:', error.message);
    
    // Detalles adicionales
    if (error.message.includes('mongodump')) {
      console.error('\n Asegúrate de tener MongoDB Database Tools instalado:');
      console.error('   https://www.mongodb.com/try/download/database-tools\n');
    }
    
    throw error;
  }
}

/**
 * Comprimir backup
 */
async function compressBackup(backupPath, backupName) {
  try {
    console.log('\nComprimiendo backup...');
    
    const tarPath = path.join(BACKUP_DIR, `${backupName}.tar.gz`);
    const command = process.platform === 'win32'
      ? `tar -czf "${tarPath}" -C "${BACKUP_DIR}" "${backupName}"`
      : `tar -czf "${tarPath}" -C "${BACKUP_DIR}" "${backupName}"`;
    
    await execPromise(command);
    
    // Calcular tamaño
    const stats = fs.statSync(tarPath);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    
    console.log(`Backup comprimido: ${backupName}.tar.gz (${sizeMB} MB)`);
    
    // Eliminar carpeta sin comprimir
    fs.rmSync(backupPath, { recursive: true, force: true });
    
  } catch (error) {
    console.error('Error comprimiendo backup:', error.message);
  }
}

/**
 * Limpiar backups antiguos (mantener solo los últimos MAX_BACKUPS)
 */
async function cleanOldBackups() {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(file => file.startsWith('backup-') && file.endsWith('.tar.gz'))
      .map(file => ({
        name: file,
        path: path.join(BACKUP_DIR, file),
        time: fs.statSync(path.join(BACKUP_DIR, file)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time);

    if (files.length > MAX_BACKUPS) {
      console.log(`\n Limpiando backups antiguos (manteniendo ${MAX_BACKUPS})...`);
      
      const toDelete = files.slice(MAX_BACKUPS);
      for (const file of toDelete) {
        fs.unlinkSync(file.path);
        console.log(` Eliminado: ${file.name}`);
      }
    }
  } catch (error) {
    console.error('Error limpiando backups antiguos:', error.message);
  }
}

/**
 * Listar backups existentes
 */
function listBackups() {
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      console.log('No hay backups disponibles\n');
      return [];
    }

    const files = fs.readdirSync(BACKUP_DIR)
      .filter(file => file.startsWith('backup-') && file.endsWith('.tar.gz'))
      .map(file => {
        const filePath = path.join(BACKUP_DIR, file);
        const stats = fs.statSync(filePath);
        return {
          name: file,
          size: (stats.size / (1024 * 1024)).toFixed(2) + ' MB',
          date: stats.mtime.toLocaleString('es-CL')
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date));

    if (files.length === 0) {
      console.log('No hay backups disponibles\n');
      return [];
    }

    console.log('\nBackups disponibles:\n');
    files.forEach((file, index) => {
      console.log(`${index + 1}. ${file.name}`);
      console.log(`   Tamaño: ${file.size}`);
      console.log(`   Fecha: ${file.date}\n`);
    });

    return files;
  } catch (error) {
    console.error('Error listando backups:', error.message);
    return [];
  }
}

/**
 * Restaurar backup
 */
async function restoreBackup(backupName) {
  try {
    console.log(`Restaurando backup: ${backupName}\n`);

    const backupPath = path.join(BACKUP_DIR, backupName);
    
    if (!fs.existsSync(backupPath)) {
      throw new Error('Backup no encontrado');
    }

    // Descomprimir
    console.log('Descomprimiendo backup...');
    const extractPath = backupPath.replace('.tar.gz', '');
    await execPromise(`tar -xzf "${backupPath}" -C "${BACKUP_DIR}"`);

    // Restaurar
    const mongoUri = process.env.MONGODB_URI;
    
    if (mongoUri.includes('mongodb+srv://')) {
      const command = `mongorestore --uri="${mongoUri}" --drop "${extractPath}"`;
      await execPromise(command);
    } else {
      const match = mongoUri.match(/mongodb:\/\/([^:]+):(\d+)\/(.+)/);
      if (match) {
        const [, host, port, database] = match;
        const command = `mongorestore --host ${host} --port ${port} --db ${database} --drop "${extractPath}/${database}"`;
        await execPromise(command);
      }
    }

    // Limpiar
    fs.rmSync(extractPath, { recursive: true, force: true });

    console.log('Backup restaurado exitosamente\n');
  } catch (error) {
    console.error('Error restaurando backup:', error.message);
    throw error;
  }
}

// CLI
const args = process.argv.slice(2);
const command = args[0];

(async () => {
  try {
    switch (command) {
      case 'create':
      case 'backup':
        await createBackup();
        break;
      
      case 'list':
        listBackups();
        break;
      
      case 'restore':
        const backupName = args[1];
        if (!backupName) {
          console.error('Uso: npm run backup:restore <nombre-del-backup>');
          process.exit(1);
        }
        await restoreBackup(backupName);
        break;
      
      default:
        console.log('Uso:');
        console.log('  npm run backup         - Crear backup');
        console.log('  npm run backup:list    - Listar backups');
        console.log('  npm run backup:restore <nombre> - Restaurar backup');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();

module.exports = { createBackup, listBackups, restoreBackup };