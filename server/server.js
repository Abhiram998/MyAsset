const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

dotenv.config({ path: path.join(__dirname, '../.env') });

const { getDatabaseMode } = require('./db/database');
// Enforce fail-fast check: fail clearly at startup in production if PostgreSQL config is missing
try {
    const activeDbMode = getDatabaseMode();
    console.log(`[MyAsset] Database mode initialized: ${activeDbMode.toUpperCase()}`);
} catch (dbErr) {
    console.error(`[MyAsset] FATAL STARTUP CONFIGURATION ERROR: ${dbErr.message}`);
    if (process.env.NODE_ENV === 'production') {
        throw dbErr;
    }
}

const app = express();
const PORT = process.env.PORT || 3000;

// Basic middleware
app.use(express.json());
app.use(cookieParser());

// HTTPS enforcement for production environments
if (process.env.NODE_ENV === 'production') {
    app.enable('trust proxy');
    app.use((req, res, next) => {
        if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
            return next();
        }
        res.redirect(301, `https://${req.headers.host}${req.url}`);
    });
}

// Security middleware: Enhanced Helmet configuration with Content Security Policy
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "blob:"],
            connectSrc: ["'self'"],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            frameAncestors: ["'self'"]
        }
    },
    crossOriginEmbedderPolicy: false
}));
const allowedOrigin = process.env.ALLOWED_ORIGIN || (process.env.NODE_ENV === 'production' ? true : 'http://localhost:3000');
app.use(cors({
    origin: allowedOrigin,
    credentials: true
}));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000 // generous limit for development/testing
});
app.use('/api/', limiter);

// Serve static files from the client directory
app.use(express.static(path.join(__dirname, '../client')));

// Basic route to verify server is running
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// OpenAPI 3.0 specification contract
app.get('/api/docs', (req, res) => {
    res.sendFile(path.join(__dirname, '../docs/openapi.json'));
});

// Setup specific routes
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const assetRoutes = require('./routes/asset.routes');
const assignmentRoutes = require('./routes/assignment.routes');
const locationRoutes = require('./routes/location.routes');
const zoneRoutes = require('./routes/zone.routes');
const employeeRoutes = require('./routes/employee.routes');
const taskRoutes = require('./routes/task.routes');
const maintenanceRoutes = require('./routes/maintenance.routes');
const activityRoutes = require('./routes/activity.routes');
const alertRoutes = require('./routes/alert.routes');
const reportRoutes = require('./routes/report.routes');
const gpsRoutes = require('./routes/gps.routes');
const settingsRoutes = require('./routes/settings.routes');
const rfidRoutes = require('./routes/rfid.routes');

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/assets', assetRoutes);
app.use('/api/v1/assignments', assignmentRoutes);
app.use('/api/v1/locations', locationRoutes);
app.use('/api/v1/zones', zoneRoutes);
app.use('/api/v1/employees', employeeRoutes);
app.use('/api/v1/tasks', taskRoutes);
app.use('/api/v1/maintenance', maintenanceRoutes);
app.use('/api/v1/activity', activityRoutes);
app.use('/api/v1/gps', gpsRoutes);
app.use('/api/v1/alerts', alertRoutes);
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1/settings', settingsRoutes);
app.use('/api/v1/rfid', rfidRoutes);

// Root redirect
app.get('/', (req, res) => {
    res.redirect('/pages/overview.html');
});

// For all other requests, send the 404 response
app.use((req, res) => {
    res.status(404).json({ error: 'Not Found' });
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('GLOBAL ERROR:', err);
    const isDev = process.env.NODE_ENV !== 'production';
    res.status(err.status || 500).json({
        error: 'Internal Server Error',
        ...(isDev ? { details: err.message } : {})
    });
});

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

module.exports = app;
