const emailService = require('./emailService');
const logger = require('../utils/logger');
const WorkOrder = require('../models/WorkOrder');
const Quote = require('../models/Quote');
const Client = require('../models/Client');

class EmailQueueService {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.maxRetries = 3;
    this.retryDelays = [0, 5000, 15000]; // 0s, 5s, 15s
  }

  /**
   * Agregar email a la cola
   */
  async enqueue(emailJob) {
    this.queue.push({
      ...emailJob,
      attempts: 0,
      createdAt: new Date(),
      status: 'pending'
    });

    logger.info('Email agregado a la cola', {
      module: 'emailQueue',
      action: 'enqueue',
      metadata: {
        type: emailJob.type,
        orderId: emailJob.orderId,
        quoteId: emailJob.quoteId
      }
    });

    // Procesar cola si no está procesando
    if (!this.processing) {
      this.processQueue();
    }
  }

  /**
   * Procesar cola de emails
   */
  async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const job = this.queue[0];

      try {
        await this.processJob(job);
        
        // Si fue exitoso, remover de la cola
        this.queue.shift();
        
      } catch (error) {
        job.attempts++;
        job.lastError = error.message;

        if (job.attempts >= this.maxRetries) {
          // Máximo de intentos alcanzado
          logger.error('Email falló después de todos los reintentos', {
            module: 'emailQueue',
            action: 'max_retries_reached',
            metadata: {
              type: job.type,
              attempts: job.attempts,
              error: error.message
            }
          });

          // Marcar como fallido y remover
          await this.markAsFailed(job);
          this.queue.shift();
        } else {
          // Esperar antes del siguiente intento
          const delay = this.retryDelays[job.attempts] || 15000;
          
          logger.warn(`Email falló, reintentando en ${delay}ms`, {
            module: 'emailQueue',
            action: 'retry_scheduled',
            metadata: {
              type: job.type,
              attempt: job.attempts,
              delay
            }
          });

          await this.sleep(delay);
        }
      }
    }

    this.processing = false;
  }

  /**
   * Procesar un trabajo individual
   */
  async processJob(job) {
    switch (job.type) {
      case 'order_ready':
        return await this.sendOrderReadyEmail(job);
      
      case 'quote_sent':
        return await this.sendQuoteEmail(job);
      
      default:
        throw new Error(`Tipo de email desconocido: ${job.type}`);
    }
  }

  /**
   * Enviar email de orden lista
   */
  async sendOrderReadyEmail(job) {
    const order = await WorkOrder.findById(job.orderId)
      .populate({
        path: 'quoteId',
        populate: { path: 'clientId' }
      });

    if (!order) {
      throw new Error('Orden no encontrada');
    }

    const quote = order.quoteId;
    const client = quote.clientId;

    if (!client || !client.email) {
      throw new Error('Cliente sin email válido');
    }

    const result = await emailService.sendReadyNotification(order);

    if (!result.success) {
      throw new Error(result.error);
    }

    // Actualizar flags en la orden
    order.readyEmailSent = true;
    order.readyEmailSentAt = new Date();
    order.notifications.push({
      type: 'listo',
      method: 'email',
      status: 'enviado',
      attempts: job.attempts + 1,
      sentAt: new Date()
    });
    await order.save();

    logger.info('Email de orden lista enviado exitosamente', {
      module: 'emailQueue',
      action: 'order_ready_sent',
      metadata: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        clientEmail: client.email
      }
    });

    return result;
  }

  /**
   * Enviar email de presupuesto
   */
  async sendQuoteEmail(job) {
    const quote = await Quote.findById(job.quoteId);
    const client = await Client.findById(quote.clientId);

    if (!quote || !client) {
      throw new Error('Presupuesto o cliente no encontrado');
    }

    const result = await emailService.sendQuoteEmail(quote, client, job.tokens);

    if (!result.success) {
      throw new Error(result.error);
    }

    logger.info('Email de presupuesto enviado exitosamente', {
      module: 'emailQueue',
      action: 'quote_sent',
      metadata: {
        quoteId: quote._id,
        quoteNumber: quote.quoteNumber,
        clientEmail: client.email
      }
    });

    return result;
  }

  /**
   * Marcar trabajo como fallido
   */
  async markAsFailed(job) {
    try {
      if (job.type === 'order_ready' && job.orderId) {
        const order = await WorkOrder.findById(job.orderId);
        if (order) {
          order.notifications.push({
            type: 'listo',
            method: 'email',
            status: 'fallido',
            attempts: job.attempts,
            error: job.lastError
          });
          await order.save();
        }
      }
    } catch (error) {
      logger.error('Error marcando email como fallido', {
        module: 'emailQueue',
        action: 'mark_failed_error',
        metadata: { error: error.message }
      });
    }
  }

  /**
   * Utilidad para esperar
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Obtener estado de la cola
   */
  getQueueStatus() {
    return {
      queueLength: this.queue.length,
      processing: this.processing,
      jobs: this.queue.map(job => ({
        type: job.type,
        attempts: job.attempts,
        status: job.status,
        createdAt: job.createdAt
      }))
    };
  }
}

// Singleton
module.exports = new EmailQueueService();