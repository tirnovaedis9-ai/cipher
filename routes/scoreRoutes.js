const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { countries } = require('../constants');

// Rate limiting for score submission
const scoreSubmissionLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 10, // limit each IP to 10 score submissions per minute
    message: 'Too many score submissions, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

// Helper function to calculate level based on game count
function calculateLevel(gameCount) {
    // 30 games = level 1, 60 games = level 2, etc.
    const level = Math.floor(gameCount / 30);
    return Math.min(level, 10); // Cap the level at 10
}

// Submit a score (protected)
router.post('/', scoreSubmissionLimiter, authenticateToken, async (req, res) => {
    const { score, memoryTime, matchingTime, clientGameId } = req.body; // Added clientGameId
    const mode = req.body.mode || 'normal';
    const playerId = req.user.id;

    if (score === undefined || !mode || !clientGameId) {
        return res.status(400).json({ message: 'Score, mode, and game ID are required' });
    }

    // --- Basic Anti-Cheat ---
    // 1. Validate score format and range
    const parsedScore = parseInt(score, 10);
    if (isNaN(parsedScore) || parsedScore < 0 || parsedScore > 100000) { // Example max score
        console.warn(`[CHEAT] Invalid score format or out of range for player ${playerId}: ${score}`);
        return res.status(400).json({ message: 'Invalid score value.' });
    }

    // 2. Check for duplicate submissions for the same game
    try {
        const existingScore = await db.query('SELECT id FROM scores WHERE playerId = $1 AND id = $2', [playerId, clientGameId]);
        if (existingScore.rows.length > 0) {
            console.warn(`[CHEAT] Duplicate score submission for game ID ${clientGameId} by player ${playerId}`);
            return res.status(409).json({ message: 'This game score has already been submitted.' });
        }
    } catch (err) {
        console.error('Error checking for duplicate score:', err);
        return res.status(500).json({ message: 'An error occurred while verifying the score.' });
    }
    // --- End Anti-Cheat ---

    const timestamp = new Date().toISOString();
    const client = await db.getClient(); // Get a single client for the transaction

    try {
        await client.query('BEGIN');

        
        

        

        // Always insert the new, real score
        await client.query(
            `INSERT INTO scores (id, playerId, score, mode, memoryTime, matchingTime, timestamp) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [clientGameId, playerId, parsedScore, mode, memoryTime, matchingTime, timestamp]
        );

        // After inserting the score, get the new stats for the player
        const statsQuery = `
            SELECT
                COUNT(id) AS gamecount,
                COALESCE(MAX(score), 0) AS highestscore
            FROM scores
            WHERE playerId = $1;
        `;
        const statsResult = await client.query(statsQuery, [playerId]);
        const { gamecount, highestscore } = statsResult.rows[0];

        const newLevel = calculateLevel(gamecount);

        // Update the players table with all new stats in one go
        await client.query(
            `UPDATE players SET level = $1, gameCount = $2, highestScore = $3 WHERE id = $4`,
            [newLevel, gamecount, highestscore, playerId]
        );

        await client.query('COMMIT');

        res.status(201).json({ id: clientGameId, newLevel: newLevel });

    } catch (err) {
        await client.query('ROLLBACK'); // Rollback the transaction on error
        console.error('Score submission error:', err);
        if (err.code === '23505') { // Primary key violation
             return res.status(409).json({ message: 'This game score has already been submitted.' });
        }
        return res.status(500).json({ message: 'An unexpected error occurred during score submission.' });
    } finally {
        client.release(); // ALWAYS release the client back to the pool
    }
});

// Get individual leaderboard
router.get('/individual', async (req, res) => {
    try {
        const result = await db.query(`SELECT * FROM leaderboard_materialized_view ORDER BY highestscore DESC LIMIT 20`);
        
        const rows = result.rows;
        
        const leaderboard = rows.map(row => ({
            name: row.username,
            country: row.country,
            flag: countries[row.country] ? countries[row.country].flag : '🏳️',
            score: row.highestscore,
            playerid: row.playerid,
            avatarUrl: row.avatarurl,
            level: row.level,
            mode: row.mode // Add the mode from the view
        }));

        res.json(leaderboard);
    } catch (err) {
        console.error('Individual leaderboard error:', err);
        return res.status(500).json({ message: 'An unexpected error occurred while fetching individual leaderboard.' });
    }
});

router.get('/country', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                p.country, 
                COALESCE(SUM(s.score), 0) as totalScore, 
                COUNT(DISTINCT p.id) as playerCount
            FROM 
                players p
            LEFT JOIN 
                scores s ON p.id = s.playerId
            WHERE 
                p.country IS NOT NULL AND p.country != ''
            GROUP BY 
                p.country
            ORDER BY 
                totalScore DESC
        `);
        const rows = result.rows;
        const leaderboard = rows.map(row => {
            const countryCode = row.country;
            const countryData = countries[countryCode];
            
            return {
                countryCode: countryCode,
                countryName: countryData ? countryData.name : countryCode, // Fallback to code if not found
                flag: countryData ? countryData.flag : '🏳️',
                averageScore: parseInt(row.totalscore, 10),
                playerCount: parseInt(row.playercount, 10)
            };
        });
        res.json(leaderboard);
    } catch (err) {
        console.error('Country leaderboard error:', err);
        return res.status(500).json({ message: 'An unexpected error occurred while fetching country leaderboard.' });
    }
});

// Get top players for homepage preview (no authentication required)
router.get('/top-preview', async (req, res) => {
    try {
        const result = await db.query(`
            WITH RankedScores AS (
                SELECT
                    s.playerId,
                    s.score,
                    s.mode,
                    ROW_NUMBER() OVER(PARTITION BY s.playerId ORDER BY s.score DESC, s.timestamp DESC) as rn
                FROM scores s
            )
            SELECT
                p.username,
                p.country,
                p.avatarUrl,
                p.level,
                rs.score,
                rs.mode
            FROM players p
            JOIN RankedScores rs ON p.id = rs.playerId
            WHERE rs.rn = 1
            ORDER BY rs.score DESC
            LIMIT 5;
        `);
        const rows = result.rows;
        const leaderboard = rows.map(row => ({
            name: row.username,
            country: row.country,
            flag: countries[row.country] ? countries[row.country].flag : '🏳️',
            score: row.score,
            mode: row.mode, // Added mode here
            avatarUrl: row.avatarurl,
            level: row.level
        }));
        res.json(leaderboard);
    } catch (err) {
        console.error('Top players preview leaderboard error:', err);
        return res.status(500).json({ message: 'An unexpected error occurred while fetching top players preview.' });
    }
});

module.exports = { router, calculateLevel };
