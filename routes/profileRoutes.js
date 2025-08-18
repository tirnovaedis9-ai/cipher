const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { USERNAME_MIN_LENGTH, USERNAME_MAX_LENGTH, PASSWORD_MIN_LENGTH } = require('../constants');

// --- Multer Setup for Avatar Uploads ---
const avatarUploadPath = path.join(__dirname, '../uploads/avatars');

// Ensure the upload directory exists
if (!fs.existsSync(avatarUploadPath)) {
    fs.mkdirSync(avatarUploadPath, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, avatarUploadPath);
    },
    filename: function (req, file, cb) {
        // Create a unique filename to avoid overwrites
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, req.user.id + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    // Accept images only
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/i)) {
        req.fileValidationError = 'Only image files are allowed!';
        return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
};

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: fileFilter
}).single('avatar'); // 'avatar' is the name of the form field

// --- Routes ---

// Avatar Upload Route
router.post('/avatar', authenticateToken, (req, res) => {
    upload(req, res, async function (err) {
        if (req.fileValidationError) {
            return res.status(400).json({ message: req.fileValidationError });
        }
        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ message: 'File is too large. Maximum size is 5MB.' });
            }
            return res.status(500).json({ message: `Multer error: ${err.message}` });
        } else if (err) {
            return res.status(500).json({ message: `An unknown error occurred during upload: ${err.message}` });
        }

        if (!req.file) {
            return res.status(400).json({ message: 'Please select a file to upload.' });
        }

        try {
            // Get old avatar URL to delete it
            const result = await db.query('SELECT avatarurl FROM players WHERE id = $1', [req.user.id]);
            const player = result.rows[0];
            const oldAvatarPath = player ? player.avatarurl : null;

            // Update database with the new avatar URL
            const newAvatarUrl = `uploads/avatars/${req.file.filename}`.replace(/\\/g, '/');
            await db.query('UPDATE players SET avatarUrl = $1 WHERE id = $2', [newAvatarUrl, req.user.id]);
            console.log(`[DEBUG] Avatar updated in DB for user ${req.user.id}. New URL: ${newAvatarUrl}`);

            // If there was an old avatar and it's a user-uploaded one, delete it
            if (oldAvatarPath && oldAvatarPath.startsWith('uploads/avatars/')) {
                const oldAvatarFullPath = path.join(__dirname, '..', oldAvatarPath);
                if (fs.existsSync(oldAvatarFullPath)) {
                    fs.unlinkSync(oldAvatarFullPath);
                }
            }

            res.json({
                message: 'Avatar updated successfully',
                avatarUrl: newAvatarUrl
            });
        } catch (dbErr) {
            console.error('DB update error after avatar upload:', dbErr);
            res.status(500).json({ message: 'Could not update avatar in the database.' });
        }
    });
});

// Get player profile by ID
router.get('/players/:id', async (req, res) => {
    const { id } = req.params;
    console.log(`[DEBUG] Fetching profile for player ID: ${id}`);
    try {
        const query = `
            SELECT
                p.id,
                p.username,
                p.country,
                p.avatarurl,
                p.createdat,
                p.level,
                COALESCE(s_stats.highestscore, 0) AS highestscore,
                COALESCE(s_stats.gamecount, 0) AS gamecount,
                (
                    SELECT json_agg(json_build_object('score', s.score, 'mode', s.mode, 'timestamp', s.timestamp))
                    FROM (
                        SELECT score, mode, timestamp
                        FROM scores
                        WHERE playerid = p.id
                        ORDER BY timestamp DESC
                    ) s
                ) AS scores
            FROM
                players p
            LEFT JOIN (
                SELECT
                    playerid,
                    MAX(score) AS highestscore,
                    COUNT(*) AS gamecount
                FROM
                    scores
                GROUP BY
                    playerid
            ) s_stats ON p.id = s_stats.playerid
            WHERE
                p.id = $1;
        `;

        const result = await db.query(query, [id]);
        const player = result.rows[0];

        if (!player) {
            return res.status(404).json({ message: 'Player not found.' });
        }

        res.json({
            ...player,
            scores: player.scores || [], // Ensure scores is an array
            avatarUrl: player.avatarurl // Ensure avatarUrl is correctly mapped
        });
    } catch (err) {
        console.error('Get player profile error:', err);
        return res.status(500).json({ message: 'An unexpected error occurred while fetching player profile.' });
    }
});

// Update Username
router.put('/username', authenticateToken, async (req, res) => {
    const { newUsername } = req.body;
    if (!newUsername || newUsername.length < USERNAME_MIN_LENGTH || newUsername.length > USERNAME_MAX_LENGTH) {
        return res.status(400).json({ message: `Username must be between ${USERNAME_MIN_LENGTH} and ${USERNAME_MAX_LENGTH} characters long.` });
    }
    if (!/^[a-zA-Z0-9_]+$/.test(newUsername)) {
        return res.status(400).json({ message: 'Username can only contain letters, numbers, and underscores.' });
    }

    try {
        const result = await db.query(`UPDATE players SET username = $1 WHERE id = $2`, [newUsername, req.user.id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'User not found or no changes made.' });
        }
        res.json({ message: 'Username updated successfully', newUsername });
    } catch (err) {
        console.error('Username update error:', err);
        if (err.code === '23505' || err.message.includes('UNIQUE constraint failed')) { // 23505 is unique_violation for PG
            return res.status(409).json({ message: 'Username already taken' });
        }
        return res.status(500).json({ message: 'An unexpected error occurred during username update.' });
    }
});

// Update Password
router.put('/password', authenticateToken, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: 'Current and new passwords are required.' });
    }
    if (newPassword.length < PASSWORD_MIN_LENGTH) {
        return res.status(400).json({ message: `New password must be at least ${PASSWORD_MIN_LENGTH} characters long.` });
    }

    try {
        const result = await db.query(`SELECT password FROM players WHERE id = $1`, [req.user.id]);
        const player = result.rows[0];
        if (!player) {
            return res.status(500).json({ message: 'Could not find player' });
        }

        const isPasswordValid = await bcrypt.compare(currentPassword, player.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid current password' });
        }

        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        const updateResult = await db.query(`UPDATE players SET password = $1 WHERE id = $2`, [hashedNewPassword, req.user.id]);
        if (updateResult.rowCount === 0) {
            return res.status(404).json({ message: 'User not found or no changes made.' });
        }
        res.json({ message: 'Password updated successfully' });
    } catch (err) {
        console.error('Password update error:', err);
        return res.status(500).json({ message: 'An unexpected error occurred during password update.' });
    }
});

module.exports = router;