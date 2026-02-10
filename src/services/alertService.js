// services/alertService.js
const Alert = require('../models/Alert');
const Product = require('../models/Product');
const emailService = require('./emailService');

// ✅ NO importar io aquí — se inyecta con setIO() para evitar ciclo circular
let io = null;

class AlertService {
  constructor() {
    this.checkInterval = null;
  }

  // ✅ Llamar esto desde app.js después de crear el servidor
  setIO(socketIO) {
    io = socketIO;
    console.log('✅ AlertService: WebSocket IO configurado');
  }

  /**
   * Iniciar monitoreo automático de alertas
   */
  iniciarMonitoreo(intervalMinutos = 30) {
    console.log(`🔔 Iniciando monitoreo de alertas cada ${intervalMinutos} minutos`);
    this.verificarTodasLasAlertas();
    this.checkInterval = setInterval(() => {
      this.verificarTodasLasAlertas();
    }, intervalMinutos * 60 * 1000);
  }

  /**
   * Detener monitoreo
   */
  detenerMonitoreo() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log('⏸️ Monitoreo de alertas detenido');
    }
  }

  /**
   * Verificar todas las alertas posibles
   */
  async verificarTodasLasAlertas() {
    try {
      console.log('🔍 Verificando alertas de inventario...');

      const [alertasStockBajo, alertasStockCritico, alertasMovimientosInusuales] =
        await Promise.all([
          this.verificarStockBajo(),
          this.verificarStockCritico(),
          this.verificarMovimientosInusuales(),
        ]);

      const totalNuevas = alertasStockBajo + alertasStockCritico + alertasMovimientosInusuales;

      if (totalNuevas > 0) {
        console.log(`✅ Se generaron ${totalNuevas} nuevas alertas`);
        this.emitirActualizacionAlertas();
      }
    } catch (error) {
      console.error('❌ Error verificando alertas:', error);
    }
  }

  /**
   * Verificar productos con stock bajo
   */
  async verificarStockBajo() {
    try {
      const productosStockBajo = await Product.find({
        $expr: { $lte: ['$stock', '$minStock'] },
        stock: { $gt: 0 },
        isActive: true,
        isDeleted: false,
      });

      let alertasCreadas = 0;

      for (const producto of productosStockBajo) {
        // ✅ Usar 'repuesto' que es el campo definido en el modelo Alert
        const existente = await Alert.findOne({
          repuesto: producto._id,
          tipo: 'stock_bajo',
          estado: 'activa',
        });

        if (!existente) {
          const alerta = await Alert.create({
            tipo: 'stock_bajo',
            severidad: 'alta',
            repuesto: producto._id,   // ✅ campo correcto
            titulo: `⚠️ Stock Bajo: ${producto.name}`,
            mensaje: `El producto ${producto.barcode || producto.name} tiene stock bajo. Stock actual: ${producto.stock}, Stock mínimo: ${producto.minStock}`,
            datos: {
              stockActual: producto.stock,
              stockMinimo: producto.minStock,
              diferencia: producto.minStock - producto.stock,
            },
          });

          await this.enviarNotificaciones(alerta);
          alertasCreadas++;
        }
      }

      return alertasCreadas;
    } catch (error) {
      console.error('Error verificando stock bajo:', error);
      return 0;
    }
  }

  /**
   * Verificar productos con stock crítico (0 unidades)
   */
  async verificarStockCritico() {
    try {
      const productosAgotados = await Product.find({
        stock: 0,
        isActive: true,
        isDeleted: false,
      });

      let alertasCreadas = 0;

      for (const producto of productosAgotados) {
        const existente = await Alert.findOne({
          repuesto: producto._id,   // ✅ campo correcto
          tipo: 'stock_agotado',
          estado: 'activa',
        });

        if (!existente) {
          const alerta = await Alert.create({
            tipo: 'stock_agotado',
            severidad: 'critica',
            repuesto: producto._id,   // ✅ campo correcto
            titulo: `🚨 Stock AGOTADO: ${producto.name}`,
            mensaje: `El producto ${producto.barcode || producto.name} está completamente agotado. Se requiere reabastecimiento urgente.`,
            datos: {
              stockActual: 0,
              stockMinimo: producto.minStock,
            },
          });

          await this.enviarNotificaciones(alerta);
          alertasCreadas++;
        }
      }

      return alertasCreadas;
    } catch (error) {
      console.error('Error verificando stock crítico:', error);
      return 0;
    }
  }

  /**
   * Verificar movimientos inusuales de stock
   */
  async verificarMovimientosInusuales() {
    try {
      const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const productos = await Product.find({
        isActive: true,
        isDeleted: false,
        'stockMovements.createdAt': { $gte: hace24h },
      });

      let alertasCreadas = 0;

      for (const producto of productos) {
        const movimientosRecientes = producto.stockMovements.filter(
          (m) => m.createdAt >= hace24h
        );

        if (movimientosRecientes.length >= 10) {
          const existente = await Alert.findOne({
            repuesto: producto._id,   // ✅ campo correcto
            tipo: 'movimiento_inusual',
            estado: 'activa',
            fechaCreacion: { $gte: hace24h },
          });

          if (!existente) {
            await Alert.create({
              tipo: 'movimiento_inusual',
              severidad: 'media',
              repuesto: producto._id,   // ✅ campo correcto
              titulo: `📊 Actividad inusual: ${producto.name}`,
              mensaje: `El producto ${producto.barcode || producto.name} ha tenido ${movimientosRecientes.length} movimientos en las últimas 24 horas.`,
              datos: {
                stockActual: producto.stock,
                cantidadMovimientos: movimientosRecientes.length,
              },
            });

            alertasCreadas++;
          }
        }
      }

      return alertasCreadas;
    } catch (error) {
      console.error('Error verificando movimientos inusuales:', error);
      return 0;
    }
  }

  /**
   * Enviar notificaciones de alerta
   */
  async enviarNotificaciones(alerta) {
    try {
      await alerta.populate('repuesto');

      if (alerta.severidad === 'alta' || alerta.severidad === 'critica') {
        const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [];

        for (const email of adminEmails) {
          try {
            await emailService.sendEmail({
              to: email,
              subject: alerta.titulo,
              template: 'alert-notification',
              data: { alerta },
            });
            await alerta.registrarNotificacion('email', email, true);
          } catch (error) {
            console.error(`Error enviando email a ${email}:`, error);
            await alerta.registrarNotificacion('email', email, false, error.message);
          }
        }
      }

      this.emitirAlerta(alerta);
    } catch (error) {
      console.error('Error enviando notificaciones:', error);
    }
  }

  /**
   * Emitir alerta por WebSocket
   */
  emitirAlerta(alerta) {
    if (io) {
      io.to('alerts').emit('nueva-alerta', {
        _id: alerta._id,
        tipo: alerta.tipo,
        severidad: alerta.severidad,
        titulo: alerta.titulo,
        mensaje: alerta.mensaje,
        repuesto: alerta.repuesto,
        datos: alerta.datos,
        estado: alerta.estado,
        fechaCreacion: alerta.fechaCreacion,
      });
    }
  }

  /**
   * Emitir actualización general de alertas
   */
  async emitirActualizacionAlertas() {
    if (io) {
      const stats = await this.obtenerEstadisticas();
      io.to('alerts').emit('alertas-actualizadas', stats);
    }
  }

  /**
   * Obtener estadísticas de alertas
   */
  async obtenerEstadisticas() {
    try {
      const [total, activas, criticas, porTipo, porSeveridad] = await Promise.all([
        Alert.countDocuments(),
        Alert.countDocuments({ estado: 'activa' }),
        Alert.countDocuments({ estado: 'activa', severidad: 'critica' }),
        Alert.aggregate([
          { $match: { estado: 'activa' } },
          { $group: { _id: '$tipo', count: { $sum: 1 } } },
        ]),
        Alert.aggregate([
          { $match: { estado: 'activa' } },
          { $group: { _id: '$severidad', count: { $sum: 1 } } },
        ]),
      ]);

      return {
        total,
        activas,
        criticas,
        porTipo: porTipo.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        porSeveridad: porSeveridad.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
      };
    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      return { total: 0, activas: 0, criticas: 0, porTipo: {}, porSeveridad: {} };
    }
  }

  /**
   * Limpiar alertas antiguas resueltas
   */
  async limpiarAlertasAntiguas(diasAntiguedad = 30) {
    try {
      const fechaLimite = new Date(Date.now() - diasAntiguedad * 24 * 60 * 60 * 1000);
      const resultado = await Alert.deleteMany({
        estado: { $in: ['resuelta', 'descartada'] },
        fechaResolucion: { $lt: fechaLimite },
      });
      console.log(`🗑️ Se eliminaron ${resultado.deletedCount} alertas antiguas`);
      return resultado.deletedCount;
    } catch (error) {
      console.error('Error limpiando alertas antiguas:', error);
      return 0;
    }
  }

  /**
   * Auto-resolver alertas cuando el stock se normaliza
   */
  async autoResolverAlertasStockNormalizado() {
    try {
      const alertasStockBajo = await Alert.find({
        tipo: { $in: ['stock_bajo', 'stock_agotado'] },
        estado: 'activa',
      }).populate('repuesto');

      let resueltas = 0;

      for (const alerta of alertasStockBajo) {
        const producto = alerta.repuesto; // ✅ campo correcto

        if (producto && producto.stock > producto.minStock) {
          alerta.estado = 'resuelta';
          alerta.autoResuelta = true;
          alerta.fechaResolucion = new Date();
          alerta.notasResolucion = 'Stock normalizado automáticamente';
          await alerta.save();
          resueltas++;
        }
      }

      if (resueltas > 0) {
        console.log(`Se auto-resolvieron ${resueltas} alertas de stock`);
        this.emitirActualizacionAlertas();
      }

      return resueltas;
    } catch (error) {
      console.error('Error auto-resolviendo alertas:', error);
      return 0;
    }
  }
}

module.exports = new AlertService();