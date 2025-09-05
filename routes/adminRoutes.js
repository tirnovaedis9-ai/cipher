const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { authenticateAdminToken } = require('../middleware/auth');
const { calculateLevel } = require('./scoreRoutes');
const { updateLeaderboardView } = require('../update_leaderboard_view');

// Admin Login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    // Simple validation
    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
    }

    try {
        const result = await db.query(`SELECT * FROM admins WHERE username ILIKE $1`, [username]);
        const admin = result.rows[0];
        if (!admin || !await bcrypt.compare(password, admin.password)) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Create a token
        const token = jwt.sign({ id: admin.id, username: admin.username, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.json({ token });
    } catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json({ message: 'An unexpected error occurred during login.' });
    }
});

// Admin: Get all users
router.get('/users', authenticateAdminToken, async (req, res) => {
    try {
        let { sortBy = 'createdAt', order = 'desc' } = req.query;

        // Whitelist for sortBy to prevent SQL injection
        const allowedSortBy = {
            'username': 'username',
            'country': 'country',
            'createdAt': 'createdat',
            'level': 'level',
            'gameCount': 'gameCount'
        };

        if (!Object.keys(allowedSortBy).includes(sortBy)) {
            return res.status(400).json({ message: 'Invalid sort parameter' });
        }

        // Whitelist for order
        order = order.toLowerCase();
        if (order !== 'asc' && order !== 'desc') {
            return res.status(400).json({ message: 'Invalid order parameter' });
        }

        const query = `
            SELECT id, username, country, avatarurl, createdat, level, gameCount
            FROM players
            ORDER BY ${allowedSortBy[sortBy]} ${order.toUpperCase()}
        `;

        const result = await db.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error('Admin get users error:', err);
        return res.status(500).json({ message: 'An unexpected error occurred while fetching users.' });
    }
});

// Admin: Get a single user by ID
router.get('/users/:id', authenticateAdminToken, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db.query(`SELECT id, username, country, avatarurl FROM players WHERE id = $1`, [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Admin get user error:', err);
        return res.status(500).json({ message: 'An unexpected error occurred while fetching user data.' });
    }
});

// Admin: Update a user
router.put('/users/:id', authenticateAdminToken, async (req, res) => {
    const { id } = req.params;
    const { username, country, avatarUrl } = req.body;

    if (!username) {
        return res.status(400).json({ message: 'Username is required' });
    }

    try {
        const result = await db.query(
            `UPDATE players SET username = $1, country = $2, avatarurl = $3 WHERE id = $4 RETURNING *`,
            [username, country, avatarUrl, id]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        await updateLeaderboardView(); // Refresh leaderboard view after user update
        res.json({ message: 'User updated successfully', user: result.rows[0] });
    } catch (err) {
        console.error('Admin update user error:', err);
        return res.status(500).json({ message: 'An unexpected error occurred while updating user.' });
    }
});

// Admin: Delete a user
router.delete('/users/:id', authenticateAdminToken, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db.query(`DELETE FROM players WHERE id = $1`, [id]);
        if (result.rowCount === 0) return res.status(404).json({ message: 'User not found' });
        await updateLeaderboardView(); // Refresh leaderboard view after user deletion
        res.json({ message: 'User deleted successfully' });
    } catch (err) {
        console.error('Admin delete user error:', err);
        return res.status(500).json({ message: 'An unexpected error occurred while deleting user.' });
    }
});

// Admin: Get general statistics
router.get('/stats', authenticateAdminToken, async (req, res) => {
    try {
        const totalPlayersResult = await db.query(`SELECT COUNT(*) as total_players FROM players`);
        const totalGamesPlayedResult = await db.query(`SELECT COUNT(*) as total_games_played FROM scores`);
        const averageScoreResult = await db.query(`SELECT AVG(score) as average_score FROM scores`);

        const stats = {
            totalPlayers: parseInt(totalPlayersResult.rows[0].total_players, 10) || 0,
            totalGamesPlayed: parseInt(totalGamesPlayedResult.rows[0].total_games_played, 10) || 0,
            averageScore: parseFloat(averageScoreResult.rows[0].average_score) || 0
        };

        res.json(stats);
    } catch (err) {
        console.error('Admin stats error:', err);
        return res.status(500).json({ message: 'An unexpected error occurred while fetching statistics.' });
    }
});

// Admin: Get all settings
router.get('/settings', authenticateAdminToken, async (req, res) => {
    try {
        const result = await db.query(`SELECT key, value FROM settings`);
        const rows = result.rows;
        const settings = {};
        rows.forEach(row => {
            settings[row.key] = row.value;
        });
        res.json(settings);
    } catch (err) {
        console.error('Admin get settings error:', err);
        return res.status(500).json({ message: 'An unexpected error occurred while fetching settings.' });
    }
});

// Admin: Update a setting
router.put('/settings/:key', authenticateAdminToken, async (req, res) => {
    const { key } = req.params;
    const { value } = req.body;

    if (!value) {
        return res.status(400).json({ message: 'Value is required' });
    }

    try {
        await db.query(`INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [key, value]);
        res.json({ message: `Setting ${key} updated successfully` });
    } catch (err) {
        console.error('Admin update setting error:', err);
        return res.status(500).json({ message: 'An unexpected error occurred while updating setting.' });
    }
});

// Admin: Update a player's game count for testing levels
router.put('/player/:id/gamecount', authenticateAdminToken, async (req, res) => {
    const { id } = req.params;
    const { targetGameCount } = req.body;

    if (targetGameCount === undefined || targetGameCount < 0) {
        return res.status(400).json({ message: 'Target game count is required and must be a non-negative number.' });
    }

    try {
        // 1. Delete all existing 'admin_added' scores for this player
        await db.query(`DELETE FROM scores WHERE playerId = $1 AND mode = 'admin_added'`, [id]);

        // 2. Insert 'targetGameCount' number of new 'admin_added' scores
        for (let i = 0; i < targetGameCount; i++) {
            const scoreId = `admin_added_score_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const timestamp = new Date().toISOString();
            await db.query(`INSERT INTO scores (id, playerId, score, mode, timestamp) VALUES ($1, $2, $3, $4, $5)`,
                [scoreId, id, 1, 'admin_added', timestamp]);
        }

        // 3. Recalculate the total game count for the player
        const totalGameCountResult = await db.query(`SELECT COUNT(*) as totalGameCount FROM scores WHERE playerId = $1`, [id]);
        const totalGameCount = parseInt(totalGameCountResult.rows[0].totalGameCount, 10) || 0;

        // 4. Update the player's level and gameCount
        const newLevel = calculateLevel(totalGameCount);
        await db.query(`UPDATE players SET level = $1, gameCount = $2 WHERE id = $3`, [newLevel, totalGameCount, id]);
        await updateLeaderboardView();

        res.json({ message: `Player ${id}'s game count updated to ${totalGameCount}. Level set to ${newLevel}.` });

    } catch (err) {
        console.error('Admin update game count error:', err);
        return res.status(500).json({ message: 'An unexpected error occurred while updating game count.' });
    }
});

// Admin: Reset a player's game count to original
router.post('/player/:id/gamecount/reset', authenticateAdminToken, async (req, res) => {
    const { id } = req.params;
    try {
        const deleteResult = await db.query(`DELETE FROM scores WHERE playerId = $1 AND (mode = 'dummy' OR mode = 'admin_added')`, [id]);

        const gameCountResult = await db.query(`SELECT COUNT(*) as gameCount FROM scores WHERE playerId = $1`, [id]);
        const gameCount = parseInt(gameCountResult.rows[0].gameCount, 10) || 0;
        const newLevel = calculateLevel(gameCount);

        await db.query(`UPDATE players SET level = $1, gameCount = $2 WHERE id = $3`, [newLevel, gameCount, id]);
        await updateLeaderboardView();

        console.log(`[DEBUG] Admin reset: Player ${id} level reset to ${newLevel} based on ${gameCount} remaining games.`);

        res.json({ message: `Removed ${deleteResult.rowCount} dummy games for player ${id}. Level reset to ${newLevel}.` });
    } catch (err) {
        console.error('Admin reset game count error:', err);
        return res.status(500).json({ message: 'An unexpected error occurred while resetting game count.' });
    }
});

// Admin: Clear all chat messages
router.delete('/chat/messages', authenticateAdminToken, async (req, res) => {
    try {
        await db.query('DELETE FROM messages');
        res.json({ message: 'All chat messages have been deleted successfully.' });
    } catch (err) {
        console.error('Admin clear chat error:', err);
        return res.status(500).json({ message: 'An unexpected error occurred while clearing chat messages.' });
    }
});

// Admin: Clear chat messages for a specific room
router.delete('/chat/messages/:room', authenticateAdminToken, async (req, res) => {
    const { room } = req.params;
    try {
        await db.query('DELETE FROM messages WHERE room = $1', [room]);
        res.json({ message: `Chat messages for room '${room}' have been deleted successfully.` });
    } catch (err) {
        console.error(`Admin clear chat room '${room}' error:`, err);
        return res.status(500).json({ message: `An unexpected error occurred while clearing chat messages for room '${room}'.` });
    }
});

module.exports = { router };