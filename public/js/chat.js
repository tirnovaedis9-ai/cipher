let socket;
let typingTimeout = null;

function connectChat() {
    if (!gameState.isLoggedIn) {
        console.log('Not logged in, cannot connect to chat.');
        return;
    }

    if (socket && socket.connected) {
        console.log('Already connected to chat, ensuring correct room.');
        const roomToJoin = gameState.playerCountry ? `country-${gameState.playerCountry}` : window.DEFAULT_CHAT_ROOM;
        if (gameState.currentRoom !== roomToJoin) {
            socket.emit('joinRoom', { 
                playerId: gameState.playerId, 
                username: gameState.username, 
                room: roomToJoin, 
                avatarUrl: gameState.avatarUrl, 
                level: gameState.level, 
                country: gameState.playerCountry 
            });
            gameState.currentRoom = roomToJoin;
            fetchChatMessages(roomToJoin);
            populateChatRoomList();
        }
        return;
    }

    console.log('Attempting to connect to chat...');
    initializeChatSocket();
}

function initializeChatSocket() {
    if (socket && socket.connected) {
        return; // Socket already initialized and connected
    }
    if (!socket) {
        socket = io({
            // Optional: Add connection options if needed, e.g., transports
            // transports: ['websocket', 'polling'],
        });
    }

    // Remove all previous listeners to prevent duplicates
    socket.off('connect');
    socket.off('message');
    socket.off('userListUpdate');
    socket.off('userJoined');
    socket.off('userLeft');
    socket.off('userProfileUpdated');
    socket.off('typingUpdate');
    socket.off('disconnect');
    socket.off('messageUpdated');
    socket.off('messageDeleted');
    socket.off('error');

    socket.on('connect', () => {
        console.log('Connected to chat server.');
        // Determine the room to join based on user's country
        const roomToJoin = gameState.playerCountry ? `country-${gameState.playerCountry}` : window.DEFAULT_CHAT_ROOM;
        gameState.currentRoom = roomToJoin;
        console.log('Sending level to server:', gameState.level);
        socket.emit('joinRoom', { playerId: gameState.playerId, username: gameState.username, room: roomToJoin, avatarUrl: gameState.avatarUrl, level: gameState.level, country: gameState.playerCountry });
        fetchChatMessages(roomToJoin);
        populateChatRoomList();
    });

    socket.on('message', (message) => {
        console.log('Received message:', message);
        console.log('Current room:', gameState.currentRoom);
        if (message.room === gameState.currentRoom || message.isSystem) {
            displayMessage(message);
        }
    });

    socket.on('userListUpdate', (users) => {
        updateUserListDisplay(users);
    });

    socket.on('userJoined', (user) => {
        addUserToList(user);
    });

    socket.on('userLeft', (data) => {
        removeUserFromList(data.playerId);
    });

    socket.on('userProfileUpdated', (data) => {
        updateUserInList(data);
    });

    socket.on('typingUpdate', (typingUsernames) => {
        updateTypingIndicator(typingUsernames);
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from chat server.');
        updateUserListDisplay([]);
        updateTypingIndicator([]);
    });

    socket.on('messageUpdated', (data) => {
        const messageElement = document.querySelector(`[data-message-id="${data.id}"]`);
        if (messageElement) {
            const messageContentDiv = messageElement.querySelector('.message-content');
            const date = new Date(data.timestamp);
            const timestamp = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            messageContentDiv.innerHTML = `<p>${parseMarkdown(data.message)}</p><span class="timestamp">${timestamp}</span>`;
            // Re-attach event listeners for the options button if it exists
            const messageOptionsBtn = messageElement.querySelector('.message-options-btn');
            const messageActions = messageElement.querySelector('.message-actions');
            if (messageOptionsBtn && messageActions) {
                messageOptionsBtn.addEventListener('click', (event) => {
                    event.stopPropagation();
                    document.querySelectorAll('.message-actions').forEach(menu => {
                        if (menu !== messageActions) {
                            menu.classList.add('hidden');
                        }
                    });
                    messageActions.classList.toggle('hidden');
                });
                document.addEventListener('click', (event) => {
                    if (messageActions && !messageActions.contains(event.target) && !messageOptionsBtn.contains(event.target)) {
                        messageActions.classList.add('hidden');
                    }
                });
                const editBtn = messageActions.querySelector('.edit-message-btn');
                const deleteBtn = messageActions.querySelector('.delete-message-btn');
                if (editBtn) editBtn.addEventListener('click', () => enableMessageEdit(data.id, data.message));
                if (deleteBtn) deleteBtn.addEventListener('click', () => deleteMessage(data.id));
            }
        }
    });

    socket.on('messageDeleted', (data) => {
        const messageElement = document.querySelector(`[data-message-id="${data.id}"]`);
        if (messageElement) {
            messageElement.remove();
        }
    });

    socket.on('error', (error) => {
        console.error('Chat socket error:', error);
        showNotification(`Chat error: ${error.message}`, 'error');
    });
}

async function fetchChatMessages(room = gameState.currentRoom, append = false) {
    const chatMessagesDiv = document.getElementById('chatMessages');
    const loadMoreBtnId = 'loadMoreMessagesBtn';

    // If appending, find the button. If not, clear everything.
    if (!append) {
        chatMessagesDiv.innerHTML = ''; 
        gameState.chatHistoryOffset = 0;
    } else {
        const oldLoadMoreBtn = document.getElementById(loadMoreBtnId);
        if (oldLoadMoreBtn) {
            oldLoadMoreBtn.remove();
        }
    }

    try {
        const history = await apiRequest(`/api/chat/history/${room}?limit=${gameState.chatHistoryLimit}&offset=${gameState.chatHistoryOffset}`, 'GET');
        
        // --- DEBUG LOGS START ---
        console.log('--- fetchChatMessages DEBUG ---');
        console.log('GameState Player ID at fetch time:', gameState.playerId);
        console.log('Fetched History:', history);
        console.log('-------------------------------');
        // --- DEBUG LOGS END ---

        if (history.length > 0) {
            const fragment = document.createDocumentFragment();
            history.forEach(msg => {
                // --- Start of change: De-duplication logic ---
                // If a message with this ID already exists in the DOM, skip it.
                if (document.querySelector(`[data-message-id="${msg.id}"]`)) {
                    return; // Skip this message
                }
                // --- End of change ---

                const messageElement = createMessageElement(msg);
                fragment.appendChild(messageElement);
            });
            
            chatMessagesDiv.prepend(fragment);

            // ONLY add the 'Load More' button if the number of messages received is equal to the limit,
            // which implies there might be more messages to fetch.
            if (history.length === gameState.chatHistoryLimit) {
                const loadMoreBtn = document.createElement('button');
                loadMoreBtn.id = loadMoreBtnId;
                loadMoreBtn.textContent = 'Load More Messages';
                loadMoreBtn.classList.add('load-more-messages-btn');
                loadMoreBtn.addEventListener('click', () => fetchChatMessages(gameState.currentRoom, true));
                chatMessagesDiv.prepend(loadMoreBtn);
            }

            if (!append) {
                chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight;
            }

            gameState.chatHistoryOffset += history.length;
        } else if (!append) {
            chatMessagesDiv.innerHTML = '<div class="no-messages-yet">No messages in this chat yet.</div>';
        }

    } catch (error) {
        console.error('Failed to fetch chat history:', error);
        showNotification(`Failed to load chat history: ${error.message}`, 'error');
        if (!append) {
            chatMessagesDiv.innerHTML = '<div class="error-loading-messages">Error loading messages.</div>';
        }
    }
}



// Helper function to create a message element (extracted from displayMessage)
function createMessageElement(message) {
    const messageElement = document.createElement('div');
    // Ensure gameState.playerId is a string for consistent comparison, or handle null
    const currentPlayerId = gameState.playerId ? String(gameState.playerId) : null;
    const messageSenderId = message.senderId ? String(message.senderId) : null;
    
    const isSent = currentPlayerId && messageSenderId && currentPlayerId === messageSenderId;

    // --- DEBUG LOGS START ---
    console.log('--- createMessageElement DEBUG ---');
    console.log('Message ID:', message.id);
    console.log('Message Sender ID (raw):', message.senderId);
    console.log('Current GameState Player ID (raw):', gameState.playerId);
    console.log('Current Player ID (processed):', currentPlayerId);
    console.log('Message Sender ID (processed):', messageSenderId);
    console.log('Is Sent (comparison result):', isSent);
    console.log('----------------------------------');
    // --- DEBUG LOGS END ---

    messageElement.classList.add('chat-message-item', isSent ? 'sent' : 'received');
    if (message.isSystem) {
        messageElement.classList.add('system');
    }
    messageElement.dataset.messageId = message.id;

    const date = new Date(message.timestamp);
    const timestamp = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const avatarSrc = message.avatarUrl || 'assets/logo.jpg';

    const messageContentHtml = `<p>${parseMarkdown(message.message)} <span class="timestamp">${timestamp}</span></p>`; // Timestamp moved inside p tag

    messageElement.innerHTML = `
        <div class="message-avatar-container">
            <span class="username">${message.username}</span>
            <img src="${avatarSrc}" alt="Avatar" class="chat-avatar level-${message.level}-border">
        </div>
        <div class="message-bubble">
            <div class="message-content">${messageContentHtml}</div>
        </div>
        ${isSent ? `
            <div class="message-actions-container">
                <button class="message-options-btn"><i class="fas fa-ellipsis-h"></i></button>
                <div class="message-actions hidden">
                    <button class="edit-message-btn" data-message-id="${message.id}"><i class="fas fa-edit"></i> Edit</button>
                    <button class="delete-message-btn" data-message-id="${message.id}"><i class="fas fa-trash"></i> Delete</button>
                </div>
            </div>
            ` : ''}
    `;

    // Event listeners will be handled by delegation on the chatMessagesDiv
    return messageElement;
}

// Modify displayMessage to use createMessageElement and append
function displayMessage(message) {
    const chatMessagesDiv = document.getElementById('chatMessages');
    const messageElement = createMessageElement(message);
    chatMessagesDiv.appendChild(messageElement);
    chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight;
}

// Event Delegation for chat messages
document.getElementById('chatMessages').addEventListener('click', (event) => {
    const target = event.target;
    const messageElement = target.closest('.chat-message-item');
    if (!messageElement) return;

    const messageId = messageElement.dataset.messageId;

    // Handle clicks on the options button
    if (target.closest('.message-options-btn')) {
        event.stopPropagation();
        const messageActions = messageElement.querySelector('.message-actions');
        if (messageActions) {
            // Hide all other action menus
            document.querySelectorAll('.message-actions').forEach(menu => {
                if (menu !== messageActions) {
                    menu.classList.add('hidden');
                }
            });
            messageActions.classList.toggle('hidden');
        }
    }
    // Handle clicks on the edit button
    else if (target.closest('.edit-message-btn')) {
        const messageContent = messageElement.querySelector('.message-content p').textContent;
        enableMessageEdit(messageId, messageContent);
    }
    // Handle clicks on the delete button
    else if (target.closest('.delete-message-btn')) {
        deleteMessage(messageId);
    }
});

// Hide message action menus when clicking outside
document.addEventListener('click', (event) => {
    if (!event.target.closest('.message-actions-container')) {
        document.querySelectorAll('.message-actions').forEach(menu => {
            menu.classList.add('hidden');
        });
    }
});


function sendMessage() {
    const chatInput = document.getElementById('chatInput');
    const message = chatInput.value.trim();

    if (!message) return;

    const now = Date.now();
    const chatMessageCooldown = 2000;
    if (now - gameState.lastChatMessageTime < chatMessageCooldown) {
        showNotification('Please wait before sending another message.', 'info');
        return;
    }
    gameState.lastChatMessageTime = now;

    if (!gameState.isLoggedIn) {
        showNotification('Please log in to send messages.', 'info');
        return;
    }
    if (!socket || !socket.connected) {
        showNotification('Not connected to chat server. Please try again later.', 'error');
        return;
    }

    socket.emit('stopTyping', { username: gameState.username, room: gameState.currentRoom });

    socket.emit('sendMessage', { text: message, username: gameState.username, country: gameState.playerCountry, playerId: gameState.playerId, type: 'text' });
    
    chatInput.value = '';
}

function parseMarkdown(text) {
    if (typeof text !== 'string') return text;
    let parsedText = text;

    // Basic Markdown parsing (keep this if you want markdown support)
    parsedText = parsedText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'); // Bold
    parsedText = parsedText.replace(/\*(.*?)\*/g, '<em>$1</em>'); // Italic
    parsedText = parsedText.replace(/~~(.*?)~~/g, '<del>$1</del>'); // Strikethrough
    parsedText = parsedText.replace(/`(.*?)`/g, '<code>$1</code>'); // Code
    parsedText = parsedText.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'); // Links
    parsedText = parsedText.replace(/^>\s*(.*)$/gm, '<blockquote>$1</blockquote>'); // Blockquote

    // Sanitize the parsed HTML using DOMPurify
    return DOMPurify.sanitize(parsedText, { USE_PROFILES: { html: true } });
}

function handleTyping() {
    if (!gameState.isLoggedIn || !socket || !socket.connected) return;

    socket.emit('typing', { username: gameState.username, room: gameState.currentRoom });

    if (typingTimeout) {
        clearTimeout(typingTimeout);
    }
    typingTimeout = setTimeout(() => {
        socket.emit('stopTyping', { username: gameState.username, room: gameState.currentRoom });
    }, 3000);
}

function updateUserListDisplay(users) {
    const onlineUserList = document.getElementById('onlineUserList');
    const onlineUserCount = document.getElementById('onlineUserCount');
    const activeUserListSidebar = document.getElementById('activeUserListSidebar');

    if (!onlineUserList || !onlineUserCount || !activeUserListSidebar) return;

    onlineUserList.innerHTML = '';
    activeUserListSidebar.innerHTML = ''; // Clear sidebar list as well
    onlineUserCount.textContent = users.length;

    if (users.length === 0) {
        const noUsersMessage = 'No other users online right now.';
        onlineUserList.innerHTML = `<li class="online-user-item no-users-message">${noUsersMessage}</li>`;
        activeUserListSidebar.innerHTML = `<li class="online-user-item no-users-message">${noUsersMessage}</li>`;
    } else {
        users.forEach(user => {
            const userElement = createUserListItem(user);
            onlineUserList.appendChild(userElement.cloneNode(true));
            activeUserListSidebar.appendChild(userElement);
        });
    }
}

function createUserListItem(user) {
    const listItem = document.createElement('li');
    listItem.classList.add('online-user-item');
    listItem.dataset.playerId = user.playerId;
    listItem.innerHTML = `
        <img src="${user.avatarUrl || 'assets/logo.jpg'}" alt="Avatar" class="online-user-avatar level-${user.level}-border">
        <span class="username">${user.username}</span>
    `;
    return listItem;
}

function addUserToList(user) {
    const onlineUserList = document.getElementById('onlineUserList');
    const onlineUserCount = document.getElementById('onlineUserCount');
    const activeUserListSidebar = document.getElementById('activeUserListSidebar');

    // Remove the "No other users" message if it exists
    const noUsersMessage = onlineUserList.querySelector('.no-users-message');
    if (noUsersMessage) {
        noUsersMessage.remove();
        const sidebarMessage = activeUserListSidebar.querySelector('.no-users-message');
        if (sidebarMessage) sidebarMessage.remove();
    }

    // Add the new user
    const userElement = createUserListItem(user);
    onlineUserList.appendChild(userElement.cloneNode(true));
    activeUserListSidebar.appendChild(userElement);

    // Update count
    onlineUserCount.textContent = parseInt(onlineUserCount.textContent) + 1;
}

function removeUserFromList(playerId) {
    const onlineUserList = document.getElementById('onlineUserList');
    const onlineUserCount = document.getElementById('onlineUserCount');
    const activeUserListSidebar = document.getElementById('activeUserListSidebar');

    const userElements = document.querySelectorAll(`[data-player-id="${playerId}"]`);
    userElements.forEach(el => el.remove());

    // Update count
    const newCount = parseInt(onlineUserCount.textContent) - 1;
    onlineUserCount.textContent = newCount;

    // If list is empty, show the message
    if (newCount === 0) {
        const noUsersMessage = 'No other users online right now.';
        onlineUserList.innerHTML = `<li class="online-user-item no-users-message">${noUsersMessage}</li>`;
        activeUserListSidebar.innerHTML = `<li class="online-user-item no-users-message">${noUsersMessage}</li>`;
    }
}

function updateUserInList(user) {
    const userElements = document.querySelectorAll(`[data-player-id="${user.playerId}"]`);
    userElements.forEach(element => {
        const avatarImg = element.querySelector('.online-user-avatar');
        if (avatarImg) {
            avatarImg.src = user.avatarUrl || 'assets/logo.jpg';
            // Update level border if it can change
            avatarImg.className = `online-user-avatar level-${user.level}-border`;
        }
        const usernameSpan = element.querySelector('.username');
        if (usernameSpan) {
            usernameSpan.textContent = user.username;
        }
    });
}

function updateTypingIndicator(typingUsernames) {
    const typingUsersDisplay = document.getElementById('typingUsersDisplay');
    if (!typingUsersDisplay) return;

    const filteredTypingUsernames = typingUsernames.filter(name => name !== gameState.username);

    if (filteredTypingUsernames.length === 0) {
        typingUsersDisplay.textContent = '';
    } else if (filteredTypingUsernames.length === 1) {
        typingUsersDisplay.textContent = `${filteredTypingUsernames[0]} is typing...`;
    } else if (filteredTypingUsernames.length === 2) {
        typingUsersDisplay.textContent = `${filteredTypingUsernames[0]} and ${filteredTypingUsernames[1]} are typing...`;
    } else {
        typingUsersDisplay.textContent = `Multiple users are typing...`;
    }
}

function enableMessageEdit(messageId, currentMessage) {
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    if (!messageElement) return;

    const messageContentDiv = messageElement.querySelector('.message-content');
    const messageActionsContainer = messageElement.querySelector('.message-actions-container');

    messageElement.dataset.originalContent = messageContentDiv.innerHTML;
    if (messageActionsContainer) {
        messageElement.dataset.originalActionsHtml = messageActionsContainer.outerHTML; // Store outerHTML
    }

    messageContentDiv.innerHTML = `
        <textarea id="editMessageTextarea" class="edit-message-textarea">${currentMessage}</textarea>
    `;
    if (messageActionsContainer) {
        messageActionsContainer.innerHTML = `
            <button class="save-edit-btn" data-message-id="${messageId}"><i class="fas fa-check"></i> Save</button>
            <button class="cancel-edit-btn" data-message-id="${messageId}"><i class="fas fa-times"></i> Cancel</button>
        `;
        // Re-attach event listeners for the new buttons
        messageActionsContainer.querySelector('.save-edit-btn').addEventListener('click', (event) => saveEditedMessage(messageId));
        messageActionsContainer.querySelector('.cancel-edit-btn').addEventListener('click', (event) => cancelEdit(messageId));
    }
}

async function saveEditedMessage(messageId) {
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    if (!messageElement) return;

    const newContent = messageElement.querySelector('#editMessageTextarea').value;

    try {
        const response = await apiRequest(`/api/chat/messages/${messageId}`, 'PUT', { message: newContent });
        showNotification(response.message || 'Message updated.', 'success');
    } catch (error) {
        console.error('Failed to save edited message:', error);
        showNotification(`Failed to update message: ${error.message}`, 'error');
        cancelEdit(messageId);
    }
}

function cancelEdit(messageId) {
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    if (!messageElement) return;

    const messageContentDiv = messageElement.querySelector('.message-content');
    const messageActionsContainer = messageElement.querySelector('.message-actions-container');

    messageContentDiv.innerHTML = messageElement.dataset.originalContent;
    if (messageActionsContainer) {
        messageActionsContainer.innerHTML = messageElement.dataset.originalActionsHtml; // Restore the entire container
    }
    const messageStatusSpan = messageElement.querySelector('.message-status');
    if (messageStatusSpan) {
        messageStatusSpan.textContent = '';
    }

    // Re-attach event listeners for the restored message options button
    const messageOptionsBtn = messageElement.querySelector('.message-options-btn');
    const messageActions = messageElement.querySelector('.message-actions');

    if (messageOptionsBtn) {
        messageOptionsBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            document.querySelectorAll('.message-actions').forEach(menu => {
                if (menu !== messageActions) {
                    menu.classList.add('hidden');
                }
            });
            messageActions.classList.toggle('hidden');
        });
    }

    document.addEventListener('click', (event) => {
        if (messageActions && !messageActions.contains(event.target) && !messageOptionsBtn.contains(event.target)) {
            messageActions.classList.add('hidden');
        }
    });

    const editBtn = messageElement.querySelector('.edit-message-btn');
    const deleteBtn = messageElement.querySelector('.delete-message-btn');
    if (editBtn) editBtn.addEventListener('click', () => enableMessageEdit(messageId, messageElement.querySelector('.message-content p').textContent.trim()));
    if (deleteBtn) deleteBtn.addEventListener('click', () => deleteMessage(messageId));
}

async function deleteMessage(messageId) {
    try {
        const response = await apiRequest(`/api/chat/messages/${messageId}`, 'DELETE');
        showNotification(response.message || 'Message deleted.', 'success');
    } catch (error) {
        console.error('Failed to delete message:', error);
        showNotification(`Failed to delete message: ${error.message}`, 'error');
    }
}


function showChatScreen() {
    if (!gameState.isLoggedIn) {
        showNotification('Please log in to use chat.', 'info');
        return;
    }
    document.getElementById('chatModal').style.display = 'block';
    document.getElementById('onlineUsersDropdown').classList.remove('active');
    document.body.classList.add('no-scroll');
}

function closeChatScreen() {
    document.getElementById('chatModal').style.display = 'none';
    document.getElementById('onlineUsersDropdown').classList.remove('active');
    document.body.classList.remove('no-scroll');
}

function populateChatRoomList() {
    const chatRoomList = document.getElementById('chatRoomList');
    if (!chatRoomList) return;

    // Start with general rooms
    const rooms = [
        { id: 'Global', name: 'Global' },
        { id: 'Europe', name: 'Europe' },
        { id: 'Asia', name: 'Asia' },
        { id: 'North-America', name: 'North America' },
        { id: 'South-America', name: 'South America' },
        { id: 'Africa', name: 'Africa' },
        { id: 'Oceania', name: 'Oceania' }
    ];

    // Add country-specific room to the beginning of the list if it exists
    if (gameState.playerCountry && countries[gameState.playerCountry]) {
        const countryName = countries[gameState.playerCountry].name;
        rooms.unshift({ id: `country-${gameState.playerCountry}`, name: countryName });
    }

    chatRoomList.innerHTML = ''; // Clear existing list

    rooms.forEach(room => {
        const listItem = document.createElement('li');
        listItem.className = 'chat-room-list-item';
        listItem.textContent = room.name;
        listItem.dataset.roomId = room.id;

        if (room.id === gameState.currentRoom) {
            listItem.classList.add('active');
        }

        listItem.addEventListener('click', () => switchRoom(room.id));
        chatRoomList.appendChild(listItem);
    });
}

function switchRoom(newRoom) {
    if (newRoom === gameState.currentRoom) {
        return; // Already in this room
    }

    socket.emit('joinRoom', {
        playerId: gameState.playerId,
        username: gameState.username,
        room: newRoom,
        avatarUrl: gameState.avatarUrl,
        level: gameState.level
    });

    gameState.currentRoom = newRoom;
    fetchChatMessages(newRoom);
    populateChatRoomList(); // Update active room in the list
}
