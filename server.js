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

const { authenticateToken, authenticateAdminToken } = require('./middleware/auth');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.NODE_ENV === 'production' ? process.env.ALLOWED_ORIGIN : "*", // Restrict origin in production
        methods: ["GET", "POST"]
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
            "script-src": ["'self'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
            "style-src": ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
            "img-src": ["'self'", "data:"],
            "font-src": ["'self'", "https://cdnjs.cloudflare.com", "https://fonts.gstatic.com"],
            "connect-src": ["'self'", "ws:", "wss:", "https://ipapi.co"], // Added wss: for secure websockets
        },
    })
);

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

if (require.main === module) {
    (async () => { // Use an async IIFE to await db.connect()
        await db.connect();
        server.listen(PORT, () => {
            console.log(`Server is running on http://localhost:${PORT}`);
        });
    })();
}
