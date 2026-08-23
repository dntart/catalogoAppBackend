import { NextRequest, NextResponse } from 'next/server';
import { movimientosService } from '../../../../lib/container';
import { requireUser, withErrorHandling } from '../../../../lib/auth';

interface Params {
  params: Promise<{ id: string }>;
}

export const GET = withErrorHandling(async (request: NextRequest, { params }: Params) => {
  const user = await requireUser(request);
  const { id } = await params;
  const movimiento = await movimientosService.findOne(user.negocioId, id);
  return NextResponse.json(movimiento, { status: 200 });
});
