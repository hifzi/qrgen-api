const express = require('express');
const cors = require('cors');
const path = require('path');
const compression = require('compression');
const qrRoutes = require('./routes/qr');
const cacheManager = require('./utils/cacheManager');
const { generateQRCode } = require('./utils/qrGenerator');

// Security middleware
const {
  generalLimiter,
  qrGenerationLimiter,
  securityHeaders,
  sanitizeInput,
  validateApiKey,
  requestLogger,
  securityErrorHandler,
} = require('./middleware/security');

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8080; // int
const NODE_ENV = process.env.NODE_ENV ? String(process.env.NODE_ENV) : 'development'; // string
const GENERAL_LIMIT_MAX = process.env.GENERAL_LIMIT_MAX ? parseInt(process.env.GENERAL_LIMIT_MAX, 10) : 225; // int
const QR_LIMIT_MAX = process.env.QR_LIMIT_MAX ? parseInt(process.env.QR_LIMIT_MAX, 10) : 60; // int
const STRICT_LIMIT_MAX = process.env.STRICT_LIMIT_MAX ? parseInt(process.env.STRICT_LIMIT_MAX, 10) : 10; // int

// Trust proxy for accurate IP addresses
app.set('trust proxy', 1);

// Security headers
app.use(securityHeaders);

// Compression middleware
app.use(compression({
  level: 6,
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
}));

// Request logging
app.use(requestLogger);

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://yourdomain.com', 'https://api.yourdomain.com']
    : true,
  credentials: true,
  optionsSuccessStatus: 200,
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
app.use('/api/', generalLimiter);
app.use('/api/qr', qrGenerationLimiter);

// Input sanitization for QR endpoints
app.use('/api/qr', sanitizeInput);

// API key validation (optional)
app.use('/api/', validateApiKey);

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public'), {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : '0',
  etag: true,
  lastModified: true,
}));

// Health check endpoint with detailed information
app.get('/health', async (req, res) => {
  const startTime = Date.now();

  try {
    // Get cache health
    const cacheHealth = cacheManager.getHealth();

    // System metrics
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();

    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: {
        seconds: Math.floor(uptime),
        human: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`,
      },
      memory: {
        heapUsed: `${Math.round((memoryUsage.heapUsed / 1024 / 1024) * 100) / 100} MB`,
        heapTotal: `${Math.round((memoryUsage.heapTotal / 1024 / 1024) * 100) / 100} MB`,
        external: `${Math.round((memoryUsage.external / 1024 / 1024) * 100) / 100} MB`,
        rss: `${Math.round((memoryUsage.rss / 1024 / 1024) * 100) / 100} MB`,
      },
      performance: {
        responseTime: `${Date.now() - startTime}ms`,
      },
      cache: cacheHealth.cache,
      dependencies: {
        qrcode: 'operational',
        express: 'operational',
        node: process.version,
      },
    };

    res.json(health);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
      uptime: process.uptime(),
    });
  }
});

// API info endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'QRGen API',
    version: '1.2.0',
    description: 'Advanced QR Code Generation API with enterprise features',
    timestamp: new Date().toISOString(),
    endpoints: {
      qr_generation: {
        image: '/api/qr?data=<your_data>&size=<optional_size>&margin=<optional_margin>&el=<optional_level>&color=<optional_color>&bgcolor=<optional_color>',
        data_url: '/api/qr/url?data=<your_data>&size=<optional_size>&margin=<optional_margin>&el=<optional_level>&color=<optional_color>&bgcolor=<optional_color>',
        batch: '/api/qr/batch (POST)',
        description: 'QR code generation endpoints. Use /api/qr/batch for batch QR code generation (POST, JSON body: { requests: [...] }, max 50).',
      },
      system: {
        health: '/health',
        metrics: '/metrics',
        cache_stats: '/api/cache/stats',
        description: 'System monitoring and statistics',
      },
    },
    features: [
      'High-performance QR code generation',
      'Advanced caching system',
      'Rate limiting and security',
      'Input validation and sanitization',
      'Comprehensive error handling',
      'Real-time monitoring',
      'Batch processing support',
      'Multiple output formats',
    ],
    limits: {
      rate_limit: '30 requests per minute per IP',
      data_length: '4000 characters maximum',
      size_range: '50x50 to 2000x2000 pixels',
      supported_formats: ['PNG', 'Data URL'],
    },
    examples: {
      basic: '/api/qr?data=Hello%20World',
      custom_size: '/api/qr?data=example.com&size=500x500',
      high_quality: '/api/qr?data=important-data&el=H&margin=3',
      branded: '/api/qr?data=company.com&color=FF6B35&bgcolor=F7F7F7',
    },
  });
});

// Cache statistics endpoint
app.get('/api/cache/stats', (req, res) => {
  const stats = cacheManager.getStats();
  res.json({
    cache_performance: {
      hit_rate: `${Math.round(stats.hitRate * 100)}%`,
      total_hits: stats.hits,
      total_misses: stats.misses,
      total_keys: stats.keys,
    },
    memory_usage: {
      cache_size_mb: Math.round((stats.vsize / 1024 / 1024) * 100) / 100,
      key_count: stats.keys,
      average_key_size: stats.keys > 0 ? Math.round(stats.ksize / stats.keys) : 0,
    },
    operations: {
      sets: stats.sets,
      deletes: stats.deletes,
      errors: stats.errors,
    },
  });
});

// Cache management endpoints (admin only in production)
if (process.env.NODE_ENV !== 'production') {
  app.post('/api/cache/clear', (req, res) => {
    cacheManager.clear();
    res.json({ message: 'Cache cleared successfully' });
  });

  app.get('/api/cache/health', (req, res) => {
    res.json(cacheManager.getHealth());
  });
}

// QR code routes
app.use('/api/qr', qrRoutes);

// Batch QR generation endpoint
app.post('/api/qr/batch', async (req, res) => {
  try {
    const { requests } = req.body;

    if (!Array.isArray(requests) || requests.length === 0) {
      return res.status(400).json({
        error: 'Invalid batch request',
        message: 'Requests must be a non-empty array',
      });
    }

    if (requests.length > 50) {
      return res.status(400).json({
        error: 'Batch size too large',
        message: 'Maximum 50 requests per batch',
        received: requests.length,
        maximum: 50,
      });
    }

    const results = [];
    const errors = [];

    await Promise.all(requests.map(async (request, i) => {
      try {
        const qrBuffer = await generateQRCode(
          request.data,
          request.size,
          request.options || {},
        );
        results.push({
          index: i,
          success: true,
          data: {
            url: `data:image/png;base64,${qrBuffer.toString('base64')}`,
            size: request.size || '300x300',
            content: request.data,
          },
        });
      } catch (error) {
        errors.push({
          index: i,
          error: error.message,
          request,
        });
      }
    }));

    return res.json({
      success: true,
      processed: requests.length,
      successful: results.length,
      failed: errors.length,
      results,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Batch processing error:', error);
    return res.status(500).json({
      error: 'Batch processing failed',
      details: error.message,
    });
  }
});

// Metrics endpoint for monitoring (Prometheus format)
app.get('/metrics', (req, res) => {
  const stats = cacheManager.getStats();
  const memoryUsage = process.memoryUsage();

  const metrics = `
# HELP qr_cache_hit_rate Cache hit rate percentage
# TYPE qr_cache_hit_rate gauge
qr_cache_hit_rate ${stats.hitRate}

# HELP qr_cache_keys_total Total number of cached keys
# TYPE qr_cache_keys_total gauge
qr_cache_keys_total ${stats.keys}

# HELP qr_memory_heap_used_bytes Memory heap used in bytes
# TYPE qr_memory_heap_used_bytes gauge
qr_memory_heap_used_bytes ${memoryUsage.heapUsed}

# HELP qr_uptime_seconds Process uptime in seconds
# TYPE qr_uptime_seconds gauge
qr_uptime_seconds ${process.uptime()}
  `.trim();

  res.set('Content-Type', 'text/plain');
  res.send(metrics);
});

// Security error handler
app.use(securityErrorHandler);

// error handling middleware
app.use((err, req, res, next) => {
  console.error({
    timestamp: new Date().toISOString(),
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV !== 'production';

  res.status(err.statusCode || 500).json({
    error: 'Internal server error',
    message: isDevelopment ? err.message : 'Something went wrong',
    timestamp: new Date().toISOString(),
    ...(isDevelopment && { stack: err.stack }),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    message: `The requested endpoint ${req.method} ${req.url} was not found`,
    available_endpoints: [
      'GET /',
      'GET /api',
      'GET /api/qr',
      'GET /api/qr/url',
      'POST /api/qr/batch',
      'GET /health',
      'GET /metrics',
    ],
  });
});

const server = app.listen(PORT, () => {
  console.log(`🚀 QRGen API Server is running on http://localhost:${PORT}`);
  console.log(`🌐 Basic Interface: http://localhost:${PORT}`);
  console.log(`📝 API Documentation: http://localhost:${PORT}/api`);
  console.log(`🏥 Health Check: http://localhost:${PORT}/health`);
  console.log(`📊 Metrics: http://localhost:${PORT}/metrics`);
  console.log(`🔗 Example: http://localhost:${PORT}/api/qr?data=example.com&size=300x300`);
  console.log(`⚡ Environment: ${NODE_ENV}`);
  console.log('--- CONFIGURATION ---');
  console.log('PORT:', PORT);
  console.log('NODE_ENV:', NODE_ENV);
  console.log('GENERAL_LIMIT_MAX:', GENERAL_LIMIT_MAX);
  console.log('QR_LIMIT_MAX:', QR_LIMIT_MAX);
  console.log('STRICT_LIMIT_MAX:', STRICT_LIMIT_MAX);
  console.log('---------------------');
  // Preload cache with popular QR codes
  cacheManager.preloadPopular();
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});

module.exports = app;
