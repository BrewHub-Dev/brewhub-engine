import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY || "re_123456789");

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    const result = await resend.emails.send({
      from: process.env.EMAIL_FROM || "Brewhub <onboardingbrewsy@resend.dev>",
      to: options.to,
      subject: options.subject,
      html: options.html,
    });

    return !!result.data?.id;
  } catch (error) {
    console.error("Error sending email:", error);
    return false;
  }
}

export async function sendStockAlertEmail(
  to: string,
  shopName: string,
  lowStockItems: { name: string; quantity: number; minQuantity: number; unit: string }[]
): Promise<boolean> {
  const itemsHtml = lowStockItems
    .map(
      (item) => `
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd;">${item.name}</td>
      <td style="padding: 8px; border: 1px solid #ddd; color: ${
        item.quantity === 0 ? "#dc2626" : "#d97706"
      }; font-weight: bold;">
        ${item.quantity} ${item.unit}
      </td>
      <td style="padding: 8px; border: 1px solid #ddd;">${item.minQuantity} ${item.unit}</td>
    </tr>
  `
    )
    .join("");

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th { background: #f3f4f6; padding: 12px; text-align: left; border: 1px solid #ddd; }
      </style>
    </head>
    <body>
      <h2>🔔 Alerta de Stock Bajo</h2>
      <p>Hola,</p>
      <p>Los siguientes insumos están bajo el mínimo en <strong>${shopName}</strong>:</p>
      
      <table>
        <thead>
          <tr>
            <th>Insumo</th>
            <th>Cantidad Actual</th>
            <th>Mínimo</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>
      
      <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">
        Este es un mensaje automático de Brewhub. 
        <a href="${process.env.APP_URL || "http://localhost:3000"}">Ver inventario</a>
      </p>
    </body>
    </html>
  `;

  return sendEmail({
    to,
    subject: `🔔 Alerta: ${lowStockItems.length} insumo(s) bajo stock - ${shopName}`,
    html,
  });
}

export async function sendPromoCodeNotification(
  to: string,
  shopName: string,
  promoCode: string,
  usedCount: number
): Promise<boolean> {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
    </head>
    <body>
      <h2>🎉 Código de promoción usado</h2>
      <p>Hola,</p>
      <p>El código <strong>${promoCode}</strong> ha sido usado <strong>${usedCount}</strong> vez(ces) en <strong>${shopName}</strong>.</p>
      
      <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">
        Este es un mensaje automático de Brewhub.
      </p>
    </body>
    </html>
  `;

  return sendEmail({
    to,
    subject: `🎉 Código ${promoCode} usado - ${shopName}`,
    html,
  });
}
