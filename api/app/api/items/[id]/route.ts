import { NextRequest, NextResponse } from 'next/server';
import { itemsService } from '../../../../lib/container';
import { validateBody } from '../../../../lib/validate';
import { UpdateItemDto } from '../../../../lib/modules/items/dto/update-item.dto';
import { requireUser, withErrorHandling } from '../../../../lib/auth';

interface Params {
  params: Promise<{ id: string }>;
}

export const GET = withErrorHandling(async (request: NextRequest, { params }: Params) => {
  const user = await requireUser(request);
  const { id } = await params;
  const item = await itemsService.findOne(user.negocioId, id);
  return NextResponse.json(item, { status: 200 });
});

export const PATCH = withErrorHandling(async (request: NextRequest, { params }: Params) => {
  const user = await requireUser(request);
  const { id } = await params;
  const dto = await validateBody(UpdateItemDto, await request.json());
  const item = await itemsService.update(user.negocioId, id, dto);
  return NextResponse.json(item, { status: 200 });
});
