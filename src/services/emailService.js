const nodemailer = require("nodemailer");
const logger = require("../utils/logger");
const SystemLog = require("../models/SystemLog");

class EmailService {
  constructor() {
    this.transporter = null;
    this.maxRetries = parseInt(process.env.EMAIL_MAX_RETRIES) || 3;
    this.retryDelays = (process.env.EMAIL_RETRY_DELAYS || "0,300000,900000")
      .split(",")
      .map((d) => parseInt(d));
    this.timeout = parseInt(process.env.EMAIL_TIMEOUT) || 10000;
    this.workshopInfo = {
      name: process.env.WORKSHOP_NAME || "Taller Mecánico",
      email: process.env.WORKSHOP_EMAIL || "contacto@taller.com",
      phone: process.env.WORKSHOP_PHONE || "+56912345678",
      address: process.env.WORKSHOP_ADDRESS || "Dirección del taller",
    };
    this.frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  }

  async initialize() {
    try {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT),
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
        connectionTimeout: this.timeout,
        greetingTimeout: this.timeout,
        socketTimeout: this.timeout,
      });

      await this.transporter.verify();
      logger.info("Servicio de email inicializado correctamente", {
        module: "email",
        action: "initialize",
      });
    } catch (error) {
      logger.error("Error inicializando servicio de email:", {
        module: "email",
        action: "initialize_error",
        metadata: { error: error.message },
      });
    }
  }

  async sendWithRetry(mailOptions, attempt = 0) {
    try {
      const info = await this.transporter.sendMail(mailOptions);
      logger.info("Email enviado exitosamente", {
        module: "email",
        action: "send_success",
        metadata: {
          to: mailOptions.to,
          subject: mailOptions.subject,
          attempt: attempt + 1,
        },
      });
      return { success: true, info };
    } catch (error) {
      logger.error(`Error enviando email (intento ${attempt + 1})`, {
        module: "email",
        action: "send_error",
        metadata: {
          to: mailOptions.to,
          error: error.message,
          attempt: attempt + 1,
        },
      });

      if (attempt < this.maxRetries - 1) {
        const delay = this.retryDelays[attempt + 1] || 0;
        if (delay > 0) {
          logger.info(`Reintentando envío en ${delay}ms`, {
            module: "email",
            action: "retry_scheduled",
          });
          await new Promise((resolve) => setTimeout(resolve, delay));
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
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6; 
      color: #2c3e50;
      background-color: #f5f7fa;
    }
    .email-wrapper { 
      max-width: 600px; 
      margin: 0 auto; 
      background-color: #ffffff;
    }
    .header { 
      background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
      color: white; 
      padding: 40px 30px;
      text-align: center;
    }
    .header h1 { 
      font-size: 24px; 
      font-weight: 600;
      margin-bottom: 8px;
    }
    .header p { 
      font-size: 14px; 
      opacity: 0.9;
    }
    .content { 
      padding: 40px 30px;
    }
    .greeting { 
      font-size: 16px;
      margin-bottom: 20px;
      color: #2c3e50;
    }
    .section { 
      margin-bottom: 30px;
    }
    .section-title {
      font-size: 14px;
      font-weight: 600;
      color: #7f8c8d;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 12px;
    }
    .info-card {
      background-color: #f8f9fa;
      border-left: 4px solid #3498db;
      padding: 20px;
      margin-bottom: 20px;
    }
    .info-row {
      display: flex;
      padding: 8px 0;
      border-bottom: 1px solid #e9ecef;
    }
    .info-row:last-child {
      border-bottom: none;
    }
    .info-label {
      font-weight: 600;
      color: #495057;
      min-width: 120px;
    }
    .info-value {
      color: #6c757d;
    }
    .description-box {
      background-color: #ffffff;
      border: 1px solid #e9ecef;
      border-radius: 4px;
      padding: 20px;
      margin-bottom: 20px;
    }
    .cost-section {
      text-align: center;
      background: linear-gradient(135deg, #27ae60 0%, #229954 100%);
      color: white;
      padding: 30px;
      border-radius: 4px;
      margin: 30px 0;
    }
    .cost-label {
      font-size: 14px;
      opacity: 0.9;
      margin-bottom: 8px;
    }
    .cost-amount {
      font-size: 36px;
      font-weight: 700;
    }
    .validity-notice {
      background-color: #fff3cd;
      border-left: 4px solid #ffc107;
      padding: 15px 20px;
      margin: 20px 0;
      font-size: 14px;
      color: #856404;
    }
    .buttons-container {
      text-align: center;
      margin: 40px 0;
    }
    .button {
      display: inline-block;
      padding: 14px 32px;
      margin: 8px;
      text-decoration: none;
      border-radius: 4px;
      font-weight: 600;
      font-size: 15px;
      transition: all 0.3s ease;
    }
    .button-approve {
      background-color: #27ae60;
      color: white;
    }
    .button-reject {
      background-color: #e74c3c;
      color: white;
    }
    .footer {
      background-color: #2c3e50;
      color: #ecf0f1;
      padding: 30px;
      text-align: center;
      font-size: 13px;
    }
    .footer-title {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 15px;
    }
    .footer-info {
      margin: 8px 0;
      opacity: 0.9;
    }
    .footer-disclaimer {
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid rgba(255,255,255,0.1);
      font-size: 11px;
      opacity: 0.7;
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <!-- Header -->
    <div class="header">
      <h1>${this.workshopInfo.name}</h1>
      <p>Presupuesto de Reparación</p>
    </div>
    
    <!-- Content -->
    <div class="content">
      <div class="greeting">
        Estimado/a <strong>${client.getFullName()}</strong>,
      </div>
      
      <p style="margin-bottom: 25px;">
        Le enviamos el presupuesto solicitado para la reparación de su vehículo.
      </p>
      
      <!-- Quote Number -->
      <div class="section">
        <div class="info-row" style="border: none;">
          <div class="info-label">Número de Presupuesto:</div>
          <div class="info-value"><strong>${quote.quoteNumber}</strong></div>
        </div>
      </div>
      
      <!-- Vehicle Info -->
      <div class="section">
        <div class="section-title">Datos del Vehículo</div>
        <div class="info-card">
          <div class="info-row">
            <div class="info-label">Marca</div>
            <div class="info-value">${quote.vehicle.brand}</div>
          </div>
          <div class="info-row">
            <div class="info-label">Modelo</div>
            <div class="info-value">${quote.vehicle.model}</div>
          </div>
          <div class="info-row">
            <div class="info-label">Año</div>
            <div class="info-value">${quote.vehicle.year}</div>
          </div>
          <div class="info-row">
            <div class="info-label">Patente</div>
            <div class="info-value">${quote.vehicle.licensePlate}</div>
          </div>
          <div class="info-row">
            <div class="info-label">Kilometraje</div>
            <div class="info-value">${quote.vehicle.mileage.toLocaleString('es-CL')} km</div>
          </div>
        </div>
      </div>
      
      <!-- Problem Description -->
      <div class="section">
        <div class="section-title">Descripción del Problema</div>
        <div class="description-box">
          ${quote.description}
        </div>
      </div>
      
      <!-- Proposed Work -->
      <div class="section">
        <div class="section-title">Trabajos Propuestos</div>
        <div class="description-box">
          ${quote.proposedWork}
        </div>
      </div>
      
      <!-- Cost -->
      <div class="cost-section">
        <div class="cost-label">Costo Estimado</div>
        <div class="cost-amount">CLP $${quote.estimatedCost.toLocaleString('es-CL')}</div>
      </div>
      
      <!-- Validity Notice -->
      <div class="validity-notice">
        <strong>Importante:</strong> Este presupuesto es válido hasta el ${new Date(quote.validUntil).toLocaleDateString('es-CL', { 
          day: '2-digit', 
          month: 'long', 
          year: 'numeric' 
        })}
      </div>
      
      <!-- Action Buttons -->
      <div class="buttons-container">
        <a href="${approveUrl}" class="button button-approve">Aprobar Presupuesto</a>
        <a href="${rejectUrl}" class="button button-reject">Rechazar Presupuesto</a>
      </div>
      
      <p style="font-size: 14px; color: #6c757d; text-align: center; margin-top: 20px;">
        Al aprobar este presupuesto, se creará automáticamente una orden de trabajo<br>
        y nuestro equipo comenzará a trabajar en su vehículo.
      </p>
    </div>
    
    <!-- Footer -->
    <div class="footer">
      <div class="footer-title">${this.workshopInfo.name}</div>
      <div class="footer-info">${this.workshopInfo.email}</div>
      <div class="footer-info">${this.workshopInfo.phone}</div>
      <div class="footer-info">${this.workshopInfo.address}</div>
      <div class="footer-disclaimer">
        Este es un correo automático. Por favor no responder a este mensaje.
      </div>
    </div>
  </div>
</body>
</html>
  `;

  return {
    from: `"${this.workshopInfo.name}" <${this.workshopInfo.email}>`,
    to: client.email,
    subject: `Presupuesto ${quote.quoteNumber} - ${this.workshopInfo.name}`,
    html,
  };
}

  async sendQuoteEmail(quote, client, tokens) {
    if (!this.transporter) {
      await this.initialize();
    }

    const mailOptions = this.generateQuoteEmail(quote, client, tokens);
    const result = await this.sendWithRetry(mailOptions);

    await SystemLog.createLog({
      level: result.success ? "info" : "error",
      action: result.success ? "quote_email_sent" : "quote_email_failed",
      module: "email",
      metadata: {
        quoteId: quote._id,
        quoteNumber: quote.quoteNumber,
        clientEmail: client.email,
        error: result.error,
      },
    });

    return result;
  }

  generateReadyEmail(quote, client) {
  const order = quote.workOrder;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6; 
      color: #2c3e50;
      background-color: #f5f7fa;
    }
    .email-wrapper { 
      max-width: 600px; 
      margin: 0 auto; 
      background-color: #ffffff;
    }
    .header { 
      background: linear-gradient(135deg, #27ae60 0%, #229954 100%);
      color: white; 
      padding: 40px 30px;
      text-align: center;
    }
    .header h1 { 
      font-size: 28px; 
      font-weight: 600;
      margin-bottom: 8px;
    }
    .header p { 
      font-size: 14px; 
      opacity: 0.9;
    }
    .content { 
      padding: 40px 30px;
    }
    .greeting { 
      font-size: 16px;
      margin-bottom: 20px;
      color: #2c3e50;
    }
    .highlight-box {
      background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%);
      border-left: 4px solid #27ae60;
      padding: 25px;
      margin: 30px 0;
      text-align: center;
      border-radius: 4px;
    }
    .highlight-title {
      font-size: 18px;
      font-weight: 600;
      color: #155724;
      margin-bottom: 8px;
    }
    .highlight-subtitle {
      font-size: 24px;
      font-weight: 700;
      color: #27ae60;
    }
    .section { 
      margin-bottom: 30px;
    }
    .section-title {
      font-size: 14px;
      font-weight: 600;
      color: #7f8c8d;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 12px;
    }
    .info-card {
      background-color: #f8f9fa;
      border-left: 4px solid #27ae60;
      padding: 20px;
      margin-bottom: 20px;
    }
    .info-row {
      display: flex;
      padding: 8px 0;
      border-bottom: 1px solid #e9ecef;
    }
    .info-row:last-child {
      border-bottom: none;
    }
    .info-label {
      font-weight: 600;
      color: #495057;
      min-width: 120px;
    }
    .info-value {
      color: #6c757d;
    }
    .description-box {
      background-color: #ffffff;
      border: 1px solid #e9ecef;
      border-radius: 4px;
      padding: 20px;
      margin-bottom: 20px;
    }
    .schedule-box {
      background-color: #e7f3ff;
      border: 1px solid #b3d9ff;
      border-radius: 4px;
      padding: 20px;
      margin: 20px 0;
    }
    .schedule-title {
      font-weight: 600;
      color: #004085;
      margin-bottom: 12px;
      font-size: 15px;
    }
    .schedule-item {
      padding: 6px 0;
      color: #004085;
      font-size: 14px;
    }
    .important-notice {
      background-color: #fff3cd;
      border-left: 4px solid #ffc107;
      padding: 15px 20px;
      margin: 20px 0;
      font-size: 14px;
      color: #856404;
    }
    .footer {
      background-color: #2c3e50;
      color: #ecf0f1;
      padding: 30px;
      text-align: center;
      font-size: 13px;
    }
    .footer-title {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 15px;
    }
    .footer-info {
      margin: 8px 0;
      opacity: 0.9;
    }
    .footer-thanks {
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid rgba(255,255,255,0.1);
      font-size: 14px;
    }
    .footer-disclaimer {
      margin-top: 10px;
      font-size: 11px;
      opacity: 0.7;
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <!-- Header -->
    <div class="header">
      <h1>¡Su Vehículo está Listo!</h1>
      <p>${this.workshopInfo.name}</p>
    </div>
    
    <!-- Content -->
    <div class="content">
      <div class="greeting">
        Estimado/a <strong>${client.getFullName()}</strong>,
      </div>
      
      <p style="margin-bottom: 25px;">
        Nos complace informarle que su vehículo ha sido reparado y está listo para ser retirado.
      </p>
      
      <!-- Highlight -->
      <div class="highlight-box">
        <div class="highlight-title">Orden de Trabajo</div>
        <div class="highlight-subtitle">${order.orderNumber}</div>
        <div style="margin-top: 10px; color: #155724; font-weight: 500;">LISTA PARA RETIRO</div>
      </div>
      
      <!-- Vehicle Info -->
      <div class="section">
        <div class="section-title">Datos del Vehículo</div>
        <div class="info-card">
          <div class="info-row">
            <div class="info-label">Marca</div>
            <div class="info-value">${quote.vehicle.brand}</div>
          </div>
          <div class="info-row">
            <div class="info-label">Modelo</div>
            <div class="info-value">${quote.vehicle.model}</div>
          </div>
          <div class="info-row">
            <div class="info-label">Patente</div>
            <div class="info-value">${quote.vehicle.licensePlate}</div>
          </div>
        </div>
      </div>
      
      <!-- Work Done -->
      <div class="section">
        <div class="section-title">Trabajos Realizados</div>
        <div class="description-box">
          ${order.workDescription}
          ${order.additionalWork ? `
            <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e9ecef;">
              <strong>Trabajos Adicionales:</strong><br>
              ${order.additionalWork}
            </div>
          ` : ''}
        </div>
      </div>
      
      <!-- Final Cost -->
      ${order.finalCost ? `
        <div class="section">
          <div class="info-row" style="border: none; font-size: 16px;">
            <div class="info-label">Costo Final:</div>
            <div class="info-value"><strong>CLP $${order.finalCost.toLocaleString('es-CL')}</strong></div>
          </div>
        </div>
      ` : ''}
      
      <!-- Schedule -->
      <div class="schedule-box">
        <div class="schedule-title">Para Retirar su Vehículo</div>
        <div class="schedule-item"><strong>Lunes a Viernes:</strong> 9:00 - 18:00</div>
        <div class="schedule-item"><strong>Sábados:</strong> 9:00 - 13:00</div>
        <div class="schedule-item"><strong>Domingos:</strong> Cerrado</div>
      </div>
      
      <!-- Important Notice -->
      <div class="important-notice">
        <strong>Importante:</strong> Traiga su documento de identidad para retirar el vehículo.
      </div>
    </div>
    
    <!-- Footer -->
    <div class="footer">
      <div class="footer-title">${this.workshopInfo.name}</div>
      <div class="footer-info">${this.workshopInfo.email}</div>
      <div class="footer-info">${this.workshopInfo.phone}</div>
      <div class="footer-info">${this.workshopInfo.address}</div>
      <div class="footer-thanks">
        ¡Gracias por confiar en nosotros!
      </div>
      <div class="footer-disclaimer">
        Este es un correo automático. Por favor no responder a este mensaje.
      </div>
    </div>
  </div>
</body>
</html>
  `;

  return {
    from: `"${this.workshopInfo.name}" <${this.workshopInfo.email}>`,
    to: client.email,
    subject: `¡Su vehículo está listo! - Orden ${order.orderNumber}`,
    html,
  };
}

  async sendReadyNotification(quote) {
    if (!this.transporter) {
      await this.initialize();
    }

    const Client = require("../models/Client");
    const client = await Client.findById(quote.clientId);

    if (!client || !client.email) {
      throw new Error("Cliente sin email válido");
    }

    const mailOptions = this.generateReadyEmail(quote, client);
    const result = await this.sendWithRetry(mailOptions);

    await SystemLog.createLog({
      level: result.success ? "info" : "error",
      action: result.success ? "ready_email_sent" : "ready_email_failed",
      module: "email",
      metadata: {
        quoteId: quote._id,
        orderNumber: quote.workOrder.orderNumber,
        clientEmail: client.email,
        error: result.error,
      },
    });

    return result;
  }
}

module.exports = new EmailService();
