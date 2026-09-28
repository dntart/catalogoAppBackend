import type { PrismaClient } from '@prisma/client';
import { nuevaSesion, WhatsappSession } from './types';

/**
 * Reemplaza el Map en memoria de la version NestJS. Vercel Functions no
 * comparten memoria entre invocaciones, asi que la sesion de cada numero de
 * WhatsApp se persiste en la tabla sesiones_whatsapp (Supabase).
 */
export class SessionStoreService {
  constructor(private readonly prisma: PrismaClient) {}

  async obtener(telefono: string): Promise<WhatsappSession> {
    const fila = await this.prisma.sesionWhatsapp.findUnique({ where: { telefono } });
    if (!fila) {
      return nuevaSesion();
    }
    return fila.estado as unknown as WhatsappSession;
  }

  /// Igual que obtener(), pero además devuelve cuándo se guardó por última
  /// vez — lo usa manejarMensaje() para detectar una lista de opciones
  /// vieja (ver detectarListaObsoleta en conversation.service.ts).
  async obtenerConFecha(
    telefono: string,
  ): Promise<{ session: WhatsappSession; actualizadoEn: Date | null }> {
    const fila = await this.prisma.sesionWhatsapp.findUnique({ where: { telefono } });
    if (!fila) {
      return { session: nuevaSesion(), actualizadoEn: null };
    }
    return {
      session: fila.estado as unknown as WhatsappSession,
      actualizadoEn: fila.actualizadoEn,
    };
  }

  async guardar(telefono: string, session: WhatsappSession): Promise<void> {
    await this.prisma.sesionWhatsapp.upsert({
      where: { telefono },
      create: { telefono, estado: session as object },
      update: { estado: session as object },
    });
  }

  async reiniciar(telefono: string): Promise<WhatsappSession> {
    const sesion = nuevaSesion();
    await this.guardar(telefono, sesion);
    return sesion;
  }
}
