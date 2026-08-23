import { NextRequest, NextResponse } from 'next/server';
import { ordenesProduccionService } from '../../../lib/container';
import { validateBody } from '../../../lib/validate';
import { CreateOrdenProduccionDto } from '../../../lib/modules/ordenes-produccion/dto/create-orden-produccion.dto';
import { requireUser, withErrorHandling } from '../../../lib/auth';

export const POST = withErrorHandling(async (request: NextRequest) => {
  const user = await requireUser(request);
  const dto = await validateBody(CreateOrdenProduccionDto, await request.json());
  const orden = await ordenesProduccionService.create(user.negocioId, dto);
  return NextResponse.json(orden, { status: 201 });
});

export const GET = withErrorHandling(async (request: NextRequest) => {
  const user = await requireUser(request);
  const operarioId = request.nextUrl.searchParams.get('operarioId') ?? undefined;
  const ordenes = await ordenesProduccionService.findAll(user.negocioId, operarioId);
  return NextResponse.json(ordenes, { status: 200 });
});
