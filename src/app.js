const express = require('express');
const cors = require('cors');
const path = require('path');
const qrRoutes = require('./routes/qr');

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// Routes
app.use('/api/qr', qrRoutes);

// Health check endpoint
app.get('/api', (req, res) => {
    res.json({
        message: 'QRGen API',
        version: '1.0.0',
        endpoints: {
            web_interface: '/',
            qr_generate: '/api/qr?data=<your_data>&size=<optional_size>',
            qr_data_url: '/api/qr/url?data=<your_data>&size=<optional_size>'
        }
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

app.listen(PORT, () => {
    console.log(`🚀 QRGen API Server is running on http://localhost:${PORT}`);
    console.log(`🌐 Web Interface: http://localhost:${PORT}`);
    console.log(`📝 API Documentation: http://localhost:${PORT}/api`);
    console.log(`🔗 Example: http://localhost:${PORT}/api/qr?data=example.com&size=300x300`);
});

module.exports = app;
