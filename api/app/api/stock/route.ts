import { NextRequest, NextResponse } from 'next/server';
import { Categoria } from '@prisma/client';
import { stockService } from '../../../lib/container';
import { requireUser, withErrorHandling } from '../../../lib/auth';

export const GET = withErrorHandling(async (request: NextRequest) => {
  const user = await requireUser(request);
  const categoria = (request.nextUrl.searchParams.get('categoria') as Categoria | null) ?? undefined;
  const resumen = await stockService.getResumen(user.negocioId, categoria);
  return NextResponse.json(resumen, { status: 200 });
});
