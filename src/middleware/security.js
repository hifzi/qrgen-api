const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const xss = require('xss');
const validator = require('validator');

// Rate limiting configuration
const createRateLimiter = (windowMs, max, message) => rateLimit({
  windowMs,
  max,
  message: {
    error: message,
    retryAfter: Math.ceil(windowMs / 1000),
    limit: max,
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests',
      message: `Rate limit exceeded. Try again in ${Math.ceil(windowMs / 1000)} seconds.`,
      retryAfter: Math.ceil(windowMs / 1000),
    });
  },
});

// Different rate limits for different endpoints
const generalLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  process.env.GENERAL_LIMIT_MAX ? parseInt(process.env.GENERAL_LIMIT_MAX, 10) : 225,
  'Too many requests from this IP, please try again later.',
);

const qrGenerationLimiter = createRateLimiter(
  60 * 1000, // 1 minute
  process.env.QR_LIMIT_MAX ? parseInt(process.env.QR_LIMIT_MAX, 10) : 60,
  'Too many QR code generation requests, please slow down.',
);

const strictLimiter = createRateLimiter(
  60 * 1000, // 1 minute
  process.env.STRICT_LIMIT_MAX ? parseInt(process.env.STRICT_LIMIT_MAX, 10) : 10,
  'Rate limit exceeded for this endpoint.',
);

// Input sanitization middleware
const sanitizeInput = (req, res, next) => {
  if (req.query.data) {
    // Sanitize XSS but preserve legitimate content
    req.query.data = xss(req.query.data, {
      whiteList: {}, // No HTML tags allowed
      stripIgnoreTag: true,
      stripIgnoreTagBody: ['script'],
    });

    // Validate data length
    if (req.query.data.length > 4000) {
      return res.status(400).json({
        error: 'Data too long',
        message: 'Maximum data length is 4000 characters',
        received: req.query.data.length,
        maximum: 4000,
      });
    }
  }

  // Sanitize color inputs (allow with or without #)
  if (req.query.color) {
    let c = req.query.color.trim();
    if (!c.startsWith('#')) c = '#' + c;
    if (!validator.isHexColor(c)) {
      c = '#000000';
    }
    req.query.color = c;
  }

  if (req.query.bgcolor) {
    let bg = req.query.bgcolor.trim();
    if (!bg.startsWith('#')) bg = '#' + bg;
    if (!validator.isHexColor(bg)) {
      bg = '#FFFFFF';
    }
    req.query.bgcolor = bg;
  }

  // Validate and sanitize size parameter
  if (req.query.size) {
    const sizeRegex = /^(\d+)x(\d+)$/i;
    if (!sizeRegex.test(req.query.size)) {
      return res.status(400).json({
        error: 'Invalid size format',
        message: 'Size must be in format "WIDTHxHEIGHT" (e.g., "300x300")',
        received: req.query.size,
      });
    }
  }

  // Validate margin parameter
  if (req.query.margin) {
    const margin = parseInt(req.query.margin, 10);
    if (Number.isNaN(margin) || margin < 0 || margin > 10) {
      req.query.margin = '1'; // Default margin
    }
  }

  // Validate error correction level
  if (req.query.el) {
    const validLevels = ['L', 'M', 'Q', 'H'];
    if (!validLevels.includes(req.query.el.toUpperCase())) {
      req.query.el = 'M'; // Default to medium
    }
  }

  return next();
};

// Security headers configuration
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", 'https://cdn.jsdelivr.net'],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      scriptSrcAttr: ["'unsafe-inline'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Allow embedding QR codes
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
});

// API key validation middleware (optional)
const validateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;

  // If no API key is provided, continue (public access)
  if (!apiKey) {
    return next();
  }

  // Validate API key format
  if (!validator.isUUID(apiKey)) {
    return res.status(401).json({
      error: 'Invalid API key format',
      message: 'API key must be a valid UUID',
    });
  }

  // Here you would typically validate against a database
  // For now, we'll just attach it to the request
  req.apiKey = apiKey;

  return next();
};

// Request logging middleware (development only)
const requestLogger = (req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    return next(); // Skip logging in production
  }
  const start = Date.now();
  const originalSend = res.send;

  res.send = function (data) {
    const duration = Date.now() - start;

    // Log request details
    console.log({
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      status: res.statusCode,
      duration: `${duration}ms`,
      contentLength: data ? data.length : 0,
    });

    originalSend.call(this, data);
  };

  next();
};

// Error handling for security middleware
const securityErrorHandler = (err, req, res, next) => {
  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      error: 'Payload too large',
      message: 'Request body exceeds maximum size limit',
    });
  }

  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({
      error: 'Invalid CSRF token',
      message: 'CSRF token validation failed',
    });
  }

  return next(err);
};

module.exports = {
  generalLimiter,
  qrGenerationLimiter,
  strictLimiter,
  sanitizeInput,
  securityHeaders,
  validateApiKey,
  requestLogger,
  securityErrorHandler,
};
