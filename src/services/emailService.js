const nodemailer = require("nodemailer");

class EmailService {
  constructor() {
    this.transporter = null;
    this.maxRetries = parseInt(process.env.EMAIL_MAX_RETRIES) || 3;
    this.retryDelays = (process.env.EMAIL_RETRY_DELAYS || "0,300000,900000")
      .split(",")
      .map((d) => parseInt(d));
    this.timeout = parseInt(process.env.EMAIL_TIMEOUT) || 10000;
    this.workshopInfo = {
      name: process.env.WORKSHOP_NAME || "Automotriz Portezuelo",
      email: process.env.WORKSHOP_EMAIL || "contacto@automotrizportezuelo.cl",
      phone: process.env.WORKSHOP_PHONE || "+56 9 1234 5678",
      address: process.env.WORKSHOP_ADDRESS || "Av. Principal 123, Santiago",
      website: process.env.WORKSHOP_WEBSITE || "www.automotrizportezuelo.cl",
    };
    this.frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    this.brandColors = {
      primary: "#228b22",      // Verde bosque (matching PDF)
      secondary: "#2e7d32",    // Verde oscuro
      accent: "#66bb6a",       // Verde claro
      text: "#212121",         // Texto oscuro
      textLight: "#757575",    // Texto gris
      background: "#f5f5f5",   // Fondo claro
      success: "#43a047",      // Verde éxito
    };
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
      console.log("Servicio de email inicializado correctamente");
    } catch (error) {
      console.error(`Error inicializando servicio de email: ${error.message}`);
    }
  }

  async sendWithRetry(mailOptions, attempt = 0) {
    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log(`Email enviado exitosamente a ${mailOptions.to} - Asunto: ${mailOptions.subject}`);
      return { success: true, info };
    } catch (error) {
      console.error(`Error enviando email a ${mailOptions.to} (intento ${attempt + 1}): ${error.message}`);

      if (attempt < this.maxRetries - 1) {
        const delay = this.retryDelays[attempt + 1] || 0;
        if (delay > 0) {
          console.log(`Reintentando envío en ${delay}ms`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
        return await this.sendWithRetry(mailOptions, attempt + 1);
      }

      return { success: false, error: error.message };
    }
  }

  // 🎨 Genera el HTML base con estilos profesionales (matching PDF design)
getEmailTemplate(content) {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${this.workshopInfo.name}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: ${this.brandColors.text};
      background-color: ${this.brandColors.background};
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    .email-container {
      max-width: 600px;
      margin: 20px auto;
      background-color: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
    }
    .header-bar {
      height: 6px;
      background: linear-gradient(90deg, ${this.brandColors.primary} 0%, ${this.brandColors.secondary} 100%);
    }
    .header {
      background: linear-gradient(135deg, ${this.brandColors.primary} 0%, ${this.brandColors.secondary} 100%);
      color: white;
      padding: 40px 30px;
      text-align: center;
    }
    .logo-text {
      font-size: 32px;
      font-weight: 700;
      margin-bottom: 8px;
      letter-spacing: -0.5px;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    .header-subtitle {
      font-size: 14px;
      opacity: 0.95;
      font-weight: 400;
    }
    .content {
      padding: 40px 30px;
    }
    .greeting {
      font-size: 18px;
      color: ${this.brandColors.text};
      margin-bottom: 20px;
      font-weight: 500;
    }
    .section {
      margin-bottom: 30px;
    }
    .section-title {
      font-size: 12px;
      font-weight: 700;
      color: ${this.brandColors.textLight};
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 12px;
      padding-bottom: 6px;
      border-bottom: 2px solid ${this.brandColors.primary};
      display: inline-block;
    }
    .info-card {
      background-color: #f8f9fa;
      border-left: 4px solid ${this.brandColors.primary};
      padding: 20px;
      margin: 15px 0;
      border-radius: 4px;
    }
    .info-row {
      display: flex;
      padding: 10px 0;
      border-bottom: 1px solid #e9ecef;
    }
    .info-row:last-child {
      border-bottom: none;
    }
    .info-label {
      font-weight: 600;
      color: ${this.brandColors.text};
      min-width: 130px;
      font-size: 14px;
    }
    .info-value {
      color: ${this.brandColors.textLight};
      font-size: 14px;
    }
    .highlight-box {
      background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);
      border: 2px solid ${this.brandColors.accent};
      border-radius: 8px;
      padding: 30px;
      text-align: center;
      margin: 30px 0;
    }
    .highlight-label {
      font-size: 13px;
      color: ${this.brandColors.secondary};
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 10px;
    }
    .highlight-value {
      font-size: 42px;
      font-weight: 800;
      color: ${this.brandColors.primary};
      line-height: 1;
    }
    .description-box {
      background-color: #fafafa;
      border: 1px solid #e0e0e0;
      border-radius: 6px;
      padding: 20px;
      margin: 15px 0;
      font-size: 14px;
      line-height: 1.7;
      color: ${this.brandColors.text};
    }
    .button-container {
      text-align: center;
      margin: 40px 0;
    }
    .button {
      display: inline-block;
      padding: 16px 40px;
      margin: 10px;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      font-size: 15px;
      transition: all 0.3s ease;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }
    .button:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
    }
    .button-primary {
      background: linear-gradient(135deg, ${this.brandColors.success} 0%, ${this.brandColors.secondary} 100%);
      color: white !important;
    }
    .button-secondary {
      background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
      color: white !important;
    }
    .button-whatsapp {
      background: linear-gradient(135deg, #25D366 0%, #128C7E 100%);
      color: white !important;
    }
    .alert-box {
      background-color: #fff3cd;
      border-left: 4px solid #ffc107;
      padding: 18px 20px;
      margin: 25px 0;
      border-radius: 4px;
    }
    .alert-box strong {
      color: #856404;
      font-weight: 600;
    }
    .alert-box p {
      color: #856404;
      margin: 5px 0;
      font-size: 14px;
    }
    .footer {
      background: linear-gradient(135deg, ${this.brandColors.text} 0%, #1a1a1a 100%);
      color: #ffffff;
      padding: 40px 30px;
      text-align: center;
    }
    .footer-logo {
      font-size: 24px;
      font-weight: 700;
      margin-bottom: 20px;
      color: white;
      letter-spacing: 0.5px;
    }
    .footer-info {
      margin: 12px 0;
      font-size: 14px;
      color: #ffffff;
    }
    .footer-link {
      color: ${this.brandColors.accent} !important;
      text-decoration: none;
      font-weight: 500;
    }
    .footer-link:hover {
      color: #81c784 !important;
      text-decoration: underline;
    }
    .footer-divider {
      height: 1px;
      background: rgba(255, 255, 255, 0.2);
      margin: 25px auto;
      max-width: 300px;
    }
    .footer-disclaimer {
      font-size: 12px;
      opacity: 0.75;
      margin-top: 20px;
      line-height: 1.6;
      color: #bdbdbd;
    }
    @media only screen and (max-width: 600px) {
      .content {
        padding: 30px 20px;
      }
      .info-row {
        flex-direction: column;
      }
      .info-label {
        margin-bottom: 5px;
      }
      .button {
        display: block;
        margin: 10px 0;
      }
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header-bar"></div>
    ${content}
    <div class="footer">
      <div class="footer-logo">${this.workshopInfo.name}</div>
      
      <div style="margin: 25px 0;">
        <div class="footer-info">
          📧 <a href="mailto:${this.workshopInfo.email}" class="footer-link">${this.workshopInfo.email}</a>
        </div>
        <div class="footer-info">
          📱 <a href="tel:${this.workshopInfo.phone.replace(/\s/g, '')}" class="footer-link">${this.workshopInfo.phone}</a>
        </div>
        <div class="footer-info">
          📍 ${this.workshopInfo.address}
        </div>
        ${this.workshopInfo.website ? `
          <div class="footer-info">
            🌐 <a href="https://${this.workshopInfo.website}" class="footer-link" target="_blank">${this.workshopInfo.website}</a>
          </div>
        ` : ''}
      </div>
      
      <div class="footer-divider"></div>
      
      <div class="footer-disclaimer">
        Este es un correo automático. Por favor no responder a este mensaje.<br>
        Para consultas, contáctenos al <a href="tel:${this.workshopInfo.phone.replace(/\s/g, '')}" class="footer-link">${this.workshopInfo.phone}</a>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

  generateQuoteEmail(quote, client, tokens) {
    const approveUrl = `${this.frontendUrl}/api/quotes/${quote._id}/approve?token=${tokens.approveToken}`;
    const rejectUrl = `${this.frontendUrl}/api/quotes/${quote._id}/reject?token=${tokens.rejectToken}`;
    
    // 📱 Generar enlace de WhatsApp
    const whatsappMessage = encodeURIComponent(
      `Hola, me gustaría consultar sobre el presupuesto ${quote.quoteNumber} para mi vehículo ${quote.vehicle.brand} ${quote.vehicle.model}, patente ${quote.vehicle.licensePlate}.`
    );
    const whatsappUrl = `https://wa.me/${this.workshopInfo.phone.replace(/[^0-9]/g, '')}?text=${whatsappMessage}`;

    // ✅ Determinar si tiene IVA
    const includeIVA = quote.hasOwnProperty('includeIVA') ? quote.includeIVA : true;
    const subtotal = includeIVA ? Math.round(quote.estimatedCost / 1.19) : quote.estimatedCost;
    const iva = includeIVA ? quote.estimatedCost - subtotal : 0;

    const content = `
    <div class="header">
      <div class="logo-text">${this.workshopInfo.name}</div>
      <div class="header-subtitle">Presupuesto de Reparación Automotriz</div>
    </div>
    
    <div class="content">
      <div class="greeting">
        Estimado/a <strong>${client.getFullName()}</strong>,
      </div>
      
      <p style="margin-bottom: 25px; font-size: 15px; color: ${this.brandColors.textLight};">
        Le enviamos el presupuesto solicitado para la reparación de su vehículo. 
        Por favor revise los detalles a continuación.
      </p>
      
      <!-- Número de Presupuesto -->
      <div class="section">
        <div class="info-row" style="border: none; background: #f8f9fa; padding: 15px; border-radius: 6px;">
          <div class="info-label">N° de Presupuesto:</div>
          <div class="info-value" style="font-weight: 700; color: ${this.brandColors.primary}; font-size: 16px;">
            ${quote.quoteNumber}
          </div>
        </div>
      </div>
      
      <!-- Datos del Vehículo -->
      <div class="section">
        <div class="section-title">🚗 Datos del Vehículo</div>
        <div class="info-card">
          <div class="info-row">
            <div class="info-label">Marca:</div>
            <div class="info-value"><strong>${quote.vehicle.brand}</strong></div>
          </div>
          <div class="info-row">
            <div class="info-label">Modelo:</div>
            <div class="info-value"><strong>${quote.vehicle.model}</strong></div>
          </div>
          <div class="info-row">
            <div class="info-label">Año:</div>
            <div class="info-value">${quote.vehicle.year}</div>
          </div>
          <div class="info-row">
            <div class="info-label">Patente:</div>
            <div class="info-value"><strong>${quote.vehicle.licensePlate}</strong></div>
          </div>
          <div class="info-row">
            <div class="info-label">Kilometraje:</div>
            <div class="info-value">${quote.vehicle.mileage.toLocaleString('es-CL')} km</div>
          </div>
        </div>
      </div>
      
      <!-- Descripción del Problema -->
      <div class="section">
        <div class="section-title">🔧 Descripción del Problema</div>
        <div class="description-box">
          ${quote.description}
        </div>
      </div>
      
      <!-- Trabajo Propuesto -->
      <div class="section">
        <div class="section-title">📋 Trabajos Propuestos</div>
        <div class="description-box">
          ${quote.proposedWork.replace(/\n/g, '<br>')}
        </div>
      </div>
      
      <!-- Costo Estimado -->
      <div class="highlight-box">
        <div class="highlight-label">Costo ${includeIVA ? 'Total' : 'Neto'}</div>
        <div class="highlight-value">$${quote.estimatedCost.toLocaleString('es-CL')}</div>
        ${includeIVA ? `
          <div style="margin-top: 15px; font-size: 13px; color: ${this.brandColors.secondary};">
            Subtotal: $${subtotal.toLocaleString('es-CL')} + IVA (19%): $${iva.toLocaleString('es-CL')}
          </div>
        ` : `
          <div style="margin-top: 10px; padding: 8px; background: rgba(255, 193, 7, 0.2); border-radius: 4px;">
            <strong style="color: #f57c00; font-size: 12px;">⚠️ VALOR NETO - NO INCLUYE IVA</strong>
          </div>
        `}
      </div>
      
      <!-- Validez -->
      <div class="alert-box">
        <strong>⏰ Importante:</strong>
        <p>Este presupuesto es válido hasta el <strong>${new Date(quote.validUntil).toLocaleDateString('es-CL', { 
          day: '2-digit', 
          month: 'long', 
          year: 'numeric' 
        })}</strong></p>
      </div>
      
      <!-- Botones de Acción -->
      <div class="button-container">
        <a href="${approveUrl}" class="button button-primary">
          ✓ Aprobar Presupuesto
        </a>
        <a href="${rejectUrl}" class="button button-secondary">
          ✗ Rechazar Presupuesto
        </a>
      </div>
      
      <div style="text-align: center; margin: 30px 0;">
        <p style="font-size: 13px; color: ${this.brandColors.textLight}; margin-bottom: 15px;">
          ¿Tiene consultas? Contáctenos por WhatsApp:
        </p>
        <a href="${whatsappUrl}" class="button button-whatsapp">
          💬 Consultar por WhatsApp
        </a>
      </div>
      
      <div style="background: #e8f5e9; padding: 20px; border-radius: 6px; margin-top: 30px; text-align: center;">
        <p style="font-size: 14px; color: ${this.brandColors.secondary}; margin: 0;">
          <strong>Al aprobar este presupuesto,</strong> se creará automáticamente una orden de trabajo<br>
          y nuestro equipo comenzará a trabajar en su vehículo de inmediato.
        </p>
      </div>
    </div>
    `;

    return {
      from: `"${this.workshopInfo.name}" <${this.workshopInfo.email}>`,
      to: client.email,
      subject: `Presupuesto ${quote.quoteNumber} - ${this.workshopInfo.name}`,
      html: this.getEmailTemplate(content),
    };
  }

  async sendQuoteEmail(quote, client, tokens) {
    if (!this.transporter) {
      await this.initialize();
    }

    const mailOptions = this.generateQuoteEmail(quote, client, tokens);
    const result = await this.sendWithRetry(mailOptions);

    if (result.success) {
      console.log(`Email de presupuesto enviado - Presupuesto: ${quote.quoteNumber} - Cliente: ${client.email}`);
    } else {
      console.error(`Falló envío de email de presupuesto - Presupuesto: ${quote.quoteNumber} - Error: ${result.error}`);
    }

    return result;
  }

  generateReadyEmail(quote, client) {
    const order = quote.workOrder;
    
    // 📱 Generar enlace de WhatsApp
    const whatsappMessage = encodeURIComponent(
      `Hola, quisiera coordinar el retiro de mi vehículo. Orden de trabajo: ${order.orderNumber}, Patente: ${quote.vehicle.licensePlate}`
    );
    const whatsappUrl = `https://wa.me/${this.workshopInfo.phone.replace(/[^0-9]/g, '')}?text=${whatsappMessage}`;

    const content = `
    <div class="header">
      <div class="logo-text">${this.workshopInfo.name}</div>
      <div class="header-subtitle">✅ ¡Su Vehículo está Listo!</div>
    </div>
    
    <div class="content">
      <div class="greeting">
        Estimado/a <strong>${client.getFullName()}</strong>,
      </div>
      
      <div style="background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%); padding: 30px; border-radius: 12px; text-align: center; margin: 30px 0; border: 3px solid ${this.brandColors.success};">
        <div style="font-size: 48px; margin-bottom: 15px;">🎉</div>
        <div style="font-size: 22px; font-weight: 700; color: ${this.brandColors.success}; margin-bottom: 10px;">
          ¡TRABAJO COMPLETADO!
        </div>
        <div style="font-size: 16px; color: ${this.brandColors.secondary};">
          Su vehículo ha sido reparado exitosamente
        </div>
      </div>
      
      <!-- Orden de Trabajo -->
      <div class="section">
        <div class="info-row" style="border: none; background: #f8f9fa; padding: 15px; border-radius: 6px;">
          <div class="info-label">Orden de Trabajo:</div>
          <div class="info-value" style="font-weight: 700; color: ${this.brandColors.primary}; font-size: 18px;">
            ${order.orderNumber}
          </div>
        </div>
      </div>
      
      <!-- Datos del Vehículo -->
      <div class="section">
        <div class="section-title">🚗 Vehículo Reparado</div>
        <div class="info-card">
          <div class="info-row">
            <div class="info-label">Marca y Modelo:</div>
            <div class="info-value"><strong>${quote.vehicle.brand} ${quote.vehicle.model}</strong></div>
          </div>
          <div class="info-row">
            <div class="info-label">Patente:</div>
            <div class="info-value"><strong>${quote.vehicle.licensePlate}</strong></div>
          </div>
          <div class="info-row">
            <div class="info-label">Año:</div>
            <div class="info-value">${quote.vehicle.year}</div>
          </div>
        </div>
      </div>
      
      <!-- Trabajos Realizados -->
      <div class="section">
        <div class="section-title">🔧 Trabajos Realizados</div>
        <div class="description-box">
          ${order.workDescription.replace(/\n/g, '<br>')}
          ${order.additionalWork ? `
            <div style="margin-top: 15px; padding-top: 15px; border-top: 2px dashed #e0e0e0;">
              <strong style="color: ${this.brandColors.primary};">Trabajos Adicionales:</strong><br>
              ${order.additionalWork.replace(/\n/g, '<br>')}
            </div>
          ` : ''}
        </div>
      </div>
      
      <!-- Costo Final -->
      ${order.finalCost ? `
        <div class="highlight-box">
          <div class="highlight-label">Costo Final</div>
          <div class="highlight-value">$${order.finalCost.toLocaleString('es-CL')}</div>
        </div>
      ` : ''}
      
      <!-- Horarios de Retiro -->
      <div style="background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%); padding: 25px; border-radius: 8px; margin: 25px 0;">
        <div style="font-size: 16px; font-weight: 700; color: #1565c0; margin-bottom: 15px; text-align: center;">
          📅 Horarios para Retirar su Vehículo
        </div>
        <div style="color: #1976d2; font-size: 14px; line-height: 2;">
          <div><strong>Lunes a Viernes:</strong> 9:00 - 18:00 hrs</div>
          <div><strong>Sábados:</strong> 9:00 - 13:00 hrs</div>
          <div><strong>Domingos y Festivos:</strong> Cerrado</div>
        </div>
      </div>
      
      <!-- Importante -->
      <div class="alert-box">
        <strong>📋 Para retirar su vehículo:</strong>
        <p>• Traiga su documento de identidad (CI o Pasaporte)</p>
        <p>• Orden de trabajo N° ${order.orderNumber}</p>
        <p>• Si retira otra persona, debe traer autorización escrita y firmada</p>
      </div>
      
      <!-- Botón WhatsApp -->
      <div class="button-container">
        <a href="${whatsappUrl}" class="button button-whatsapp">
          💬 Coordinar Retiro por WhatsApp
        </a>
      </div>
      
      <div style="text-align: center; background: #f8f9fa; padding: 25px; border-radius: 8px; margin-top: 30px;">
        <p style="font-size: 18px; color: ${this.brandColors.success}; font-weight: 600; margin-bottom: 10px;">
          ¡Gracias por confiar en nosotros!
        </p>
        <p style="font-size: 14px; color: ${this.brandColors.textLight}; margin: 0;">
          Fue un placer atender su vehículo. Esperamos verle pronto nuevamente.
        </p>
      </div>
    </div>
    `;

    return {
      from: `"${this.workshopInfo.name}" <${this.workshopInfo.email}>`,
      to: client.email,
      subject: `¡Su vehículo está listo! 🎉 - Orden ${order.orderNumber} - ${this.workshopInfo.name}`,
      html: this.getEmailTemplate(content),
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

    if (result.success) {
      console.log(`Email de vehículo listo enviado - Orden: ${quote.workOrder.orderNumber} - Cliente: ${client.email}`);
    } else {
      console.error(`Falló envío de email de vehículo listo - Orden: ${quote.workOrder.orderNumber} - Error: ${result.error}`);
    }

    return result;
  }
}

module.exports = new EmailService();