import { NextRequest, NextResponse } from 'next/server';
import { validateRequest } from 'twilio';
import {
  conversationService,
  usersService,
  whatsappService,
} from '../../../../lib/container';

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
    await whatsappService.enviarMensaje(from, respuesta);
  } catch (error) {
    console.error('No se pudo enviar la respuesta por WhatsApp', error);
  }

  return NextResponse.json({}, { status: 200 });
}
