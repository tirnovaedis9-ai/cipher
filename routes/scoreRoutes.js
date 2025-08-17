const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { countries } = require('../constants');

// Helper function to calculate level based on game count
function calculateLevel(gameCount) {
    // 30 games = level 1, 60 games = level 2, etc.
    const level = Math.floor(gameCount / 30);
    return Math.min(level, 10); // Cap the level at 10
}

// Submit a score (protected)
router.post('/', authenticateToken, async (req, res) => {
    const { score, mode, memoryTime, matchingTime, clientGameId } = req.body; // Added clientGameId
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

        // After the transaction, get the new total game count
        const gameCountResult = await client.query(`SELECT COUNT(*) as gamecount FROM scores WHERE playerId = $1`, [playerId]);
        const gameCount = parseInt(gameCountResult.rows[0].gamecount, 10) || 0;
        const newLevel = calculateLevel(gameCount);

        // --- DEBUG LOGGING ---
        console.log(`[LEVEL_UPDATE] Player ID: ${playerId}`);
        console.log(`[LEVEL_UPDATE] Game Count Result:`, gameCountResult.rows[0]);
        console.log(`[LEVEL_UPDATE] Parsed Game Count: ${gameCount}`);
        console.log(`[LEVEL_UPDATE] Calculated New Level: ${newLevel}`);
        // --- END DEBUG LOGGING ---

        // Always update the player's level to ensure it's in sync with the game count
        await client.query(`UPDATE players SET level = $1 WHERE id = $2`, [newLevel, playerId]);

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
        const result = await db.query(`
            WITH PlayerStats AS (
                SELECT
                    playerId,
                    MAX(score) AS highestScore,
                    COUNT(id) AS gameCount
                FROM scores
                GROUP BY playerId
            ),
            RankedScores AS (
                SELECT
                    s.playerId,
                    s.score,
                    s.mode,
                    s.timestamp,
                    ROW_NUMBER() OVER(PARTITION BY s.playerId ORDER BY s.score DESC, s.timestamp DESC) as rn
                FROM scores s
            )
            SELECT
                p.username,
                p.country,
                p.id AS playerid,
                p.avatarurl,
                p.level,
                p.createdAt,
                rs.score,
                rs.mode,
                ps.highestScore,
                ps.gameCount
            FROM players p
            JOIN RankedScores rs ON p.id = rs.playerId
            LEFT JOIN PlayerStats ps ON p.id = ps.playerId
            WHERE rs.rn = 1
            ORDER BY rs.score DESC
            LIMIT 20
        `);
        const rows = result.rows;
        const leaderboard = rows.map(row => ({
            name: row.username,
            country: row.country,
            flag: countries[row.country] ? countries[row.country].flag : '🏳️',
            score: row.score,
            mode: row.mode,
            playerid: row.playerid,
            avatarUrl: row.avatarurl,
            level: row.level,
            highestScore: row.highestscore,
            gameCount: row.gamecount,
            createdAt: row.createdat
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
            const averageScore = parseInt(row.playercount, 10) > 0 ? Math.round(parseInt(row.totalscore, 10) / parseInt(row.playercount, 10)) : 0;
            
            return {
                countryCode: countryCode,
                countryName: countryData ? countryData.name : countryCode, // Fallback to code if not found
                flag: countryData ? countryData.flag : '🏳️',
                averageScore: averageScore,
                playerCount: parseInt(row.playercount, 10)
            };
        });
        res.json(leaderboard);
    } catch (err) {
        console.error('Country leaderboard error:', err);
        return res.status(500).json({ message: 'An unexpected error occurred while fetching country leaderboard.' });
    }
});

module.exports = { router, calculateLevel };
