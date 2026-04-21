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

export async function PATCH(request, { params }) {
  return handleRequest(request, params, 'PATCH');
}

export async function DELETE(request, { params }) {
  return handleRequest(request, params, 'DELETE');
}

async function handleRequest(request, params, method) {
  const pathParts = await params;
  const path = pathParts.path.join('/');
  const searchParams = new URL(request.url).search;
  
  // Use environment variable for backend URL, fallback to localhost only in dev
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 
                     process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/v1\/?$/, '') || 
                     (process.env.NODE_ENV === 'development' ? 'http://localhost:5000' : null);
  
  if (!backendUrl) {
    console.error('[Bridge] CRITICAL: NEXT_PUBLIC_BACKEND_URL is not defined in production environment.');
    return NextResponse.json({ success: false, message: 'Infrastructure Configuration Error: Backend target undefined.' }, { status: 500 });
  }

  // Sanitize backendUrl to prevent double prefixes if the user includes /api in their env var
  const cleanBackendUrl = backendUrl.replace(/\/api\/v1\/?$/, '').replace(/\/api\/?$/, '');
  const BACKEND_URL = `${cleanBackendUrl}/api/v1/${path}${searchParams}`;

  try {
    const headers = new Headers();
    // Inherit critical headers from the frontend request
    if (request.headers.get('authorization')) headers.set('authorization', request.headers.get('authorization'));
    if (request.headers.get('content-type')) headers.set('content-type', request.headers.get('content-type'));
    
    // Set appropriate origin and host headers based on environment
    const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://aura-market-com.vercel.app';
    const backendHost = new URL(backendUrl).host;
    headers.set('Origin', frontendUrl);
    headers.set('Host', backendHost);

    const options = {
      method,
      headers,
    };

    // Handle Body for mutation requests (POST/PUT/PATCH/DELETE)
    if (!['GET', 'HEAD'].includes(method)) {
      const contentType = request.headers.get('content-type') || '';
      
      // For multipart/form-data (uploads), we must forward the raw body stream
      if (contentType.includes('multipart/form-data')) {
        options.body = await request.formData();
        // Browser sets boundary automatically, so we let the backend handle it
        headers.delete('content-type'); 
      } else {
        const body = await request.arrayBuffer();
        if (body.byteLength > 0) options.body = body;
      }
    }

    console.log(`[Bridge] ${method} -> ${BACKEND_URL}`);
    const response = await fetch(BACKEND_URL, options);
    
    if (!response.ok) {
      console.warn(`[Bridge Error] Backend returned ${response.status} for ${path}`);
    }

    // Capture the raw buffer or text from backend
    const resContentType = response.headers.get('Content-Type') || 'application/json';
    const responseData = await response.arrayBuffer();

    return new NextResponse(responseData, {
      status: response.status,
      headers: {
        'Content-Type': resContentType,
      },
    });
  } catch (error) {
    console.error('[API Proxy Critical Failure]:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Secure Bridge Handshake Failed', 
      detail: error.message 
    }, { status: 502 });
  }
}
