import { NextRequest, NextResponse } from 'next/server';
import { authService } from '../../../../lib/container';
import { rateLimit } from '../../../../lib/rate-limit';
import { validateBody } from '../../../../lib/validate';
import { LoginDto } from '../../../../lib/modules/auth/dto/login.dto';
import { withErrorHandling } from '../../../../lib/auth';

export const POST = withErrorHandling(async (request: NextRequest) => {
  await rateLimit(request, 'login', 5, 60_000);
  const dto = await validateBody(LoginDto, await request.json());
  const result = await authService.login(dto.email, dto.password);
  return NextResponse.json(result, { status: 200 });
});
