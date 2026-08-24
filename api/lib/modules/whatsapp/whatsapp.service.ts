import { Twilio } from 'twilio';

function env(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Falta la variable de entorno ${key}`);
  return value;
}

export class WhatsappService {
  private readonly client: Twilio;
  private readonly from: string;

  constructor() {
    this.client = new Twilio(env('TWILIO_ACCOUNT_SID'), env('TWILIO_AUTH_TOKEN'));
    this.from = env('TWILIO_WHATSAPP_FROM');
  }

  async enviarMensaje(to: string, body: string): Promise<void> {
    await this.client.messages.create({ from: this.from, to, body });
  }

  /** Envía el texto como mensaje interactivo con botones táctiles "Sí"/"No"
   * (plantilla de Quick Reply de Twilio Content API) en vez de pedirle al
   * usuario que escriba la respuesta a mano — así se elimina la posibilidad
   * de tipear mal "si"/"no" en una confirmación. Si no hay plantilla
   * configurada, degrada a un mensaje de texto plano normal. */
  async enviarConfirmacion(to: string, cuerpo: string): Promise<void> {
    const contentSid = process.env.TWILIO_CONTENT_SID_SI_NO;
    if (!contentSid) {
      await this.enviarMensaje(to, cuerpo);
      return;
    }
    await this.client.messages.create({
      from: this.from,
      to,
      contentSid,
      contentVariables: JSON.stringify({ '1': cuerpo }),
    });
  }
}
