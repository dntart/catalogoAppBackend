import {
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Body,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeController } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { ConversationService } from './conversation/conversation.service';
import { WhatsappService } from './whatsapp.service';

@ApiExcludeController()
@Public()
@Controller('whatsapp')
export class WhatsappController {
  private readonly logger = new Logger(WhatsappController.name);

  constructor(
    private readonly conversationService: ConversationService,
    private readonly whatsappService: WhatsappService,
    private readonly configService: ConfigService,
  ) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async recibirMensaje(@Body() body: Record<string, string>): Promise<void> {
    const from = body.From;
    const texto = body.Body ?? '';
    const ownerNumber = this.configService.get<string>('OWNER_WHATSAPP_NUMBER');

    if (!from || !ownerNumber || from !== ownerNumber) {
      this.logger.warn(
        `Mensaje ignorado de un número no autorizado: ${from ?? 'desconocido'}`,
      );
      return;
    }

    const respuesta = await this.conversationService.manejarMensaje(
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
}
