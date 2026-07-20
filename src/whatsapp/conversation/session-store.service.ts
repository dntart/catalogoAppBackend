import { Injectable } from '@nestjs/common';
import { nuevaSesion, WhatsappSession } from './types';

@Injectable()
export class SessionStoreService {
  private readonly sesiones = new Map<string, WhatsappSession>();

  obtener(telefono: string): WhatsappSession {
    const existente = this.sesiones.get(telefono);
    if (existente) {
      return existente;
    }
    const sesion = nuevaSesion();
    this.sesiones.set(telefono, sesion);
    return sesion;
  }

  guardar(telefono: string, session: WhatsappSession): void {
    this.sesiones.set(telefono, session);
  }

  reiniciar(telefono: string): WhatsappSession {
    const sesion = nuevaSesion();
    this.sesiones.set(telefono, sesion);
    return sesion;
  }
}
