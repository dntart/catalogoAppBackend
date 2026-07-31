import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuthenticatedUser } from '../types/authenticated-user.type';

/**
 * Se usa junto con el JwtAuthGuard global (ya corrió y pobló request.user
 * para esta ruta, porque no está marcada @Public()) — acá solo se valida
 * el flag de super-admin.
 */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<{ user: AuthenticatedUser }>();
    if (!request.user?.esSuperAdmin) {
      throw new ForbiddenException('Requiere permisos de super-admin');
    }
    return true;
  }
}
