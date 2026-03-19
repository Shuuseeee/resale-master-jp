import { NextResponse } from 'next/server';

// Server-side cache with longer TTL
interface CacheEntry {
  data: any;
  timestamp: number;
}

const serverCache = new Map<string, CacheEntry>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

// Rate limiting: track last request time per IP
const rateLimitMap = new Map<string, number>();
const MIN_REQUEST_INTERVAL = 2000; // 2 seconds between requests

// Random User-Agent pool to rotate
const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
];

// Token pool - loaded from environment variables
const API_TOKENS = (process.env.KAITORIX_API_TOKENS || '')
  .split(',')
  .map(t => t.trim())
  .filter(Boolean);

// Circuit breaker: stop requests if too many failures
interface CircuitBreakerState {
  failureCount: number;
  lastFailureTime: number;
  isOpen: boolean;
}

const circuitBreaker: CircuitBreakerState = {
  failureCount: 0,
  lastFailureTime: 0,
  isOpen: false,
};

const CIRCUIT_BREAKER_THRESHOLD = 2; // Open after 2 consecutive failures (more sensitive)
const CIRCUIT_BREAKER_TIMEOUT = 10 * 60 * 1000; // Try again after 10 minutes (longer cooldown)
const CIRCUIT_BREAKER_RESET_TIME = 60 * 1000; // Reset counter after 1 minute of no failures

function checkCircuitBreaker(): boolean {
  const now = Date.now();

  // If circuit is open, check if timeout has passed
  if (circuitBreaker.isOpen) {
    if (now - circuitBreaker.lastFailureTime > CIRCUIT_BREAKER_TIMEOUT) {
      console.log('Circuit breaker: attempting to close, testing connection...');
      circuitBreaker.isOpen = false;
      circuitBreaker.failureCount = 0;
      return true;
    }
    return false;
  }

  // Reset failure count if last failure was long ago
  if (circuitBreaker.failureCount > 0 && now - circuitBreaker.lastFailureTime > CIRCUIT_BREAKER_RESET_TIME) {
    circuitBreaker.failureCount = 0;
  }

  return true;
}

function recordFailure(status: number): void {
  // Only count 403/429 as circuit breaker failures (not 404, 500, etc)
  if (status === 403 || status === 429) {
    circuitBreaker.failureCount++;
    circuitBreaker.lastFailureTime = Date.now();

    if (circuitBreaker.failureCount >= CIRCUIT_BREAKER_THRESHOLD) {
      circuitBreaker.isOpen = true;
      console.error(`Circuit breaker OPEN: ${circuitBreaker.failureCount} consecutive failures. Pausing requests for ${CIRCUIT_BREAKER_TIMEOUT / 60000} minutes.`);
    }
  }
}

function recordSuccess(): void {
  if (circuitBreaker.failureCount > 0) {
    console.log('Circuit breaker: request succeeded, resetting failure count');
  }
  circuitBreaker.failureCount = 0;
}

// Track request count per token (sliding window)
const tokenRequestCount = new Map<string, { count: number; windowStart: number }>();
const TOKEN_WINDOW_MS = 60000; // 60 second window (longer)
const MAX_REQUESTS_PER_WINDOW = 8; // Ultra-conservative: 8 requests per 60s

function getAvailableToken(): string | null {
  const now = Date.now();

  for (const token of API_TOKENS) {
    const record = tokenRequestCount.get(token);

    if (!record) {
      // First use of this token
      tokenRequestCount.set(token, { count: 1, windowStart: now });
      return token;
    }

    // Check if window has expired
    if (now - record.windowStart > TOKEN_WINDOW_MS) {
      // Reset window
      tokenRequestCount.set(token, { count: 1, windowStart: now });
      return token;
    }

    // Check if under limit
    if (record.count < MAX_REQUESTS_PER_WINDOW) {
      record.count++;
      return token;
    }
  }

  // All tokens exhausted
  return null;
}

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  return forwarded?.split(',')[0] || realIP || 'unknown';
}

// Add random delay to mimic human behavior
function randomDelay(min: number, max: number): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, delay));
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jan: string }> }
) {
  const { jan } = await params;

  if (!jan || !/^\d+$/.test(jan)) {
    return NextResponse.json(
      { error: 'Invalid JAN code' },
      { status: 400 }
    );
  }

  // Check server-side cache first
  const cached = serverCache.get(jan);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json(cached.data);
  }

  // Check circuit breaker
  if (!checkCircuitBreaker()) {
    console.warn(`Circuit breaker is OPEN, returning cached data for ${jan}`);
    if (cached) {
      return NextResponse.json(cached.data);
    }
    return NextResponse.json(
      { error: 'Service temporarily unavailable due to rate limiting. Please try again later.' },
      { status: 503 }
    );
  }

  // Rate limiting per client IP
  const clientIP = getClientIP(request);
  const lastRequestTime = rateLimitMap.get(clientIP) || 0;
  const timeSinceLastRequest = Date.now() - lastRequestTime;

  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  // Add random delay (500-1500ms) to mimic human browsing
  await randomDelay(500, 1500);

  rateLimitMap.set(clientIP, Date.now());

  // Get available token
  const token = getAvailableToken();
  if (!token) {
    // All tokens exhausted, return cached data if available
    if (cached) {
      console.warn(`All tokens exhausted for ${jan}, returning stale cache`);
      return NextResponse.json(cached.data);
    }
    return NextResponse.json(
      { error: 'Rate limit exceeded, please try again later' },
      { status: 429 }
    );
  }

  try {
    const response = await fetch(
      `https://kaitorix.app/api/product/${jan}?token=${token}`,
      {
        headers: {
          'X-API-Token': token,
          'Referer': 'https://kaitorix.app/',
          'Origin': 'https://kaitorix.app',
          'User-Agent': getRandomUserAgent(),
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'same-origin',
        },
        // Add cache control to avoid Next.js aggressive caching
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      // Record failure for circuit breaker
      recordFailure(response.status);

      // If rate limited (429) or forbidden (403), return cached data if available
      if ((response.status === 429 || response.status === 403) && cached) {
        console.warn(`KaitoriX rate limit hit for ${jan} (status ${response.status}), returning stale cache`);
        return NextResponse.json(cached.data);
      }

      return NextResponse.json(
        { error: 'Failed to fetch from KaitoriX' },
        { status: response.status }
      );
    }

    // Record success for circuit breaker
    recordSuccess();

    const data = await response.json();

    // Cache the successful response
    serverCache.set(jan, { data, timestamp: Date.now() });

    // Clean up old cache entries (keep last 1000)
    if (serverCache.size > 1000) {
      const entries = Array.from(serverCache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      entries.slice(0, 500).forEach(([key]) => serverCache.delete(key));
    }

    // Clean up old rate limit entries (older than 5 minutes)
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    for (const [ip, timestamp] of rateLimitMap.entries()) {
      if (timestamp < fiveMinutesAgo) {
        rateLimitMap.delete(ip);
      }
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('KaitoriX API error:', error);

    // Return stale cache on error if available
    if (cached) {
      console.warn(`KaitoriX error for ${jan}, returning stale cache`);
      return NextResponse.json(cached.data);
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
