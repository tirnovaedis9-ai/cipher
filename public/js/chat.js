let socket;
let typingTimeout = null;

function connectChat() {
    if (!gameState.isLoggedIn) {
        if (window.IS_DEVELOPMENT) {
            console.log('Not logged in, cannot connect to chat.');
        }
        return;
    }

    if (socket && socket.connected) {
        if (window.IS_DEVELOPMENT) {
            console.log('Already connected to chat, ensuring correct room.');
        }
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

    if (window.IS_DEVELOPMENT) {
        console.log('Attempting to connect to chat...');
    }
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
        if (window.IS_DEVELOPMENT) {
            console.log('Connected to chat server.');
        }
        // Determine the room to join based on user's country
        const roomToJoin = gameState.playerCountry ? `country-${gameState.playerCountry}` : window.DEFAULT_CHAT_ROOM;
        gameState.currentRoom = roomToJoin;
        if (window.IS_DEVELOPMENT) {
            console.log('Sending level to server:', gameState.level);
        }
        socket.emit('joinRoom', { playerId: gameState.playerId, username: gameState.username, room: roomToJoin, avatarUrl: gameState.avatarUrl, level: gameState.level, country: gameState.playerCountry });
        fetchChatMessages(roomToJoin);
        populateChatRoomList();
    });

    socket.on('message', (message) => {
        if (window.IS_DEVELOPMENT) {
            console.log('Received message:', message);
            console.log('Current room:', gameState.currentRoom);
        }
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
        if (window.IS_DEVELOPMENT) {
            console.log('--- fetchChatMessages DEBUG ---');
            console.log('GameState Player ID at fetch time:', gameState.playerId);
            console.log('Fetched History:', history);
            console.log('-------------------------------');
        }
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
            
            if (append) {
                chatMessagesDiv.prepend(fragment);
            } else {
                chatMessagesDiv.appendChild(fragment);
            }

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
                scrollToChatBottom();
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

    // --- START: Workaround for potential backend level inconsistency ---
    let levelToShow = message.level; // Default to the level from the message
    if (isSent) {
        // For my own messages, always trust my local state
        levelToShow = gameState.level;
    } else if (gameState.chatUsers) {
        // For received messages, try to find the user in the current user list,
        // as it's likely more up-to-date than the broadcasted message level.
        const sender = gameState.chatUsers.find(u => String(u.playerId) === messageSenderId);
        if (sender) {
            levelToShow = sender.level;
        }
    }
    // --- END: Workaround ---

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

    const levelClass = levelToShow > 0 ? ` level-${levelToShow}-border` : ' no-border';

    const messageContentHtml = `<p>${parseMarkdown(message.message)} <span class="timestamp">${timestamp}</span></p>`; // Timestamp moved inside p tag

    messageElement.innerHTML = `
        <div class="message-avatar-container">
            <span class="username">${message.username}</span>
            <img src="${avatarSrc}" alt="Avatar" class="chat-avatar${levelClass} clickable-avatar">
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

function scrollToChatBottom() {
    const chatMessagesDiv = document.getElementById('chatMessages');
    if (chatMessagesDiv) {
        // Use a timeout to ensure the DOM has rendered and scrollHeight is correct, especially on initial load
        setTimeout(() => {
            chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight;
            chatMessagesDiv.classList.remove('messages-loading');
        }, 50);
    }
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
    gameState.chatUsers = users; // Store the current user list for lookups
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
    const levelClass = user.level > 0 ? ` level-${user.level}-border` : ' no-border';
    listItem.innerHTML = `
        <img src="${user.avatarUrl || 'assets/logo.jpg'}" alt="Avatar" class="online-user-avatar${levelClass} clickable-avatar">
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
            if (user.level > 0) {
                avatarImg.className = `online-user-avatar level-${user.level}-border`;
            } else {
                avatarImg.className = 'online-user-avatar no-border';
            }
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
        typingUsersDisplay.textContent = getTranslation('multipleUsersTyping');
    }
}

function enableMessageEdit(messageId, currentMessage) {
    showGenericModal(
        'Edit Message',
        '', // Message content will be in textarea
        true, // Show textarea
        'Save',
        (editedMessage) => saveEditedMessage(messageId, editedMessage),
        () => cancelEdit(messageId) // Pass a function to cancelEdit
    );
    // Populate the textarea with the current message
    document.getElementById('genericModalTextarea').value = currentMessage;
}

async function saveEditedMessage(messageId, newContent) {
    try {
        const response = await apiRequest(`/api/chat/messages/${messageId}`, 'PUT', { message: newContent });
        showNotification(response.message || 'Message updated.', 'success');
    } catch (error) {
        console.error('Failed to save edited message:', error);
        showNotification(`Failed to update message: ${error.message}`, 'error');
        // No need to call cancelEdit here, as the modal handles its own closing
    }
}

function cancelEdit(messageId) {
    // No need to restore message content or actions, as the modal handles editing
    // The original message element remains untouched until messageUpdated event
    hideGenericModal();
}

async function deleteMessage(messageId) {
    showGenericModal(
        'Confirm Deletion',
        'Are you sure you want to delete this message? This action cannot be undone.',
        false, // Do not show textarea
        'Delete',
        async () => { // On confirm
            try {
                const response = await apiRequest(`/api/chat/messages/${messageId}`, 'DELETE');
                showNotification(response.message || 'Message deleted.', 'success');
            } catch (error) {
                console.error('Failed to delete message:', error);
                showNotification(`Failed to delete message: ${error.message}`, 'error');
            }
        },
        null // No specific action on cancel for delete
    );
}


function showChatScreen() {
    if (!gameState.isLoggedIn) {
        showNotification(getTranslation('pleaseLoginToUseChat'), 'info');
        return;
    }
    document.getElementById('chatMessages').classList.add('messages-loading');
    document.getElementById('chatModal').style.display = 'block';
    document.getElementById('onlineUsersDropdown').classList.remove('active');
    document.body.classList.add('no-scroll');
    scrollToChatBottom();
}

function closeChatScreen() {
    document.getElementById('chatModal').style.display = 'none';
    document.getElementById('onlineUsersDropdown').classList.remove('active');
    document.body.classList.remove('no-scroll');
}

// Generic Modal Functions
function showGenericModal(title, message, showTextarea, confirmBtnText, onConfirm, onCancel) {
    const genericModal = document.getElementById('genericModal');
    const genericModalTitle = document.getElementById('genericModalTitle');
    const genericModalMessage = document.getElementById('genericModalMessage');
    const genericModalTextarea = document.getElementById('genericModalTextarea');
    const genericModalConfirmBtn = document.getElementById('genericModalConfirmBtn');
    const genericModalCancelBtn = document.getElementById('genericModalCancelBtn');

    genericModalTitle.textContent = title;
    genericModalMessage.innerHTML = message; // Use innerHTML for potential markdown/HTML
    genericModalConfirmBtn.textContent = confirmBtnText;

    if (showTextarea) {
        genericModalTextarea.style.display = 'block';
        genericModalTextarea.value = genericModalMessage.textContent; // Pre-fill with message
        genericModalMessage.style.display = 'none'; // Hide message if textarea is shown
    } else {
        genericModalTextarea.style.display = 'none';
        genericModalMessage.style.display = 'block';
    }

    // Clear previous event listeners
    genericModalConfirmBtn.onclick = null;
    genericModalCancelBtn.onclick = null;

    // Attach new event listeners
    genericModalConfirmBtn.onclick = () => {
        onConfirm(showTextarea ? genericModalTextarea.value : null);
        hideGenericModal();
    };
    genericModalCancelBtn.onclick = () => {
        if (onCancel) onCancel();
        hideGenericModal();
    };

    genericModal.style.display = 'block';
    document.body.classList.add('no-scroll');
}

function hideGenericModal() {
    const genericModal = document.getElementById('genericModal');
    genericModal.style.display = 'none';
    document.body.classList.remove('no-scroll');
}

function populateChatRoomList() {
    const chatRoomList = document.getElementById('chatRoomList');
    if (!chatRoomList) return;

    // Define rooms with translation keys
    const rooms = [
        { id: 'Global', nameKey: 'chat_room_global' },
        { id: 'Europe', nameKey: 'chat_room_europe' },
        { id: 'Asia', nameKey: 'chat_room_asia' },
        { id: 'North-America', nameKey: 'chat_room_north_america' },
        { id: 'South-America', nameKey: 'chat_room_south_america' },
        { id: 'Africa', nameKey: 'chat_room_africa' },
        { id: 'Oceania', nameKey: 'chat_room_oceania' }
    ];

    // Add country-specific room to the beginning of the list if it exists
    if (gameState.playerCountry && countries[gameState.playerCountry]) {
        const countryCode = gameState.playerCountry.toLowerCase();
        const translationKey = `country_${countryCode}`;
        rooms.unshift({ id: `country-${gameState.playerCountry}`, nameKey: translationKey });
    }

    chatRoomList.innerHTML = ''; // Clear existing list

    rooms.forEach(room => {
        const listItem = document.createElement('li');
        listItem.className = 'chat-room-list-item';
        
        // Use getTranslation for rooms with a nameKey, otherwise use the name directly
        if (room.nameKey) {
            listItem.textContent = getTranslation(room.nameKey);
        } else {
            listItem.textContent = room.name;
        }
        
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

function setupEmojiPicker() {
    const emojiPicker = document.getElementById('emojiPicker');
    const emojiBtn = document.getElementById('emojiBtn');
    const chatInput = document.getElementById('chatInput');
    const categoriesContainer = emojiPicker.querySelector('.emoji-categories');
    const emojiListContainer = emojiPicker.querySelector('.emoji-list-container');
    const leftArrow = emojiPicker.querySelector('.left-arrow');
    const rightArrow = emojiPicker.querySelector('.right-arrow');

    const categoryIcons = {
        smileys: '😊',
        people: '👋',
        animals: '🐶',
        food: '🍔',
        activities: '⚽️',
        travel: '🚗',
        objects: '💻',
        symbols: '❤️',
        flags: '🏁'
    };

    // Populate categories
    for (const category in EMOJI_CATEGORIES) {
        const categoryBtn = document.createElement('button');
        categoryBtn.className = 'emoji-category-btn';
        categoryBtn.dataset.category = category;
        categoryBtn.dataset.i18n = `emojiCategory_${category}`;
        categoryBtn.innerHTML = `<span class="emoji-category-icon">${categoryIcons[category] || '❓'}</span> <span class="emoji-category-name" data-i18n="emojiCategory_${category}">${category}</span>`;
        categoriesContainer.appendChild(categoryBtn);

        categoryBtn.addEventListener('click', () => {
            // Set active button
            const currentActive = categoriesContainer.querySelector('.active');
            if(currentActive) currentActive.classList.remove('active');
            categoryBtn.classList.add('active');
            // Populate emojis for the selected category
            populateEmojiList(category);
        });
    }

    function populateEmojiList(category) {
        emojiListContainer.innerHTML = '';
        EMOJI_CATEGORIES[category].forEach(emoji => {
            const emojiSpan = document.createElement('span');
            emojiSpan.textContent = emoji;
            emojiSpan.addEventListener('click', () => {
                chatInput.value += emoji;
                chatInput.focus();
            });
            emojiListContainer.appendChild(emojiSpan);
        });
    }

    // Arrow button logic
    function updateArrowVisibility() {
        const isScrollable = categoriesContainer.scrollWidth > categoriesContainer.clientWidth;
        if (!isScrollable) {
            leftArrow.classList.add('hidden');
            rightArrow.classList.add('hidden');
            return;
        }
        leftArrow.classList.toggle('hidden', categoriesContainer.scrollLeft === 0);
        rightArrow.classList.toggle('hidden', categoriesContainer.scrollLeft + categoriesContainer.clientWidth >= categoriesContainer.scrollWidth - 5); // 5px buffer
    }

    leftArrow.addEventListener('click', () => {
        categoriesContainer.scrollLeft -= 100;
        updateArrowVisibility();
    });

    rightArrow.addEventListener('click', () => {
        categoriesContainer.scrollLeft += 100;
        updateArrowVisibility();
    });

    categoriesContainer.addEventListener('scroll', updateArrowVisibility);
    new ResizeObserver(updateArrowVisibility).observe(categoriesContainer);


    // Toggle emoji picker
    emojiBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        emojiPicker.classList.toggle('show');
        if (emojiPicker.classList.contains('show')) {
            updateArrowVisibility();
        }
    });

    // Close picker when clicking outside
    document.addEventListener('click', (event) => {
        if (!emojiPicker.contains(event.target) && !emojiBtn.contains(event.target)) {
            emojiPicker.classList.remove('show');
        }
    });

    // Initial population
    const firstCategory = Object.keys(EMOJI_CATEGORIES)[0];
    categoriesContainer.querySelector('.emoji-category-btn').classList.add('active');
    populateEmojiList(firstCategory);
    updateArrowVisibility();
}

window.setupEmojiPicker = setupEmojiPicker;
EmojiPicker = setupEmojiPicker;
