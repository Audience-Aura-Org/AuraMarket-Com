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
  
  // 🔥 CRITICAL: Ensure the final URL used for fetch() has a protocol (http/https)
  const baseWithProtocol = cleanBackendUrl.startsWith('http') ? cleanBackendUrl : `http://${cleanBackendUrl}`;
  const BACKEND_URL = `${baseWithProtocol}/api/v1/${path}${searchParams}`;

  try {
    const headers = new Headers();
    // Inherit critical headers from the frontend request
    if (request.headers.get('authorization')) headers.set('authorization', request.headers.get('authorization'));
    if (request.headers.get('content-type')) headers.set('content-type', request.headers.get('content-type'));
    if (request.headers.get('cookie')) headers.set('cookie', request.headers.get('cookie')); // forward auth cookie
    
    // Set appropriate origin and host headers based on environment
    const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://aura-market-com.vercel.app';
    
    let backendHost = '';
    try {
      // Ensure backendUrl has a protocol for the URL parser
      const urlWithProtocol = backendUrl.startsWith('http') ? backendUrl : `http://${backendUrl}`;
      backendHost = new URL(urlWithProtocol).host;
    } catch (e) {
      console.warn('[Bridge] Host parsing failed, using fallback host logic');
      backendHost = backendUrl.replace(/^https?:\/\//, '').split('/')[0];
    }

    if (backendHost) {
      // Note: Setting 'Host' header manually is forbidden in standard Fetch API and will throw TypeError.
      // We rely on fetch() to set the correct host based on the URL.
      console.log(`[Bridge] Target Host: ${backendHost}`);
    }
    headers.set('Origin', frontendUrl);
    headers.set('X-Forwarded-For', request.headers.get('x-forwarded-for') || '');
    headers.set('X-Forwarded-Host', backendHost);

    const controller = new AbortController();
    // 25s timeout: Eversend MoMo initiation + token fetch can take 10-15s on first call
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    const options = {
      method,
      headers,
      signal: controller.signal,
      cache: 'no-store',
      redirect: 'follow',
    };

    // Handle Body for mutation requests (POST/PUT/PATCH/DELETE)
    if (!['GET', 'HEAD'].includes(method)) {
      try {
        const body = await request.arrayBuffer();
        if (body && body.byteLength > 0) {
          options.body = body;
        }
      } catch (e) {
        console.warn('[Bridge] No body available for mutation request');
      }
    }

    console.log(`[Bridge] ${method} -> ${BACKEND_URL}`);
    const response = await fetch(BACKEND_URL, options);
    clearTimeout(timeoutId);
    
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
      error: {
        name: error.name,
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        backend: BACKEND_URL,
        method: method
      }
    }, { status: 502 });
  }
}
