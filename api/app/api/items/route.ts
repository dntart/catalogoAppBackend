import { NextRequest, NextResponse } from 'next/server';
import { itemsService } from '../../../lib/container';
import { validateBody } from '../../../lib/validate';
import { CreateItemDto } from '../../../lib/modules/items/dto/create-item.dto';
import { requireUser, withErrorHandling } from '../../../lib/auth';

export const POST = withErrorHandling(async (request: NextRequest) => {
  const user = await requireUser(request);
  const dto = await validateBody(CreateItemDto, await request.json());
  const item = await itemsService.create(user.negocioId, dto);
  return NextResponse.json(item, { status: 201 });
});

export const GET = withErrorHandling(async (request: NextRequest) => {
  const user = await requireUser(request);
  const activoParam = request.nextUrl.searchParams.get('activo');
  const activo = activoParam === null ? undefined : activoParam === 'true';
  const items = await itemsService.findAll(user.negocioId, activo);
  return NextResponse.json(items, { status: 200 });
});
