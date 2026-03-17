// KaitoriX Rate Limiting Configuration
// Adjust these values based on observed behavior

export interface KaitorixRateLimitConfig {
  // Client-side batching
  batchSize: number;           // Number of requests per batch
  batchDelayMs: number;        // Delay between batches
  requestStaggerMs: number;    // Delay between requests within a batch

  // Server-side rate limiting
  minRequestIntervalMs: number; // Minimum time between requests
  randomDelayMin: number;       // Min random delay (ms)
  randomDelayMax: number;       // Max random delay (ms)

  // Circuit breaker
  circuitBreakerThreshold: number;  // Failures before opening circuit
  circuitBreakerTimeoutMs: number;  // How long to wait before retry
  circuitBreakerResetMs: number;    // Reset counter after this time

  // Token management
  tokenWindowMs: number;        // Sliding window duration
  maxRequestsPerWindow: number; // Max requests per token per window

  // Cache
  cacheTTLMs: number;          // How long to cache responses
}

// Default configuration - CONSERVATIVE settings to avoid bans
export const DEFAULT_CONFIG: KaitorixRateLimitConfig = {
  // Very slow: 2 requests per batch, 3s between batches
  // 30 JAN codes = 15 batches × 3s = ~45 seconds
  batchSize: 2,
  batchDelayMs: 3000,
  requestStaggerMs: 500,

  // Server enforces 2s minimum + random 0.5-1.5s
  minRequestIntervalMs: 2000,
  randomDelayMin: 500,
  randomDelayMax: 1500,

  // Open circuit after 3 consecutive 403/429, wait 5 minutes
  circuitBreakerThreshold: 3,
  circuitBreakerTimeoutMs: 5 * 60 * 1000,
  circuitBreakerResetMs: 60 * 1000,

  // Conservative: 10 requests per 30 seconds per token
  tokenWindowMs: 30 * 1000,
  maxRequestsPerWindow: 10,

  // Cache for 1 hour
  cacheTTLMs: 60 * 60 * 1000,
};

// Aggressive configuration - USE AT YOUR OWN RISK
// Only use this if you have multiple tokens and understand the risks
export const AGGRESSIVE_CONFIG: KaitorixRateLimitConfig = {
  batchSize: 3,
  batchDelayMs: 1500,
  requestStaggerMs: 300,

  minRequestIntervalMs: 1000,
  randomDelayMin: 200,
  randomDelayMax: 800,

  circuitBreakerThreshold: 5,
  circuitBreakerTimeoutMs: 3 * 60 * 1000,
  circuitBreakerResetMs: 30 * 1000,

  tokenWindowMs: 30 * 1000,
  maxRequestsPerWindow: 15,

  cacheTTLMs: 60 * 60 * 1000,
};

// Ultra-safe configuration - for when you're already banned
// Extremely slow but should never trigger rate limits
export const ULTRA_SAFE_CONFIG: KaitorixRateLimitConfig = {
  batchSize: 1,
  batchDelayMs: 5000,
  requestStaggerMs: 0,

  minRequestIntervalMs: 3000,
  randomDelayMin: 1000,
  randomDelayMax: 2000,

  circuitBreakerThreshold: 2,
  circuitBreakerTimeoutMs: 10 * 60 * 1000,
  circuitBreakerResetMs: 2 * 60 * 1000,

  tokenWindowMs: 60 * 1000,
  maxRequestsPerWindow: 5,

  cacheTTLMs: 2 * 60 * 60 * 1000, // 2 hours
};

// Load config from environment or use default
export function loadRateLimitConfig(): KaitorixRateLimitConfig {
  const mode = process.env.NEXT_PUBLIC_KAITORIX_RATE_LIMIT_MODE || 'default';

  switch (mode) {
    case 'aggressive':
      console.warn('⚠️ Using AGGRESSIVE rate limit config - risk of IP ban!');
      return AGGRESSIVE_CONFIG;
    case 'ultra-safe':
      console.log('🐢 Using ULTRA-SAFE rate limit config - very slow but safe');
      return ULTRA_SAFE_CONFIG;
    default:
      return DEFAULT_CONFIG;
  }
}
