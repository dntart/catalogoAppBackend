import { NextRequest, NextResponse } from 'next/server';
import { stockService } from '../../../../lib/container';
import { requireUser, withErrorHandling } from '../../../../lib/auth';

interface Params {
  params: Promise<{ itemId: string }>;
}

export const GET = withErrorHandling(async (request: NextRequest, { params }: Params) => {
  const user = await requireUser(request);
  const { itemId } = await params;
  const stock = await stockService.getStock(user.negocioId, itemId);
  return NextResponse.json({ itemId, stock }, { status: 200 });
});
