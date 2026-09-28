import { NextRequest, NextResponse } from 'next/server';
import { adminService } from '../../../../../lib/container';
import { validateBody } from '../../../../../lib/validate';
import { UpdateUsuarioAdminDto } from '../../../../../lib/modules/admin/dto/update-usuario-admin.dto';
import { requireSuperAdmin, requireUser, withErrorHandling } from '../../../../../lib/auth';

interface Params {
  params: Promise<{ id: string }>;
}

export const PATCH = withErrorHandling(async (request: NextRequest, { params }: Params) => {
  const user = await requireUser(request);
  requireSuperAdmin(user);
  const { id } = await params;
  const dto = await validateBody(UpdateUsuarioAdminDto, await request.json());
  const usuario = await adminService.actualizarUsuario(id, dto);
  return NextResponse.json(usuario, { status: 200 });
});
