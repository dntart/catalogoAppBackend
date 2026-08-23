import { NextRequest, NextResponse } from 'next/server';
import { adminService } from '../../../../lib/container';
import { rateLimit } from '../../../../lib/rate-limit';
import { validateBody } from '../../../../lib/validate';
import { CreateNegocioDto } from '../../../../lib/modules/admin/dto/create-negocio.dto';
import { withErrorHandling } from '../../../../lib/auth';

// Alta self-service: público, sin autenticación — es el camino recomendado.
// POST /api/admin/negocios (protegido, solo super-admin) es el respaldo manual.
export const POST = withErrorHandling(async (request: NextRequest) => {
  await rateLimit(request, 'negocios-registro', 5, 60_000);
  const dto = await validateBody(CreateNegocioDto, await request.json());
  const negocio = await adminService.crearNegocio(dto);
  return NextResponse.json(negocio, { status: 201 });
});
