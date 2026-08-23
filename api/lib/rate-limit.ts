import { NextRequest } from 'next/server';
import { prisma } from './prisma';
import { HttpError } from './auth';

export class TooManyRequestsError extends HttpError {
  constructor() {
    super('Demasiados intentos, esperá un minuto y volvé a probar', 429);
  }
}

function clientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'desconocida'
  );
}

/**
 * Reemplaza @nestjs/throttler. En NestJS el conteo vivía en memoria del
 * proceso; acá no hay memoria compartida entre invocaciones serverless, así
 * que el contador se persiste en la tabla intentos_rate_limit (Supabase).
 * Ventana fija simple: `limit` intentos cada `windowMs` por IP+ruta.
 */
export async function rateLimit(
  request: NextRequest,
  routeKey: string,
  limit: number,
  windowMs: number,
): Promise<void> {
  const clave = `${routeKey}:${clientIp(request)}`;
  const ahora = new Date();

  const existente = await prisma.intentoRateLimit.findUnique({ where: { clave } });

  if (!existente || existente.ventanaFin < ahora) {
    await prisma.intentoRateLimit.upsert({
      where: { clave },
      create: { clave, intentos: 1, ventanaFin: new Date(ahora.getTime() + windowMs) },
      update: { intentos: 1, ventanaFin: new Date(ahora.getTime() + windowMs) },
    });
    return;
  }

  if (existente.intentos >= limit) {
    throw new TooManyRequestsError();
  }

  await prisma.intentoRateLimit.update({
    where: { clave },
    data: { intentos: { increment: 1 } },
  });
}
