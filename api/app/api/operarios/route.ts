import { NextRequest, NextResponse } from 'next/server';
import { operariosService } from '../../../lib/container';
import { validateBody } from '../../../lib/validate';
import { CreateOperarioDto } from '../../../lib/modules/operarios/dto/create-operario.dto';
import { requireUser, withErrorHandling } from '../../../lib/auth';

export const POST = withErrorHandling(async (request: NextRequest) => {
  const user = await requireUser(request);
  const dto = await validateBody(CreateOperarioDto, await request.json());
  const operario = await operariosService.create(user.negocioId, dto);
  return NextResponse.json(operario, { status: 201 });
});

export const GET = withErrorHandling(async (request: NextRequest) => {
  const user = await requireUser(request);
  const activoParam = request.nextUrl.searchParams.get('activo');
  const activo = activoParam === null ? undefined : activoParam === 'true';
  const operarios = await operariosService.findAll(user.negocioId, activo);
  return NextResponse.json(operarios, { status: 200 });
});
