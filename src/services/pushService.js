// services/pushService.js
const { initializeFirebase } = require('../config/firebase');
const User = require('../models/User'); // Ajusta la ruta según tu proyecto

/**
 * Envía una notificación push a todos los admins/gerentes
 */
const sendAlertPushNotification = async (alerta) => {
  try {
    const admin = initializeFirebase();
    
    if (!admin) {
      console.warn('⚠️ Firebase no inicializado - Push notification no enviada');
      return;
    }

    console.log('📤 Enviando push notification para alerta:', alerta.titulo);

    // Obtener tokens de todos los admins y gerentes
    const users = await User.find({
      role: { $in: ['admin', 'gerente'] },
      fcmToken: { $exists: true, $ne: null, $ne: '' },
    }).select('fcmToken username');

    if (users.length === 0) {
      console.warn('⚠️ No hay usuarios con token FCM registrado');
      return;
    }

    console.log(`📱 Enviando a ${users.length} usuario(s)...`);

    // Determinar ícono según severidad
    const getIcon = (severidad) => {
      const icons = {
        critica: '🚨',
        alta: '⚠️',
        media: '📦',
        baja: 'ℹ️',
      };
      return icons[severidad] || '🔔';
    };

    // Preparar tokens
    const tokens = users.map(u => u.fcmToken);

    // Mensaje push
    const message = {
      notification: {
        title: `${getIcon(alerta.severidad)} ${alerta.titulo}`,
        body: alerta.mensaje,
      },
      data: {
        alertId: alerta._id?.toString() || '',
        tipo: alerta.tipo || '',
        severidad: alerta.severidad || '',
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
      },
      android: {
        priority: alerta.severidad === 'critica' ? 'high' : 'normal',
        notification: {
          sound: 'default',
          channelId: 'alerts',
          priority: alerta.severidad === 'critica' ? 'max' : 'high',
          defaultSound: true,
          defaultVibrateTimings: true,
          icon: 'ic_stat_icon_config_sample', // ✅ Icono de notificación
          color: '#1890ff', // ✅ Color azul
        },
      },
      // Enviar a múltiples tokens
      tokens: tokens,
    };

    // Enviar a múltiples dispositivos
    const response = await admin.messaging().sendEachForMulticast(message);

    console.log(`✅ Push notifications enviadas:`);
    console.log(`   Exitosas: ${response.successCount}`);
    console.log(`   Fallidas: ${response.failureCount}`);

    // Limpiar tokens inválidos
    if (response.failureCount > 0) {
      const invalidTokenUsers = [];
      
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          console.error(`   ❌ Error para ${users[idx].username}:`, resp.error?.message);
          
          // Si el token es inválido, marcarlo para limpiar
          if (
            resp.error?.code === 'messaging/invalid-registration-token' ||
            resp.error?.code === 'messaging/registration-token-not-registered'
          ) {
            invalidTokenUsers.push(users[idx]._id);
          }
        }
      });

      // Limpiar tokens inválidos de la base de datos
      if (invalidTokenUsers.length > 0) {
        await User.updateMany(
          { _id: { $in: invalidTokenUsers } },
          { $unset: { fcmToken: 1 } }
        );
        console.log(`🗑️ Tokens inválidos limpiados: ${invalidTokenUsers.length}`);
      }
    }

    return response;

  } catch (error) {
    console.error('❌ Error enviando push notification:', error.message);
    // No lanzar el error para no interrumpir el flujo principal
  }
};

/**
 * Envía notificación push a un usuario específico
 */
const sendPushToUser = async (userId, title, body, data = {}) => {
  try {
    const admin = initializeFirebase();
    if (!admin) return;

    const user = await User.findById(userId).select('fcmToken username');
    
    if (!user?.fcmToken) {
      console.warn(`⚠️ Usuario ${userId} sin token FCM`);
      return;
    }

    const message = {
      notification: { title, body },
      data,
      token: user.fcmToken,
    };

    const response = await admin.messaging().send(message);
    console.log(`✅ Push enviada a ${user.username}:`, response);
    
    return response;

  } catch (error) {
    console.error('❌ Error enviando push a usuario:', error.message);
  }
};

module.exports = { sendAlertPushNotification, sendPushToUser };