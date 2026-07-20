import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Twilio } from 'twilio';

@Injectable()
export class WhatsappService {
  private readonly client: Twilio;
  private readonly from: string;

  constructor(private readonly configService: ConfigService) {
    this.client = new Twilio(
      this.configService.getOrThrow<string>('TWILIO_ACCOUNT_SID'),
      this.configService.getOrThrow<string>('TWILIO_AUTH_TOKEN'),
    );
    this.from = this.configService.getOrThrow<string>('TWILIO_WHATSAPP_FROM');
  }

  async enviarMensaje(to: string, body: string): Promise<void> {
    await this.client.messages.create({ from: this.from, to, body });
  }
}
