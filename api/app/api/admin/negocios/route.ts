import { NextRequest, NextResponse } from 'next/server';
import { adminService } from '../../../../lib/container';
import { validateBody } from '../../../../lib/validate';
import { CreateNegocioDto } from '../../../../lib/modules/admin/dto/create-negocio.dto';
import { requireSuperAdmin, requireUser, withErrorHandling } from '../../../../lib/auth';

// Alta manual — respaldo para cuando el cliente no puede autogestionarse en
// POST /api/negocios/registro. Requiere esSuperAdmin: true en el token.
export const POST = withErrorHandling(async (request: NextRequest) => {
  const user = await requireUser(request);
  requireSuperAdmin(user);
  const dto = await validateBody(CreateNegocioDto, await request.json());
  const negocio = await adminService.crearNegocio(dto);
  return NextResponse.json(negocio, { status: 201 });
});

// Listado para el panel de super-admin: todos los negocios con sus usuarios
// (email, whatsapp, activo) — sin passwordHash.
export const GET = withErrorHandling(async (request: NextRequest) => {
  const user = await requireUser(request);
  requireSuperAdmin(user);
  const negocios = await adminService.listarNegocios();
  return NextResponse.json(negocios, { status: 200 });
});
