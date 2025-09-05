const { continentMap, countries, getContinentByCountryCode, DEFAULT_CHAT_ROOM, CHAT_MESSAGE_COOLDOWN } = require('./constants');
const PORT = process.env.PORT || 3000;
require('dotenv').config();
const path = require('path');
const express = require('express');
const db = require('./db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const http = require('http');
const { Server } = require('socket.io');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { authenticateToken, authenticateAdminToken } = require('./middleware/auth');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.NODE_ENV === 'production' ? 
            (process.env.ALLOWED_ORIGIN ? process.env.ALLOWED_ORIGIN.split(',') : ["http://localhost:3000"]) : 
            ["http://localhost:3000", "http://127.0.0.1:3000"],
        methods: ["GET", "POST"],
        credentials: true
    }
});

// Initialize Socket.IO handlers
require('./socket/chatHandler')(io);

// --- Middleware ---
// Helmet for basic security headers
app.use(helmet());
app.use(
    helmet.contentSecurityPolicy({
        directives: {
            ...helmet.contentSecurityPolicy.getDefaultDirectives(),
            "script-src": ["'self'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "'unsafe-eval'"],
            "style-src": ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
            "img-src": ["'self'", "data:"],
            "font-src": ["'self'", "https://cdnjs.cloudflare.com", "https://fonts.gstatic.com"],
            "connect-src": ["'self'", "ws:", "wss:", "https://ipapi.co"], // Added wss: for secure websockets
        },
    })
);

// General rate limiting - Disabled in development
if (process.env.NODE_ENV === 'production') {
    const generalLimiter = rateLimit({
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
        max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000, // 1000 requests per 15 minutes
        message: 'Too many requests from this IP, please try again later.',
        standardHeaders: true,
        legacyHeaders: false,
        // Skip rate limiting for static files
        skip: (req) => {
            return req.path.includes('/favicon.ico') || 
                   req.path.includes('/assets/') || 
                   req.path.includes('/css/') || 
                   req.path.includes('/js/') ||
                   req.path.includes('/uploads/');
        }
    });
    app.use(generalLimiter);
} else {
    console.log('🛡️ Rate limiting disabled in development mode');
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); // Serve all static files from the public directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // Serve uploaded files

const authRoutes = require('./routes/authRoutes');
const profileRoutes = require('./routes/profileRoutes');
const { router: scoreRouter } = require('./routes/scoreRoutes');
const { router: adminRouter } = require('./routes/adminRoutes');
const chatRoutes = require('./routes/chatRoutes')(io);

app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/scores', scoreRouter);
app.use('/api/leaderboard', scoreRouter);
app.use('/api/admin', adminRouter);
app.use('/api/chat', chatRoutes);

// --- Error Handling Middleware ---
app.use((err, req, res, next) => {
    console.error(err.stack); // Log the error stack for debugging
    res.status(err.statusCode || 500).json({
        message: err.message || 'An unexpected error occurred.',
        error: process.env.NODE_ENV === 'production' ? {} : err.stack // Don't expose stack in production
    });
});

module.exports = { app, server, io };

// Graceful shutdown function
const gracefulShutdown = () => {
    console.log('Shutting down server...');

    // Close Socket.IO server
    io.close(() => {
        console.log('Socket.IO server closed.');
    });

    // Close HTTP server
    server.close(() => {
        console.log('HTTP server closed.');
        // Close database pool after HTTP server is closed
        db.closePool().then(() => {
            console.log('Database pool closed from server shutdown.');
            process.exit(0); // Exit the process after all cleanup
        }).catch(err => {
            console.error('Error closing database pool during shutdown:', err);
            process.exit(1); // Exit with error code
        });
    });

    // Force close if server doesn't close within a timeout
    setTimeout(() => {
        console.error('Forcefully shutting down server.');
        process.exit(1);
    }, 10000); // 10 seconds timeout
};

// Handle graceful shutdown on SIGINT (Ctrl+C) and SIGTERM
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);


if (require.main === module) {
    (async () => { // Use an async IIFE to await db.connect()
        await db.connect();
        const { updateLeaderboardView } = require('./update_leaderboard_view');
        await updateLeaderboardView(); // Update the materialized view on startup

        // Periodically refresh the materialized view every 5 minutes
        setInterval(async () => {
            if (process.env.NODE_ENV !== 'production') {
                console.log('Periodically refreshing leaderboard view...');
            }
            await updateLeaderboardView();
        }, 300000); // 300000 ms = 5 minutes

        server.listen(PORT, () => {
            if (process.env.NODE_ENV === 'production') {
                console.log(`🚀 CIPHER Server is running on port ${PORT}`);
            } else {
                console.log(`🔧 Development server running on http://localhost:${PORT}`);
            }
        });
    })();
}
