import { NextRequest, NextResponse } from 'next/server';
import { ordenesProduccionService } from '../../../../lib/container';
import { requireUser, withErrorHandling } from '../../../../lib/auth';

interface Params {
  params: Promise<{ id: string }>;
}

export const GET = withErrorHandling(async (request: NextRequest, { params }: Params) => {
  const user = await requireUser(request);
  const { id } = await params;
  const orden = await ordenesProduccionService.findOne(user.negocioId, id);
  return NextResponse.json(orden, { status: 200 });
});
