const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const rateLimit = require('express-rate-limit');
const { DEFAULT_AVATAR_URL, USERNAME_MIN_LENGTH, USERNAME_MAX_LENGTH, PASSWORD_MIN_LENGTH } = require('../constants');

const JWT_SECRET = process.env.JWT_SECRET;

// Disable rate limiting in test environment
const noopLimiter = (req, res, next) => next();

const loginLimiter = process.env.NODE_ENV === 'test' ? noopLimiter : rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 login requests per windowMs
    message: 'Too many login attempts from this IP, please try again after 15 minutes',
    standardHeaders: true,
    legacyHeaders: false,
});

const registerLimiter = process.env.NODE_ENV === 'test' ? noopLimiter : rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // Limit each IP to 3 register requests per windowMs
    message: 'Too many registration attempts from this IP, please try again after an hour',
    standardHeaders: true,
    legacyHeaders: false,
});

// Register
router.post('/register', registerLimiter, async (req, res) => {
    const { username, password, country } = req.body;

    // Input validation
    if (!username || !password || !country) {
        return res.status(400).json({ message: 'All fields are required.' });
    }
    if (username.length < USERNAME_MIN_LENGTH || username.length > USERNAME_MAX_LENGTH) {
        return res.status(400).json({ message: `Username must be between ${USERNAME_MIN_LENGTH} and ${USERNAME_MAX_LENGTH} characters.` });
    }
    if (!/^[\p{L}0-9_]+$/u.test(username)) {
        return res.status(400).json({ message: 'Username can only contain letters, numbers, and underscores.' });
    }
    if (password.length < PASSWORD_MIN_LENGTH) {
        return res.status(400).json({ message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters long.` });
    }
    // Basic country code validation (you might want a more robust list)
    if (country.length !== 2 || !/^[A-Z]{2}$/.test(country)) {
        return res.status(400).json({ message: 'Invalid country code. Must be a 2-letter uppercase code.' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const playerId = `player_${Date.now()}`;
        const createdAt = new Date().toISOString();
        const defaultAvatar = DEFAULT_AVATAR_URL;

        await db.query(`INSERT INTO players (id, username, password, country, avatarUrl, createdAt, level) VALUES ($1, $2, $3, $4, $5, $6, $7)`, 
            [playerId, username, hashedPassword, country, defaultAvatar, createdAt, 0]);
            
        const token = jwt.sign({ id: playerId, username: username }, JWT_SECRET, { expiresIn: '1h' });
        res.status(201).json({ message: 'User registered', token, playerId, username, country, avatarUrl: defaultAvatar, level: 1 });
    } catch (error) {
        console.error('Registration error:', error);
        if (error.code === '23505') { // PostgreSQL unique violation error code
            return res.status(409).json({ message: 'Username already exists' });
        }
        res.status(500).json({ message: 'An unexpected error occurred during registration.' });
    }
});

// Login
router.post('/login', loginLimiter, async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'All fields are required.' });
    }
    // Basic validation for login (username and password presence)
    if (username.length < USERNAME_MIN_LENGTH || username.length > USERNAME_MAX_LENGTH) {
        return res.status(400).json({ message: 'Invalid username or password.' });
    }
    if (password.length < PASSWORD_MIN_LENGTH) {
        return res.status(400).json({ message: 'Invalid username or password.' });
    }
    try {
        const result = await db.query(`SELECT * FROM players WHERE username ILIKE $1`, [username]);
        const player = result.rows[0];
        if (!player || !await bcrypt.compare(password, player.password)) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        const token = jwt.sign({ id: player.id, username: player.username }, JWT_SECRET, { expiresIn: '1h' });
        res.json({ message: 'Logged in', token, playerId: player.id, username: player.username, country: player.country, avatarUrl: player.avatarurl, level: player.level });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'An unexpected error occurred during login.' });
    }
});

router.post('/admin/login', loginLimiter, async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'All fields are required' });
    }
    try {
        const result = await db.query(`SELECT * FROM admins WHERE username ILIKE $1`, [username]);
        const admin = result.rows[0];
        if (!admin || !await bcrypt.compare(password, admin.password)) {
            return res.status(401).json({ message: 'Invalid admin credentials' });
        }
        const token = jwt.sign({ id: admin.id, username: admin.username, role: 'admin' }, JWT_SECRET, { expiresIn: '1h' });
        res.json({ message: 'Admin logged in', token });
    } catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json({ message: 'An unexpected error occurred during admin login.' });
    }
});

module.exports = router;
