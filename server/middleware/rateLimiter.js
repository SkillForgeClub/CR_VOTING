/**
 * Lightweight in-memory sliding-window rate limiter tailored for high-density campus Wi-Fi / NAT.
 */
class SlidingRateLimiter {
  constructor(windowMs, maxRequests, keyPrefix = "") {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.keyPrefix = keyPrefix;
    this.hits = new Map();

    // Periodic cleanup of stale buckets
    setInterval(() => this.cleanup(), 60000).unref();
  }

  cleanup() {
    const now = Date.now();
    for (const [key, timestamps] of this.hits.entries()) {
      const valid = timestamps.filter((t) => now - t < this.windowMs);
      if (valid.length === 0) {
        this.hits.delete(key);
      } else {
        this.hits.set(key, valid);
      }
    }
  }

  middleware(customKeyFn = null) {
    return (req, res, next) => {
      const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1";
      const key = this.keyPrefix + (customKeyFn ? customKeyFn(req) : String(ip));
      const now = Date.now();

      const timestamps = this.hits.get(key) || [];
      const recent = timestamps.filter((t) => now - t < this.windowMs);

      if (recent.length >= this.maxRequests) {
        res.setHeader("Retry-After", Math.ceil(this.windowMs / 1000));
        return res.status(429).json({
          success: false,
          code: "RATE_LIMITED",
          message: "Too many requests. Please slow down and try again shortly.",
        });
      }

      recent.push(now);
      this.hits.set(key, recent);
      next();
    };
  }
}

// 1. General API: 300 requests per minute per IP (allowing dense campus NAT)
export const apiLimiter = new SlidingRateLimiter(60000, 300, "api:").middleware();

// 2. Auth Endpoints: 30 attempts per minute per IP
export const authLimiter = new SlidingRateLimiter(60000, 30, "auth:").middleware();

// 3. Vote Submissions: 20 per minute per IP
export const voteLimiter = new SlidingRateLimiter(60000, 20, "vote:").middleware();
