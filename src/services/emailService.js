const nodemailer = require('nodemailer');
const logger = require('../utils/logger');
const SystemLog = require('../models/SystemLog');

class EmailService {
  constructor() {
    this.transporter = null;
    this.maxRetries = parseInt(process.env.EMAIL_MAX_RETRIES) || 3;
    this.retryDelays = (process.env.EMAIL_RETRY_DELAYS || '0,300000,900000')
      .split(',')
      .map(d => parseInt(d));
    this.timeout = parseInt(process.env.EMAIL_TIMEOUT) || 10000;
    this.workshopInfo = {
      name: process.env.WORKSHOP_NAME || 'Taller Mecánico',
      email: process.env.WORKSHOP_EMAIL || 'contacto@taller.com',
      phone: process.env.WORKSHOP_PHONE || '+56912345678',
      address: process.env.WORKSHOP_ADDRESS || 'Dirección del taller'
    };
    this.frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  }

  async initialize() {
    try {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT),
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        },
        connectionTimeout: this.timeout,
        greetingTimeout: this.timeout,
        socketTimeout: this.timeout
      });

      await this.transporter.verify();
      logger.info('Servicio de email inicializado correctamente', {
        module: 'email',
        action: 'initialize'
      });
    } catch (error) {
      logger.error('Error inicializando servicio de email:', {
        module: 'email',
        action: 'initialize_error',
        metadata: { error: error.message }
      });
    }
  }

  async sendWithRetry(mailOptions, attempt = 0) {
    try {
      const info = await this.transporter.sendMail(mailOptions);
      logger.info('Email enviado exitosamente', {
        module: 'email',
        action: 'send_success',
        metadata: { 
          to: mailOptions.to,
          subject: mailOptions.subject,
          attempt: attempt + 1
        }
      });
      return { success: true, info };
    } catch (error) {
      logger.error(`Error enviando email (intento ${attempt + 1})`, {
        module: 'email',
        action: 'send_error',
        metadata: { 
          to: mailOptions.to,
          error: error.message,
          attempt: attempt + 1
        }
      });

      if (attempt < this.maxRetries - 1) {
        const delay = this.retryDelays[attempt + 1] || 0;
        if (delay > 0) {
          logger.info(`Reintentando envío en ${delay}ms`, {
            module: 'email',
            action: 'retry_scheduled'
          });
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        return await this.sendWithRetry(mailOptions, attempt + 1);
      }

      return { success: false, error: error.message };
    }
  }

  generateQuoteEmail(quote, client, tokens) {
    const approveUrl = `${this.frontendUrl}/api/quotes/${quote._id}/approve?token=${tokens.approveToken}`;
    const rejectUrl = `${this.frontendUrl}/api/quotes/${quote._id}/reject?token=${tokens.rejectToken}`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #2c3e50; color: white; padding: 20px; text-align: center; }
    .content { background-color: #f9f9f9; padding: 20px; }
    .section { margin-bottom: 20px; }
    .label { font-weight: bold; color: #2c3e50; }
    .value { margin-left: 10px; }
    .vehicle-info { background-color: white; padding: 15px; border-left: 4px solid #3498db; }
    .cost { font-size: 24px; color: #27ae60; font-weight: bold; text-align: center; padding: 20px; }
    .buttons { text-align: center; margin: 30px 0; }
    .button { display: inline-block; padding: 12px 30px; margin: 0 10px; text-decoration: none; border-radius: 5px; font-weight: bold; }
    .approve { background-color: #27ae60; color: white; }
    .reject { background-color: #e74c3c; color: white; }
    .footer { background-color: #34495e; color: white; padding: 20px; text-align: center; font-size: 12px; }
    .warning { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 10px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${this.workshopInfo.name}</h1>
      <p>Presupuesto de Reparación</p>
    </div>
    
    <div class="content">
      <div class="section">
        <p>Estimado/a <strong>${client.getFullName()}</strong>,</p>
        <p>Le enviamos el presupuesto solicitado para la reparación de su vehículo:</p>
      </div>
      
      <div class="section">
        <div class="label">Número de Presupuesto:</div>
        <div class="value">${quote.quoteNumber}</div>
      </div>
      
      <div class="section vehicle-info">
        <h3>Datos del Vehículo</h3>
        <p><span class="label">Marca:</span> ${quote.vehicle.brand}</p>
        <p><span class="label">Modelo:</span> ${quote.vehicle.model}</p>
        <p><span class="label">Año:</span> ${quote.vehicle.year}</p>
        <p><span class="label">Patente:</span> ${quote.vehicle.licensePlate}</p>
        <p><span class="label">Kilometraje:</span> ${quote.vehicle.mileage} km</p>
      </div>
      
      <div class="section">
        <h3>Descripción del Problema</h3>
        <p>${quote.description}</p>
      </div>
      
      <div class="section">
        <h3>Trabajos Propuestos</h3>
        <p>${quote.proposedWork}</p>
      </div>
      
      <div class="cost">
        Costo Estimado: CLP $${quote.estimatedCost.toLocaleString('es-CL')}
      </div>
      
      <div class="warning">
        <strong>⚠️ Este presupuesto es válido hasta el ${new Date(quote.validUntil).toLocaleDateString('es-CL')}</strong>
      </div>
      
      <div class="buttons">
        <a href="${approveUrl}" class="button approve">✓ APROBAR PRESUPUESTO</a>
        <a href="${rejectUrl}" class="button reject">✗ RECHAZAR PRESUPUESTO</a>
      </div>
      
      <div class="section">
        <p><strong>Nota:</strong> Al aprobar este presupuesto, se creará automáticamente una orden de trabajo y nuestro equipo comenzará a trabajar en su vehículo.</p>
      </div>
    </div>
    
    <div class="footer">
      <p><strong>${this.workshopInfo.name}</strong></p>
      <p>📧 ${this.workshopInfo.email} | 📞 ${this.workshopInfo.phone}</p>
      <p>📍 ${this.workshopInfo.address}</p>
      <p style="margin-top: 15px; font-size: 10px;">
        Este es un correo automático. Por favor no responder a este mensaje.
      </p>
    </div>
  </div>
</body>
</html>
    `;

    return {
      from: `"${this.workshopInfo.name}" <${this.workshopInfo.email}>`,
      to: client.email,
      subject: `Presupuesto ${quote.quoteNumber} - ${this.workshopInfo.name}`,
      html
    };
  }

  async sendQuoteEmail(quote, client, tokens) {
    if (!this.transporter) {
      await this.initialize();
    }

    const mailOptions = this.generateQuoteEmail(quote, client, tokens);
    const result = await this.sendWithRetry(mailOptions);

    await SystemLog.createLog({
      level: result.success ? 'info' : 'error',
      action: result.success ? 'quote_email_sent' : 'quote_email_failed',
      module: 'email',
      metadata: {
        quoteId: quote._id,
        quoteNumber: quote.quoteNumber,
        clientEmail: client.email,
        error: result.error
      }
    });

    return result;
  }

  generateReadyEmail(order, quote, client) {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #27ae60; color: white; padding: 20px; text-align: center; }
    .content { background-color: #f9f9f9; padding: 20px; }
    .section { margin-bottom: 20px; }
    .label { font-weight: bold; color: #2c3e50; }
    .vehicle-info { background-color: white; padding: 15px; border-left: 4px solid #27ae60; }
    .highlight { background-color: #d4edda; border: 2px solid #27ae60; padding: 20px; text-align: center; font-size: 20px; font-weight: bold; color: #155724; margin: 20px 0; }
    .footer { background-color: #34495e; color: white; padding: 20px; text-align: center; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>¡Su Vehículo está Listo!</h1>
      <p>${this.workshopInfo.name}</p>
    </div>
    
    <div class="content">
      <div class="section">
        <p>Estimado/a <strong>${client.getFullName()}</strong>,</p>
        <p>Nos complace informarle que su vehículo ha sido reparado y está listo para ser retirado.</p>
      </div>
      
      <div class="highlight">
        ✅ Orden de Trabajo ${order.orderNumber} - LISTA PARA RETIRO
      </div>
      
      <div class="section vehicle-info">
        <h3>Datos del Vehículo</h3>
        <p><span class="label">Marca:</span> ${order.vehicleSnapshot.brand}</p>
        <p><span class="label">Modelo:</span> ${order.vehicleSnapshot.model}</p>
        <p><span class="label">Patente:</span> ${order.vehicleSnapshot.licensePlate}</p>
      </div>
      
      <div class="section">
        <h3>Trabajos Realizados</h3>
        <p>${order.workDescription}</p>
        ${order.additionalWork ? `<p><strong>Trabajos Adicionales:</strong> ${order.additionalWork}</p>` : ''}
      </div>
      
      ${order.finalCost ? `
        <div class="section">
          <p><span class="label">Costo Final:</span> CLP $${order.finalCost.toLocaleString('es-CL')}</p>
        </div>
      ` : ''}
      
      <div class="section">
        <h3>Para Retirar su Vehículo</h3>
        <p>Por favor acérquese a nuestro taller en el siguiente horario:</p>
        <p><strong>Lunes a Viernes:</strong> 9:00 - 18:00</p>
        <p><strong>Sábados:</strong> 9:00 - 13:00</p>
        <p><strong>Domingos:</strong> Cerrado</p>
      </div>
      
      <div class="section">
        <p><strong>Importante:</strong> Traiga su documento de identidad para retirar el vehículo.</p>
      </div>
    </div>
    
    <div class="footer">
      <p><strong>${this.workshopInfo.name}</strong></p>
      <p>📧 ${this.workshopInfo.email} | 📞 ${this.workshopInfo.phone}</p>
      <p>📍 ${this.workshopInfo.address}</p>
      <p style="margin-top: 15px;">¡Gracias por confiar en nosotros!</p>
      <p style="font-size: 10px;">
        Este es un correo automático. Por favor no responder a este mensaje.
      </p>
    </div>
  </div>
</body>
</html>
    `;

    return {
      from: `"${this.workshopInfo.name}" <${this.workshopInfo.email}>`,
      to: client.email,
      subject: `¡Su vehículo está listo! - Orden ${order.orderNumber}`,
      html
    };
  }

  async sendReadyNotification(order) {
    if (!this.transporter) {
      await this.initialize();
    }

    const Quote = require('../models/Quote');
    const Client = require('../models/Client');

    const quote = await Quote.findById(order.quoteId);
    const client = await Client.findById(quote.clientId);

    if (!client || !client.email) {
      throw new Error('Cliente sin email válido');
    }

    const mailOptions = this.generateReadyEmail(order, quote, client);
    const result = await this.sendWithRetry(mailOptions);

    await SystemLog.createLog({
      level: result.success ? 'info' : 'error',
      action: result.success ? 'ready_email_sent' : 'ready_email_failed',
      module: 'email',
      metadata: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        clientEmail: client.email,
        error: result.error
      }
    });

    return result;
  }
}

module.exports = new EmailService();