import { NextResponse } from 'next/server';

export function middleware(request) {
  if (request.nextUrl.pathname === '/ping') {
    return new NextResponse('pong');
  }
}
