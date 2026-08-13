import {
  Body,
  Controller,
  ForbiddenException,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeController } from '@nestjs/swagger';
import { validateRequest } from 'twilio';
import { Public } from '../auth/decorators/public.decorator';
import { ConversationService } from './conversation/conversation.service';
import { WhatsappService } from './whatsapp.service';
import { UsersService } from '../users/users.service';

@ApiExcludeController()
@Public()
@Controller('whatsapp')
export class WhatsappController {
  private readonly logger = new Logger(WhatsappController.name);

  constructor(
    private readonly conversationService: ConversationService,
    private readonly whatsappService: WhatsappService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async recibirMensaje(
    @Body() body: Record<string, string>,
    @Headers('x-twilio-signature') signature?: string,
  ): Promise<void> {
    this.verificarFirmaTwilio(signature, body);

    const from = body.From;
    const texto = body.Body ?? '';

    if (!from) {
      return;
    }

    const owner = await this.usersService.findByWhatsappNumber(from);
    if (!owner || !owner.activo) {
      this.logger.warn(`Mensaje ignorado de un número no registrado: ${from}`);
      return;
    }

    const respuesta = await this.conversationService.manejarMensaje(
      owner.negocioId,
      from,
      texto,
    );

    try {
      await this.whatsappService.enviarMensaje(from, respuesta);
    } catch (error) {
      this.logger.error(
        'No se pudo enviar la respuesta por WhatsApp',
        error instanceof Error ? error.stack : error,
      );
    }
  }

  /**
   * Rechaza cualquier request que no venga firmado por Twilio — sin esto,
   * cualquiera que supiera esta URL y un número registrado podría simular
   * mensajes y cargar movimientos falsos en el negocio de otro.
   */
  private verificarFirmaTwilio(
    signature: string | undefined,
    body: Record<string, string>,
  ): void {
    const url = `${this.configService.getOrThrow<string>('PUBLIC_APP_URL')}/whatsapp/webhook`;
    const authToken =
      this.configService.getOrThrow<string>('TWILIO_AUTH_TOKEN');

    if (!signature || !validateRequest(authToken, signature, url, body)) {
      this.logger.warn('Webhook rechazado: firma de Twilio inválida o ausente');
      throw new ForbiddenException('Firma de Twilio inválida');
    }
  }
}
