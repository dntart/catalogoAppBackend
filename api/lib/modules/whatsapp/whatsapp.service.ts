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
}
