import { NextRequest, NextResponse } from 'next/server';

// Reemplaza app.enableCors() de NestJS — acepta una lista de origenes
// separados por coma en CORS_ORIGIN (mismo formato que la version anterior),
// asi conviven el dominio de produccion del frontend y localhost de dev.
function allowedOrigins(): string[] {
  return (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim());
}

export function middleware(request: NextRequest): NextResponse {
  const origin = request.headers.get('origin') ?? '';
  const allowed = allowedOrigins().includes(origin);

  if (request.method === 'OPTIONS') {
    const res = new NextResponse(null, { status: 204 });
    if (allowed) res.headers.set('Access-Control-Allow-Origin', origin);
    res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
    res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res;
  }

  const res = NextResponse.next();
  if (allowed) res.headers.set('Access-Control-Allow-Origin', origin);
  return res;
}

export const config = {
  matcher: '/api/:path*',
};
