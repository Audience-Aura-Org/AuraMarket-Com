import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  return handleRequest(request, params, 'GET');
}

export async function POST(request, { params }) {
  return handleRequest(request, params, 'POST');
}

export async function PUT(request, { params }) {
  return handleRequest(request, params, 'PUT');
}

export async function DELETE(request, { params }) {
  return handleRequest(request, params, 'DELETE');
}

async function handleRequest(request, params, method) {
  const pathParts = await params;
  const path = pathParts.path.join('/');
  const searchParams = new URL(request.url).search;
  
  const BACKEND_URL = `http://13.51.198.119:5000/api/v1/${path}${searchParams}`;

  try {
    const headers = new Headers(request.headers);
    headers.delete('host');
    headers.delete('connection');

    const options = {
      method,
      headers,
    };

    if (method !== 'GET' && method !== 'HEAD') {
      const body = await request.text();
      if (body) options.body = body;
    }

    const response = await fetch(BACKEND_URL, options);
    const data = await response.text();

    return new NextResponse(data, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'application/json',
      },
    });
  } catch (error) {
    console.error('[API Proxy Error]:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Secure Bridge Handshake Failed', 
      error: error.message 
    }, { status: 500 });
  }
}
