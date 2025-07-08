const QRCode = require('qrcode');

/**
 * Parse size string to width and height
 * @param {string} sizeString - Size in format "WIDTHxHEIGHT"
 * @returns {object} Object with width and height properties
 */
function parseSize(sizeString) {
  const defaultSize = { width: 300, height: 300 };

  if (!sizeString || typeof sizeString !== 'string') {
    return defaultSize;
  }

  const parts = sizeString.toLowerCase().split('x');
  if (parts.length !== 2) {
    return defaultSize;
  }

  const width = parseInt(parts[0], 10);
  const height = parseInt(parts[1], 10);

  // Validate dimensions
  if (
    Number.isNaN(width)
    || Number.isNaN(height)
    || width < 50
    || height < 50
    || width > 2000
    || height > 2000
  ) {
    return defaultSize;
  }

  return { width, height };
}

/**
 * Validate hex color format
 * @param {string} color - Color string to validate
 * @returns {boolean} True if valid hex color
 */
function isValidHexColor(color) {
  const hexColorRegex = /^#[0-9A-F]{6}$/i;
  return hexColorRegex.test(color);
}

/**
 * Merge custom options with default options
 * @param {object} defaultOptions - Default QR code options
 * @param {object} customOptions - Custom options from user
 * @returns {object} Merged options
 */
function mergeOptions(defaultOptions, customOptions) {
  const merged = { ...defaultOptions };

  // Handle margin
  if (customOptions.margin !== undefined) {
    const margin = parseInt(customOptions.margin, 10);
    if (!Number.isNaN(margin) && margin >= 0 && margin <= 10) {
      merged.margin = margin;
    }
  }

  // Handle error correction level
  if (customOptions.errorCorrectionLevel !== undefined) {
    const validLevels = ['L', 'M', 'Q', 'H'];
    const level = customOptions.errorCorrectionLevel.toUpperCase();
    if (validLevels.includes(level)) {
      merged.errorCorrectionLevel = level;
    }
  }

  // Handle colors
  if (customOptions.color && isValidHexColor(customOptions.color)) {
    merged.color.dark = customOptions.color;
  }
  if (customOptions.bgcolor && isValidHexColor(customOptions.bgcolor)) {
    merged.color.light = customOptions.bgcolor;
  }

  return merged;
}

/**
 * Generate QR Code as PNG buffer
 * @param {string} data - The data to encode in QR code
 * @param {string} size - Optional size in format "WIDTHxHEIGHT" (default: "300x300")
 * @param {object} customOptions - Optional custom options for QR code generation
 * @returns {Promise<Buffer>} PNG image buffer
 */
async function generateQRCode(data, size = '300x300', customOptions = {}) {
  try {
    // Parse size parameter
    const dimensions = parseSize(size);

    // Default QR Code generation options
    const defaultOptions = {
      type: 'png',
      width: dimensions.width,
      margin: 0.1,
      color: {
        dark: '#000000', // Black dots
        light: '#FFFFFF', // White background
      },
      errorCorrectionLevel: 'M', // Medium error correction (15%)
    };

    // Merge custom options with defaults
    const options = mergeOptions(defaultOptions, customOptions);

    // Generate QR code as buffer
    const qrBuffer = await QRCode.toBuffer(data, options);
    return qrBuffer;
  } catch (error) {
    throw new Error(`Failed to generate QR code: ${error.message}`);
  }
}

/**
 * Validate size parameter
 * @param {string} size - Size string to validate
 * @returns {object} Validation result with isValid and error properties
 */
function validateSize(size) {
  if (!size || typeof size !== 'string') {
    return { isValid: false, error: 'Size must be a string' };
  }

  const sizeRegex = /^\d+x\d+$/i;
  if (!sizeRegex.test(size)) {
    return {
      isValid: false,
      error: 'Size must be in format "WIDTHxHEIGHT" (e.g., "300x300")',
    };
  }

  const parts = size.toLowerCase().split('x');
  const width = parseInt(parts[0], 10);
  const height = parseInt(parts[1], 10);

  if (width < 50 || height < 50) {
    return {
      isValid: false,
      error: 'Minimum size is 50x50 pixels',
    };
  }

  if (width > 2000 || height > 2000) {
    return {
      isValid: false,
      error: 'Maximum size is 2000x2000 pixels',
    };
  }

  return { isValid: true };
}

/**
 * Validate data parameter
 * @param {string} data - Data to validate
 * @returns {object} Validation result with isValid and error properties
 */
function validateData(data) {
  if (!data) {
    return { isValid: false, error: 'Data parameter is required' };
  }

  if (typeof data !== 'string') {
    return { isValid: false, error: 'Data must be a string' };
  }

  if (data.length === 0) {
    return { isValid: false, error: 'Data cannot be empty' };
  }

  if (data.length > 4000) {
    return {
      isValid: false,
      error: 'Data is too long. Maximum length is 4000 characters',
    };
  }

  return { isValid: true };
}

/**
 * Generate QR code as data URL
 * @param {string} data - The data to encode
 * @param {string} size - Optional size
 * @param {object} customOptions - Optional custom options for QR code generation
 * @returns {Promise<string>} Data URL string
 */
async function generateQRCodeDataURL(data, size = '300x300', customOptions = {}) {
  try {
    const dimensions = parseSize(size);

    const defaultOptions = {
      type: 'png',
      width: dimensions.width,
      margin: 0.1,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'M',
    };

    // Merge custom options with defaults
    const options = mergeOptions(defaultOptions, customOptions);

    const dataURL = await QRCode.toDataURL(data, options);
    return dataURL;
  } catch (error) {
    throw new Error(`Failed to generate QR code data URL: ${error.message}`);
  }
}

/**
 * Parse query parameters for custom options
 * @param {object} query - Express query object
 * @returns {object} Parsed custom options
 */
function parseCustomOptions(query) {
  const customOptions = {};

  if (query.margin) {
    customOptions.margin = query.margin;
  }

  if (query.el || query.errorCorrectionLevel) {
    customOptions.errorCorrectionLevel = query.el || query.errorCorrectionLevel;
  }

  if (query.color) {
    customOptions.color = query.color;
  }
  if (query.bgcolor) {
    customOptions.bgcolor = query.bgcolor;
  }

  return customOptions;
}

module.exports = {
  generateQRCode,
  generateQRCodeDataURL,
  validateSize,
  validateData,
  parseSize,
  parseCustomOptions,
  isValidHexColor,
  mergeOptions,
};
