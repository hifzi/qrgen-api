const express = require('express');
const router = express.Router();
const { generateQRCode, validateSize, validateData, parseCustomOptions } = require('../utils/qrGenerator');

// GET /api/qr - Generate QR Code
router.get('/', async (req, res) => {
    try {
        const { data, size } = req.query;

        // Validate required data parameter
        if (!data) {
            return res.status(400).json({ 
                error: 'Data parameter is required',
                example: '/api/qr?data=example.com&size=300x300&margin=1&errorLevel=M'
            });
        }

        // Validate data content
        const dataValidation = validateData(data);
        if (!dataValidation.isValid) {
            return res.status(400).json({ 
                error: dataValidation.error 
            });
        }

        // Validate size parameter if provided
        if (size) {
            const sizeValidation = validateSize(size);
            if (!sizeValidation.isValid) {
                return res.status(400).json({ 
                    error: sizeValidation.error 
                });
            }
        }

        // Parse custom options from query parameters
        const customOptions = parseCustomOptions(req.query);

        // Generate QR code with custom options
        const qrBuffer = await generateQRCode(data, size, customOptions);
        
        // Set headers for PNG image response
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Content-Disposition', `inline; filename="qr-code-${Date.now()}.png"`);
        res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
        
        // Send the PNG image buffer
        res.send(qrBuffer);

    } catch (error) {
        console.error('Error generating QR code:', error);
        res.status(500).json({ 
            error: 'Failed to generate QR code',
            details: error.message 
        });
    }
});

// GET /api/qr/url - Get QR Code URL instead of image
router.get('/url', async (req, res) => {
    try {
        const { data, size } = req.query;

        if (!data) {
            return res.status(400).json({ 
                error: 'Data parameter is required' 
            });
        }

        // Parse custom options from query parameters
        const customOptions = parseCustomOptions(req.query);

        // Generate base64 data URL with custom options
        const qrBuffer = await generateQRCode(data, size, customOptions);
        const base64 = qrBuffer.toString('base64');
        const dataUrl = `data:image/png;base64,${base64}`;

        res.json({
            success: true,
            data: {
                url: dataUrl,
                size: size || '300x300',
                content: data,
                options: customOptions
            }
        });

    } catch (error) {
        console.error('Error generating QR code URL:', error);
        res.status(500).json({ 
            error: 'Failed to generate QR code URL',
            details: error.message 
        });
    }
});

module.exports = router;
