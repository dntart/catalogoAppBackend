import { NextRequest, NextResponse } from 'next/server';
import { validateRequest } from 'twilio';
import {
  conversationService,
  sessionStoreService,
  usersService,
  whatsappService,
} from '../../../../lib/container';
import { FlowStep } from '../../../../lib/modules/whatsapp/conversation/types';

/**
 * Rechaza cualquier request que no venga firmado por Twilio — sin esto,
 * cualquiera que supiera esta URL y un número registrado podría simular
 * mensajes y cargar movimientos falsos en el negocio de otro.
 */
function verificarFirmaTwilio(signature: string | null, body: Record<string, string>): boolean {
  if (!signature) return false;
  const url = `${process.env.PUBLIC_APP_URL}/api/whatsapp/webhook`;
  return validateRequest(process.env.TWILIO_AUTH_TOKEN!, signature, url, body);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const formData = await request.formData();
  const body: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    body[key] = String(value);
  }

  const signature = request.headers.get('x-twilio-signature');
  if (!verificarFirmaTwilio(signature, body)) {
    console.warn('Webhook rechazado: firma de Twilio inválida o ausente');
    return NextResponse.json({ message: 'Firma de Twilio inválida' }, { status: 403 });
  }

  const from = body.From;
  const texto = body.Body ?? '';
  if (!from) {
    return NextResponse.json({}, { status: 200 });
  }

  const owner = await usersService.findByWhatsappNumber(from);
  if (!owner || !owner.activo) {
    console.warn(`Mensaje ignorado de un número no registrado: ${from}`);
    return NextResponse.json({}, { status: 200 });
  }

  const respuesta = await conversationService.manejarMensaje(owner.negocioId, from, texto);

  try {
    // manejarMensaje ya persistió la sesión antes de devolver la respuesta
    // (guardado único al final de la conversación) — releerla acá es barato
    // y nos dice, sin tocar la lógica conversacional, si lo que hay que
    // mandar es una confirmación (para ofrecerla con botones Sí/No en vez
    // de pedir que se escriba a mano).
    const sesion = await sessionStoreService.obtener(from);
    if (sesion.step === FlowStep.CONFIRMAR) {
      await whatsappService.enviarConfirmacion(from, respuesta);
    } else {
      await whatsappService.enviarMensaje(from, respuesta);
    }
  } catch (error) {
    console.error('No se pudo enviar la respuesta por WhatsApp', error);
  }

  return NextResponse.json({}, { status: 200 });
}
