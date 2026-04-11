import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const pathParts = await params;
  const path = pathParts.path.join('/');
  const BACKEND_URL = `http://13.51.198.119:5000/uploads/${path}`;

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
