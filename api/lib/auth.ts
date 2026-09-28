import jwt from 'jsonwebtoken';
import { NextRequest, NextResponse } from 'next/server';

export interface AuthenticatedUser {
  id: string;
  email: string;
  nombre: string;
  negocioId: string;
  whatsappNumber: string | null;
  esSuperAdmin: boolean;
  activo: boolean;
  createdAt: Date;
}

interface JwtPayload {
  sub: string;
  email: string;
  negocioId: string;
}

export class AuthError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/**
 * Reemplaza JwtAuthGuard + @CurrentUser() de la version NestJS: valida el
 * header Authorization, decodifica el JWT y carga el usuario real (rechaza
 * si esta inactivo) — mismo comportamiento que JwtStrategy tenia antes.
 */
export async function requireUser(request: NextRequest): Promise<AuthenticatedUser> {
  const header = request.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) {
    throw new AuthError('No autenticado', 401);
  }
  const token = header.slice('Bearer '.length);

  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
  } catch {
    throw new AuthError('Token invalido', 401);
  }

  const { prisma } = await import('./prisma');
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: { negocio: true },
  });
  if (!user || !user.activo || !user.negocio.activo) {
    throw new AuthError('Usuario inactivo o inexistente', 401);
  }

  return {
    id: user.id,
    email: user.email,
    nombre: user.nombre,
    negocioId: user.negocioId,
    whatsappNumber: user.whatsappNumber,
    esSuperAdmin: user.esSuperAdmin,
    activo: user.activo,
    createdAt: user.createdAt,
  };
}

/** Reemplaza SuperAdminGuard. */
export function requireSuperAdmin(user: AuthenticatedUser): void {
  if (!user.esSuperAdmin) {
    throw new AuthError('Requiere permisos de super-admin', 403);
  }
}

export function signToken(user: { id: string; email: string; negocioId: string }): string {
  const payload: JwtPayload = { sub: user.id, email: user.email, negocioId: user.negocioId };
  return jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn: (process.env.JWT_EXPIRES_IN ?? '7d') as jwt.SignOptions['expiresIn'],
  });
}

/** Envuelve un handler para convertir AuthError / errores conocidos en respuestas JSON consistentes. */
export function withErrorHandling(
  handler: (request: NextRequest, ctx: any) => Promise<NextResponse>,
) {
  return async (request: NextRequest, ctx: any): Promise<NextResponse> => {
    try {
      return await handler(request, ctx);
    } catch (error) {
      if (error instanceof AuthError) {
        return NextResponse.json({ message: error.message }, { status: error.status });
      }
      if (error instanceof HttpError) {
        return NextResponse.json({ message: error.message }, { status: error.status });
      }
      console.error(error);
      return NextResponse.json({ message: 'Error interno' }, { status: 500 });
    }
  };
}

/** Errores de negocio con status HTTP — reemplaza NotFoundException/BadRequestException/ConflictException de Nest. */
export class HttpError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export class NotFoundError extends HttpError {
  constructor(message: string) {
    super(message, 404);
  }
}
export class BadRequestError extends HttpError {
  constructor(message: string) {
    super(message, 400);
  }
}
export class ConflictError extends HttpError {
  constructor(message: string) {
    super(message, 409);
  }
}
export class ForbiddenError extends HttpError {
  constructor(message: string) {
    super(message, 403);
  }
}
