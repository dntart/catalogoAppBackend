import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
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
  ) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async recibirMensaje(@Body() body: Record<string, string>): Promise<void> {
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
}
