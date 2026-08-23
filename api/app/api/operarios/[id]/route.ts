import { NextRequest, NextResponse } from 'next/server';
import { operariosService } from '../../../../lib/container';
import { validateBody } from '../../../../lib/validate';
import { UpdateOperarioDto } from '../../../../lib/modules/operarios/dto/update-operario.dto';
import { requireUser, withErrorHandling } from '../../../../lib/auth';

interface Params {
  params: Promise<{ id: string }>;
}

export const GET = withErrorHandling(async (request: NextRequest, { params }: Params) => {
  const user = await requireUser(request);
  const { id } = await params;
  const operario = await operariosService.findOne(user.negocioId, id);
  return NextResponse.json(operario, { status: 200 });
});

export const PATCH = withErrorHandling(async (request: NextRequest, { params }: Params) => {
  const user = await requireUser(request);
  const { id } = await params;
  const dto = await validateBody(UpdateOperarioDto, await request.json());
  const operario = await operariosService.update(user.negocioId, id, dto);
  return NextResponse.json(operario, { status: 200 });
});
