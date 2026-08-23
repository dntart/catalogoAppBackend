import { NextRequest, NextResponse } from 'next/server';
import { movimientosService } from '../../../lib/container';
import { validateBody } from '../../../lib/validate';
import { CreateMovimientoDto } from '../../../lib/modules/movimientos/dto/create-movimiento.dto';
import { requireUser, withErrorHandling } from '../../../lib/auth';

export const POST = withErrorHandling(async (request: NextRequest) => {
  const user = await requireUser(request);
  const dto = await validateBody(CreateMovimientoDto, await request.json());
  const movimiento = await movimientosService.create(user.negocioId, dto);
  return NextResponse.json(movimiento, { status: 201 });
});

export const GET = withErrorHandling(async (request: NextRequest) => {
  const user = await requireUser(request);
  const itemId = request.nextUrl.searchParams.get('itemId') ?? undefined;
  const movimientos = await movimientosService.findAll(user.negocioId, itemId);
  return NextResponse.json(movimientos, { status: 200 });
});
