import { NextRequest, NextResponse } from 'next/server';
import { adminService } from '../../../../../lib/container';
import { validateBody } from '../../../../../lib/validate';
import { UpdateNegocioAdminDto } from '../../../../../lib/modules/admin/dto/update-negocio-admin.dto';
import { requireSuperAdmin, requireUser, withErrorHandling } from '../../../../../lib/auth';

interface Params {
  params: Promise<{ id: string }>;
}

export const PATCH = withErrorHandling(async (request: NextRequest, { params }: Params) => {
  const user = await requireUser(request);
  requireSuperAdmin(user);
  const { id } = await params;
  const dto = await validateBody(UpdateNegocioAdminDto, await request.json());
  const negocio = await adminService.actualizarNegocio(id, dto);
  return NextResponse.json(negocio, { status: 200 });
});
