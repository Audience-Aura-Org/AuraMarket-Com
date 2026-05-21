import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const pathParts = await params;
  const path = pathParts.path.join('/');
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/v1\/?$/, '') || (process.env.NODE_ENV === 'development' ? 'http://localhost:5000' : null);
  if (!backendUrl) {
    return NextResponse.json({ error: 'Backend URL is not configured.' }, { status: 500 });
  }
  const BACKEND_URL = `${backendUrl}/uploads/${path}`;

  try {
    const response = await fetch(BACKEND_URL);
    if (!response.ok) throw new Error(`Backend Image Fetch Failed: ${response.status}`);
    
    const blob = await response.blob();
    return new NextResponse(blob, {
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
}
