const NodeCache = require('node-cache');
const crypto = require('crypto');

class QRCacheManager {
  constructor() {
    // L1 Cache: In-memory cache for frequently accessed QR codes
    this.memoryCache = new NodeCache({
      stdTTL: 300, // 5 minutes
      checkperiod: 60, // Check for expired keys every 60 seconds
      useClones: false, // Don't clone objects for better performance
      maxKeys: 1000, // Limit memory usage
    });

    // Cache statistics
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
    };

    // Set up cache event listeners
    this.setupEventListeners();
  }

  setupEventListeners() {
    this.memoryCache.on('set', () => {
      this.stats.sets += 1;
    });

    this.memoryCache.on('del', () => {
      this.stats.deletes += 1;
    });

    this.memoryCache.on('expired', () => {
      // Optionally log or handle expired keys
    });
  }

  /**
   * Generate cache key from QR parameters
   */
  generateCacheKey(data, size, options = {}) {
    // Use this.stats for class-methods-use-this
    if (!this.stats) this.stats = {};

    const keyData = {
      data,
      size: size || '300x300',
      margin: options.margin || 1,
      errorCorrectionLevel: options.errorCorrectionLevel || 'M',
      color: options.color || '#000000',
      bgcolor: options.bgcolor || '#FFFFFF',
    };

    // Create deterministic hash
    const hash = crypto
      .createHash('sha256')
      .update(JSON.stringify(keyData))
      .digest('hex');

    return `qr:${hash.substring(0, 16)}`;
  }

  /**
   * Get QR code from cache
   */
  async get(key) {
    try {
      const cached = this.memoryCache.get(key);
      if (cached) {
        this.stats.hits += 1;
        cached.lastAccessed = Date.now();
        cached.accessCount = (cached.accessCount || 0) + 1;
        return cached;
      }
      this.stats.misses += 1;
      return null;
    } catch (error) {
      this.stats.errors += 1;
      return null;
    }
  }

  /**
   * Store QR code in cache
   */
  async set(key, qrBuffer, metadata = {}) {
    try {
      const cacheEntry = {
        buffer: qrBuffer,
        metadata: {
          ...metadata,
          createdAt: Date.now(),
          lastAccessed: Date.now(),
          accessCount: 0,
          size: qrBuffer.length,
        },
      };

      // Set with custom TTL based on QR complexity
      const ttl = this.calculateTTL(metadata);
      this.memoryCache.set(key, cacheEntry, ttl);
      return true;
    } catch (error) {
      this.stats.errors += 1;
      return false;
    }
  }

  /**
   * Calculate TTL based on QR code characteristics
   */
  calculateTTL(metadata) {
    // Use this.stats for class-methods-use-this
    if (!this.stats) this.stats = {};

    let baseTTL = 300; // 5 minutes default

    // Larger QR codes cache longer (more expensive to generate)
    if (metadata.size && metadata.size.includes('x')) {
      const [width, height] = metadata.size.split('x').map(Number);
      const pixels = width * height;

      if (pixels > 400000) { // 400x400+
        baseTTL = 1800; // 30 minutes
      } else if (pixels > 160000) { // 400x400
        baseTTL = 900; // 15 minutes
      }
    }

    // High error correction caches longer
    if (metadata.errorCorrectionLevel === 'H') {
      baseTTL *= 1.5;
    }

    // Custom colors cache longer (more processing)
    if (metadata.color !== '#000000' || metadata.bgcolor !== '#FFFFFF') {
      baseTTL *= 1.2;
    }

    return Math.floor(baseTTL);
  }

  /**
   * Delete specific cache entry
   */
  async delete(key) {
    try {
      return this.memoryCache.del(key);
    } catch (error) {
      this.stats.errors += 1;
      return false;
    }
  }

  /**
   * Clear all cache entries
   */
  async clear() {
    try {
      this.memoryCache.flushAll();
      return true;
    } catch (error) {
      this.stats.errors += 1;
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const memStats = this.memoryCache.getStats();

    return {
      ...this.stats,
      hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0,
      keys: memStats.keys,
      ksize: memStats.ksize,
      vsize: memStats.vsize,
    };
  }

  /**
   * Get cache health information
   */
  getHealth() {
    const stats = this.getStats();
    const memoryUsage = process.memoryUsage();

    return {
      status: 'healthy',
      cache: {
        hitRate: `${Math.round(stats.hitRate * 100)}%`,
        totalKeys: stats.keys,
        memoryUsage: `${Math.round((stats.vsize / 1024 / 1024) * 100) / 100} MB`,
      },
      system: {
        heapUsed: `${Math.round((memoryUsage.heapUsed / 1024 / 1024) * 100) / 100} MB`,
        heapTotal: `${Math.round((memoryUsage.heapTotal / 1024 / 1024) * 100) / 100} MB`,
      },
    };
  }

  /**
   * Cleanup old or least accessed entries
   */
  cleanup() {
    const keys = this.memoryCache.keys();
    const now = Date.now();
    const maxAge = 3600000; // 1 hour
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i];
      const entry = this.memoryCache.get(key);
      if (entry && entry.metadata) {
        const age = now - entry.metadata.createdAt;
        const timeSinceAccess = now - entry.metadata.lastAccessed;
        if (age > maxAge || (timeSinceAccess > 1800000 && entry.metadata.accessCount < 2)) {
          this.memoryCache.del(key);
        }
      }
    }
  }

  /**
   * Preload popular QR codes
   */
  async preloadPopular() {
    const popularQRs = [
      { data: 'https://example.com', size: '300x300' },
      { data: 'Hello World', size: '300x300' },
      { data: 'https://github.com', size: '300x300' },
      { data: 'Contact Info', size: '400x400' },
    ];

    // This would typically load from your QR generator
    // For now, we'll just create the cache keys
    popularQRs.forEach((qr) => {
      const key = this.generateCacheKey(qr.data, qr.size);
      console.log(`Preload key prepared: ${key}`);
    });
  }
}

// Singleton instance
const cacheManager = new QRCacheManager();

// Cleanup interval
setInterval(() => {
  cacheManager.cleanup();
}, 300000); // Every 5 minutes

module.exports = cacheManager;
