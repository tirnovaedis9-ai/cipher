const { DEFAULT_CHAT_ROOM, CHAT_MESSAGE_COOLDOWN, isValidChatRoom } = require('../constants');
const db = require('../db');
const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');

const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

// Store connected users and their rooms
const connectedUsers = new Map(); // Map<socket.id, { playerId, username, country, avatarUrl, room }>
const typingUsers = new Map(); // Map<room, Set<username>>
const lastMessageTime = new Map();

module.exports = function(io) {
    io.on('connection', (socket) => {
        if (process.env.NODE_ENV !== 'production') {
            console.log('🔌 User connected to chat');
        }

        // Store user's current room
        let currentRoom = DEFAULT_CHAT_ROOM; // Default room

        socket.on('joinRoom', async ({ playerId, username, room, avatarUrl }) => { // Level and country removed from client payload
            try {
                // --- SERVER-SIDE AUTHENTICATION OF PLAYER DATA ---
                const playerResult = await db.query('SELECT level, country FROM players WHERE id = $1', [playerId]);
                if (playerResult.rows.length === 0) {
                    console.error(`Authentication failed: Player not found with ID ${playerId}`);
                    socket.emit('error', { message: 'Could not authenticate player.' });
                    return;
                }
                const { level, country } = playerResult.rows[0];
                if (process.env.NODE_ENV !== 'production') {
                    console.log(`👤 User ${username} attempting to join. Level: ${level}`);
                }
                // --- END SERVER-SIDE AUTHENTICATION ---

                // Leave previous room if any
                if (socket.currentRoom) {
                    socket.leave(socket.currentRoom);
                    if (typingUsers.has(socket.currentRoom)) {
                        typingUsers.get(socket.currentRoom).delete(username);
                        io.to(socket.currentRoom).emit('typingUpdate', Array.from(typingUsers.get(socket.currentRoom)));
                    }
                }

                let targetRoom = room || DEFAULT_CHAT_ROOM;

                if (!isValidChatRoom(targetRoom)) {
                    console.error(`Invalid room attempt: ${targetRoom} by ${username}`);
                    socket.emit('error', { message: 'Invalid room specified.' });
                    return;
                }

                socket.join(targetRoom);
                socket.currentRoom = targetRoom;
                socket.playerId = playerId;
                socket.username = username;
                socket.avatarUrl = avatarUrl;
                socket.level = level; // Use level from DB
                socket.country = country; // Use country from DB

                const newUser = { playerId, username, avatarUrl, room: targetRoom, level: socket.level, country: socket.country };
                connectedUsers.set(socket.id, newUser);
                if (process.env.NODE_ENV !== 'production') {
                    console.log(`🏠 ${username} joined room: ${targetRoom}`);
                }

                const usersInRoom = Array.from(connectedUsers.values())
                    .filter(user => user.room === targetRoom)
                    .map(({ playerId, username, country, avatarUrl, level }) => ({ playerId, username, country, avatarUrl, level }));

                socket.emit('userListUpdate', usersInRoom);
                socket.broadcast.to(targetRoom).emit('userJoined', { playerId, username, country, avatarUrl, level: socket.level });

            } catch (err) {
                console.error('Error during joinRoom:', err);
                socket.emit('error', { message: 'An error occurred while joining the room.' });
            }
        });

        socket.on('sendMessage', async (msg) => {
            const { text, username, playerId } = msg;
            const room = socket.currentRoom || DEFAULT_CHAT_ROOM; // Get room from socket state
            if (process.env.NODE_ENV !== 'production') {
                console.log(`💬 Message sent to room: ${room}`);
            }

            // Clear typing status when a message is sent
            if (typingUsers.has(room)) {
                typingUsers.get(room).delete(username);
                io.to(room).emit('typingUpdate', Array.from(typingUsers.get(room)));
            }

            // Rate limiting check
            const now = Date.now();
            if (lastMessageTime.has(playerId) && (now - lastMessageTime.get(playerId) < CHAT_MESSAGE_COOLDOWN)) {
                socket.emit('message', { username: 'System', message: 'Please wait before sending another message.', timestamp: new Date().toISOString(), isSystem: true });
                return;
            }
            lastMessageTime.set(playerId, now);

            if (!text || !username || !playerId) {
                return;
            }

            const messageType = 'text';

            try {
                // Get avatar and level directly from the socket object where it was stored on join
                const avatarUrl = socket.avatarUrl || 'assets/logo.jpg';
                const level = socket.level || 1;

                const timestamp = new Date().toISOString();
                const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                const sanitizedText = DOMPurify.sanitize(text);

                const messageData = { id: messageId, senderId: playerId, username, message: sanitizedText, timestamp, room, avatarUrl, type: messageType, level };

                // Save the message to the database first
                await db.query(`INSERT INTO messages (id, senderId, username, message, type, timestamp, room) VALUES ($1, $2, $3, $4, $5, $6, $7)`, 
                    [messageId, playerId, username, sanitizedText, messageType, timestamp, room]);

                // If saving is successful, then emit the message to the room
                io.to(room).emit('message', messageData);
                if (process.env.NODE_ENV !== 'production') {
                    console.log(`📤 Message broadcasted to room: ${room}`);
                }

            } catch (err) {
                console.error('Socket.IO sendMessage error:', err);
                // Inform the sender that their message failed to send
                socket.emit('message', {
                    isSystem: true,
                    username: 'System',
                    message: 'Your message could not be sent. Please try again.',
                    timestamp: new Date().toISOString(),
                    room: room
                });
            }
        });

        socket.on('typing', ({ username, room }) => {
            if (!typingUsers.has(room)) {
                typingUsers.set(room, new Set());
            }
            typingUsers.get(room).add(username);
            io.to(room).emit('typingUpdate', Array.from(typingUsers.get(room)));
        });

        socket.on('stopTyping', ({ username, room }) => {
            if (typingUsers.has(room)) {
                typingUsers.get(room).delete(username);
                io.to(room).emit('typingUpdate', Array.from(typingUsers.get(room)));
            }
        });

        socket.on('avatarUpdated', ({ avatarUrl }) => {
            const user = connectedUsers.get(socket.id);
            if (user) {
                user.avatarUrl = avatarUrl;
                socket.avatarUrl = avatarUrl; // Also update it on the socket object itself
                connectedUsers.set(socket.id, user);
                // Broadcast the specific update to the room
                io.to(user.room).emit('userProfileUpdated', { 
                    playerId: user.playerId, 
                    avatarUrl: user.avatarUrl, 
                    level: user.level // Include other fields that might change
                });
                if (process.env.NODE_ENV !== 'production') {
                    console.log(`🖼️ ${user.username} updated avatar`);
                }
            }
        });

        socket.on('disconnect', () => {
            if (process.env.NODE_ENV !== 'production') {
                console.log('🔌 User disconnected from chat');
            }
            const user = connectedUsers.get(socket.id);
            if (user) {
                connectedUsers.delete(socket.id);
                // Remove from typing users if they were typing
                if (typingUsers.has(user.room)) {
                    typingUsers.get(user.room).delete(user.username);
                    io.to(user.room).emit('typingUpdate', Array.from(typingUsers.get(user.room)));
                }
                // Notify clients in the room that this user has left
                io.to(user.room).emit('userLeft', { playerId: user.playerId });
            }
        });
    });
};
