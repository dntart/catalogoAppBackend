import { NextRequest, NextResponse } from 'next/server';
import { validateRequest } from 'twilio';
import {
  conversationService,
  sessionStoreService,
  usersService,
  whatsappService,
} from '../../../../lib/container';
import { FlowStep } from '../../../../lib/modules/whatsapp/conversation/types';

/// Pasos donde la pregunta pendiente es sí/no — se ofrecen con los botones
/// táctiles de la plantilla de Quick Reply en vez de pedir que se escriba
/// a mano.
const PASOS_CON_BOTONES_SI_NO: FlowStep[] = [
  FlowStep.CONFIRMAR,
  FlowStep.NUEVO_ITEM_TIENE_GRUPO,
  FlowStep.NUEVO_ITEM_TIENE_COLOR,
];

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
    // y nos dice, sin tocar la lógica conversacional, si el próximo paso es
    // una pregunta sí/no (para ofrecerla con botones táctiles en vez de
    // pedir que se escriba a mano).
    const sesion = await sessionStoreService.obtener(from);
    if (PASOS_CON_BOTONES_SI_NO.includes(sesion.step)) {
      await whatsappService.enviarConfirmacion(from, respuesta);
    } else {
      await whatsappService.enviarMensaje(from, respuesta);
    }
  } catch (error) {
    console.error('No se pudo enviar la respuesta por WhatsApp', error);
  }

  return NextResponse.json({}, { status: 200 });
}
