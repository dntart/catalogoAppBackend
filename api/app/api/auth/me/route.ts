import { NextRequest, NextResponse } from 'next/server';
import { requireUser, withErrorHandling } from '../../../../lib/auth';

export const GET = withErrorHandling(async (request: NextRequest) => {
  const user = await requireUser(request);
  return NextResponse.json(user, { status: 200 });
});
