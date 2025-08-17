module.exports = (io) => {
const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { MESSAGE_MAX_LENGTH } = require('../constants');
const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');

const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

// Edit a chat message
router.put('/messages/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    let { message } = req.body;
    const senderId = req.user.id;

    if (!message || typeof message !== 'string' || message.trim() === '') {
        return res.status(400).json({ message: 'Message content is required.' });
    }
    if (message.length > MESSAGE_MAX_LENGTH) {
        return res.status(400).json({ message: `Message is too long (max ${MESSAGE_MAX_LENGTH} characters).` });
    }

    // Sanitize the message to prevent XSS attacks
    message = DOMPurify.sanitize(message);

    try {
        const result = await db.query(`SELECT senderId, room FROM messages WHERE id = $1`, [id]);
        const row = result.rows[0];
        if (!row) {
            return res.status(404).json({ message: 'Message not found' });
        }
        if (String(row.senderid) !== String(senderId)) {
            return res.status(403).json({ message: 'You are not authorized to edit this message' });
        }

        const room = row.room;
        const timestamp = new Date().toISOString();

        const updateResult = await db.query(`UPDATE messages SET message = $1, timestamp = $2 WHERE id = $3`, [message, timestamp, id]);
        if (updateResult.rowCount === 0) {
            return res.status(404).json({ message: 'Message not found or no changes made.' });
        }
        io.to(room).emit('messageUpdated', { id, message, timestamp }); // Socket.io handled in server.js
        res.json({ message: 'Message updated successfully.', id, message, timestamp });
    } catch (err) {
        console.error('Chat message update error:', err);
        return res.status(500).json({ message: 'An unexpected error occurred while updating message.' });
    }
});

// Delete a chat message
router.delete('/messages/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const senderId = req.user.id;

    try {
        const result = await db.query(`SELECT senderId, room FROM messages WHERE id = $1`, [id]);
        const row = result.rows[0];
        if (!row) {
            return res.status(404).json({ message: 'Message not found' });
        }
        if (String(row.senderid) !== String(senderId)) {
            return res.status(403).json({ message: 'You are not authorized to delete this message' });
        }

        const room = row.room;

        const deleteResult = await db.query(`DELETE FROM messages WHERE id = $1`, [id]);
        if (deleteResult.rowCount === 0) {
            return res.status(404).json({ message: 'Message not found.' });
        }
        io.to(room).emit('messageDeleted', { id }); // Socket.io handled in server.js
        res.json({ message: 'Message deleted successfully.', id });
    } catch (err) {
        console.error('Chat message delete error:', err);
        return res.status(500).json({ message: 'An unexpected error occurred while deleting message.' });
    }
});

// Get chat history
router.get('/history/:room', async (req, res) => {
    const room = req.params.room;
    const limit = parseInt(req.query.limit) || 50; // Default to 50 messages
    const offset = parseInt(req.query.offset) || 0; // Default to 0 offset

    try {
        const result = await db.query(`SELECT m.id, m.senderId AS "senderId", m.username, m.message, m.type, m.timestamp, m.room, p.avatarurl AS "avatarUrl", p.level
            FROM messages m
            JOIN players p ON m.senderId = p.id
            WHERE m.room = $1
            ORDER BY m.timestamp DESC
            LIMIT $2 OFFSET $3`, [room, limit, offset]);
        const rows = result.rows;
        // Manually format the timestamp string to ensure it's treated as UTC on the client-side.
        // PostgreSQL returns a string like '2023-01-01 15:00:00', which JS interprets as local time.
        // We convert it to '2023-01-01T15:00:00Z' to force UTC parsing.
        rows.forEach(row => {
            if (row.timestamp && typeof row.timestamp === 'string') {
                row.timestamp = row.timestamp.replace(' ', 'T') + 'Z';
            }
        });
        // Reverse the order to send oldest first, so client can append
        res.json(rows.reverse());
    } catch (err) {
        console.error('Chat history fetch error:', err);
        return res.status(500).json({ message: 'An unexpected error occurred while fetching chat history.' });
    }
});

// Get distinct chat rooms
router.get('/rooms', authenticateToken, async (req, res) => {
    try {
        const result = await db.query(`SELECT DISTINCT room FROM messages`);
        const rooms = result.rows.map(row => row.room.trim());
        res.json(rooms);
    } catch (err) {
        console.error('Chat rooms fetch error:', err);
        return res.status(500).json({ message: 'An unexpected error occurred while fetching chat rooms.' });
    }
});

return router;
};
