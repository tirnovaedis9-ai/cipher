function toggleTheme() {
    const body = document.body;
    body.classList.toggle('purple-theme');
    if (body.classList.contains('purple-theme')) {
        localStorage.setItem('adminTheme', 'purple');
    } else {
        localStorage.setItem('adminTheme', 'blue');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Initialize language first
    initializeLanguage().then(() => {
        // After translations are loaded, set up the rest of the admin panel
        setupAdminPanel();
        initializeAdminLanguageSwitcher(); // Add this call
    });
});

function updateAdminFlag(lang) {
    const currentFlag = document.getElementById('currentFlagAdmin');
    if (!currentFlag) return;

    // Find the language option to get the correct flag source
    const option = document.querySelector(`.language-option[data-lang='${lang}']`);
    if (option) {
        const flagSrc = option.querySelector('img').src;
        const flagAlt = option.querySelector('img').alt;
        currentFlag.src = flagSrc;
        currentFlag.alt = flagAlt;
    }
}

function initializeAdminLanguageSwitcher() {
    const languageBtn = document.getElementById('languageBtnAdmin');
    const languageDropdown = document.getElementById('languageDropdownAdmin');

    if (!languageBtn || !languageDropdown) return;

    // Set initial flag
    const savedLanguage = localStorage.getItem('selectedLanguage') || 'en';
    updateAdminFlag(savedLanguage);

    languageBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        languageDropdown.classList.toggle('show');
    });

    document.addEventListener('click', (event) => {
        if (!languageDropdown.contains(event.target) && !languageBtn.contains(event.target)) {
            languageDropdown.classList.remove('show');
        }
    });

    languageDropdown.querySelectorAll('.language-option').forEach(option => {
        option.addEventListener('click', (event) => {
            event.preventDefault();
            const newLang = option.getAttribute('data-lang');
            localStorage.setItem('selectedLanguage', newLang);
            window.location.reload(); // Reload the page to apply the new language
        });
    });
}

function setupAdminPanel() {
    const adminLoginSection = document.getElementById('adminLoginSection');
    const adminDashboard = document.getElementById('adminDashboard');
    const adminLoginBtn = document.getElementById('adminLoginBtn');
    const adminLogoutBtn = document.getElementById('adminLogoutBtn');
    const editUserModal = document.getElementById('editUserModal');
    const closeButton = document.querySelector('.close-button');
    const saveUserChangesBtn = document.getElementById('saveUserChangesBtn');
    const adminUsernameInput = document.getElementById('adminUsername');
    const adminPasswordInput = document.getElementById('adminPassword');
    const sortUsersDropdown = document.getElementById('sortUsers');

    const checkAdminLogin = () => {
        const token = localStorage.getItem('adminToken');
        if (token) {
            adminLoginSection.style.display = 'none';
            adminDashboard.style.display = 'flex';
            loadUsers(); // Load with default sort
            loadStats();
        } else {
            adminLoginSection.style.display = 'block';
            adminDashboard.style.display = 'none';
            adminUsernameInput.focus(); // Automatically focus the username field
        }
    };

    sortUsersDropdown.addEventListener('change', () => {
        loadUsers(sortUsersDropdown.value);
    });

    const handleLogin = async () => {
        const username = adminUsernameInput.value;
        const password = adminPasswordInput.value;
        try {
            const response = await fetch('/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await response.json();
            if (response.ok) {
                localStorage.setItem('adminToken', data.token);
                checkAdminLogin();
            } else {
                alert(data.message || getTranslation('adminLoginFailed'));
            }
        } catch (error) {
            alert(getTranslation('errorOccurred'));
        }
    };

    adminLoginBtn.addEventListener('click', handleLogin);

    adminUsernameInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault(); // Prevent form submission
            adminPasswordInput.focus();
        }
    });

    adminPasswordInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            handleLogin();
        }
    });

    adminLogoutBtn.addEventListener('click', () => {
        localStorage.removeItem('adminToken');
        checkAdminLogin();
    });

    document.getElementById('showUsersBtn').addEventListener('click', () => showSection('usersSection'));
    document.getElementById('showSettingsBtn').addEventListener('click', () => {
        showSection('settingsSection');
        loadSettings();
        loadChatRooms();
    });
    document.getElementById('showStatsBtn').addEventListener('click', () => showSection('statsSection'));

    closeButton.addEventListener('click', () => {
        editUserModal.style.display = 'none';
    });

    saveUserChangesBtn.addEventListener('click', saveUserChanges);

    document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);

    document.getElementById('clearChatBtn').addEventListener('click', clearChatHistory);

    document.getElementById('clearRoomBtn').addEventListener('click', clearRoomHistory);

    checkAdminLogin();
}

async function loadUsers(sortOption = 'createdAt_desc') {
    const token = localStorage.getItem('adminToken');
    const [sortBy, order] = sortOption.split('_');

    try {
        const response = await fetch(`/api/admin/users?sortBy=${sortBy}&order=${order}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const users = await response.json();
        const usersTableBody = document.querySelector('#usersTable tbody');
        usersTableBody.innerHTML = '';
        users.forEach(user => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${user.id}</td>
                <td class="user-cell"><img src="${user.avatarurl || 'assets/logo.jpg'}" class="user-avatar"> ${user.username}</td>
                <td>${user.country}</td>
                <td>${user.createdat ? user.createdat.substring(0, 10) : 'N/A'}</td>
                <td>
                    <input type="number" class="game-count-input" data-id="${user.id}" value="${user.gamecount || 0}" min="0">
                </td>
                <td>
                    <button class="btn btn-sm btn-primary update-game-count-btn" data-id="${user.id}">${getTranslation('update')}</button>
                    <button class="btn btn-sm btn-secondary reset-game-count-btn" data-id="${user.id}">${getTranslation('reset')}</button>
                </td>
                <td>
                    <button class="btn btn-sm btn-primary edit-btn" data-id="${user.id}">${getTranslation('edit')}</button>
                    <button class="btn btn-sm btn-danger delete-btn" data-id="${user.id}">${getTranslation('delete')}</button>
                </td>
            `;
            usersTableBody.appendChild(row);
        });

        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => openEditModal(e.target.dataset.id));
        });
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => deleteUser(e.target.dataset.id));
        });
        document.querySelectorAll('.update-game-count-btn').forEach(btn => {
            btn.addEventListener('click', (e) => updateGameCount(e.target.dataset.id));
        });
        document.querySelectorAll('.reset-game-count-btn').forEach(btn => {
            btn.addEventListener('click', (e) => resetGameCount(e.target.dataset.id));
        });
    } catch (error) {
        console.error('Failed to load users:', error);
    }
}

async function loadChatRooms() {
    const token = localStorage.getItem('adminToken');
    try {
        const response = await fetch('/api/chat/rooms', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const rooms = await response.json();
        const select = document.getElementById('chatRoomSelect');
        select.innerHTML = '';
        rooms.forEach(room => {
            const option = document.createElement('option');
            option.value = room;
            option.textContent = room;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Failed to load chat rooms:', error);
    }
}

async function loadStats() {
    const token = localStorage.getItem('adminToken');
    try {
        const response = await fetch('/api/admin/stats', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const stats = await response.json();
        document.getElementById('totalPlayersStat').textContent = stats.totalPlayers;
        document.getElementById('totalGamesPlayedStat').textContent = stats.totalGamesPlayed;
        document.getElementById('averageScoreStat').textContent = stats.averageScore ? stats.averageScore.toFixed(2) : '0.00';
    } catch (error) {
        console.error('Failed to load stats:', error);
    }
}

function showSection(sectionId) {
    document.querySelectorAll('.admin-section').forEach(section => {
        section.style.display = 'none';
    });
    document.getElementById(sectionId).style.display = 'block';
}

async function openEditModal(userId) {
    const token = localStorage.getItem('adminToken');
    try {
        const response = await fetch(`/api/admin/users/${userId}`, { 
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const user = await response.json();
        document.getElementById('editUserId').value = user.id;
        document.getElementById('editUsername').value = user.username;
        document.getElementById('editCountry').value = user.country;
        document.getElementById('editAvatarUrl').value = user.avatarurl;
        document.getElementById('editUserModal').style.display = 'block';
    } catch (error) {
        console.error('Failed to fetch user data:', error);
    }
}

async function saveUserChanges() {
    const token = localStorage.getItem('adminToken');
    const userId = document.getElementById('editUserId').value;
    const userData = {
        username: document.getElementById('editUsername').value,
        country: document.getElementById('editCountry').value,
        avatarUrl: document.getElementById('editAvatarUrl').value
    };

    try {
        const response = await fetch(`/api/admin/users/${userId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(userData)
        });
        if (response.ok) {
            document.getElementById('editUserModal').style.display = 'none';
            loadUsers();
        } else {
            const data = await response.json();
            alert(data.message || getTranslation('updateFailed'));
        }
    } catch (error) {
        alert(getTranslation('errorOccurred'));
    }
}

async function deleteUser(userId) {
    const token = localStorage.getItem('adminToken');
    if (confirm(getTranslation('confirmDeleteUser'))) {
        try {
            const response = await fetch(`/api/admin/users/${userId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                loadUsers();
            } else {
                const data = await response.json();
                alert(data.message || getTranslation('deleteFailed'));
            }
        } catch (error) {
            alert(getTranslation('errorOccurred'));
        }
    }
}

async function updateGameCount(userId) {
    const token = localStorage.getItem('adminToken');
    const inputElement = document.querySelector(`.game-count-input[data-id="${userId}"]`);
    const targetGameCount = parseInt(inputElement.value, 10);

    if (isNaN(targetGameCount) || targetGameCount < 0) {
        showNotification('Invalid game count. Please enter a non-negative number.', 'error');
        return;
    }

    try {
        const response = await fetch(`/api/admin/player/${userId}/gamecount`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ targetGameCount })
        });
        const data = await response.json();
        if (response.ok) {
            showNotification(data.message, 'success');
            loadUsers(); // Reload users to reflect changes
        } else {
            showNotification(data.message || 'Failed to update game count.', 'error');
        }
    } catch (error) {
        console.error('Failed to update game count:', error);
        showNotification('An error occurred while updating game count.', 'error');
    }
}

async function resetGameCount(userId) {
    const token = localStorage.getItem('adminToken');
    if (confirm("Are you sure you want to reset this user's game count? This will remove all dummy games.")) {
        try {
            const response = await fetch(`/api/admin/player/${userId}/gamecount/reset`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (response.ok) {
                showNotification(data.message, 'success');
                loadUsers(); // Reload users to reflect changes
            } else {
                showNotification(data.message || 'Failed to reset game count.', 'error');
            }
        } catch (error) {
            console.error('Failed to reset game count:', error);
            showNotification('An error occurred while resetting game count.', 'error');
        }
    }
}

async function loadSettings() {
    const token = localStorage.getItem('adminToken');
    try {
        const response = await fetch('/api/admin/settings', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const settings = await response.json();
        document.getElementById('siteTitleInput').value = settings.siteTitle || '';
        document.getElementById('welcomeMessageInput').value = settings.welcomeMessage || '';
    } catch (error) {
        console.error('Failed to load settings:', error);
    }
}

async function saveSettings() {
    const token = localStorage.getItem('adminToken');
    const settings = {
        siteTitle: document.getElementById('siteTitleInput').value,
        welcomeMessage: document.getElementById('welcomeMessageInput').value
    };

    try {
        for (const key in settings) {
            await fetch(`/api/admin/settings/${key}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ value: settings[key] })
            });
        }
        showNotification('Settings saved successfully!', 'success');
    } catch (error) {
        showNotification('Failed to save settings.', 'error');
    }
}

function showNotification(message, type) {
    const notificationBar = document.getElementById('notificationBar');
    notificationBar.textContent = message;
    notificationBar.className = `notification-bar show ${type}`;
    setTimeout(() => {
        notificationBar.className = 'notification-bar';
    }, 3000);
}

async function clearChatHistory() {
    const token = localStorage.getItem('adminToken');
    if (confirm(getTranslation('confirmClearChat'))) {
        try {
            const response = await fetch('/api/admin/chat/messages', {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (response.ok) {
                showNotification(data.message, 'success');
            } else {
                showNotification(data.message || 'Failed to clear chat history.', 'error');
            }
        } catch (error) {
            console.error('Failed to clear chat history:', error);
            showNotification('An error occurred while clearing chat history.', 'error');
        }
    }
}

async function clearRoomHistory() {
    const token = localStorage.getItem('adminToken');
    const room = document.getElementById('chatRoomSelect').value;
    if (!room) {
        showNotification('Please select a room to clear.', 'error');
        return;
    }
    if (confirm(getTranslation('confirmClearRoomChat', { room }))) {
        try {
            const response = await fetch(`/api/admin/chat/messages/${encodeURIComponent(room)}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (response.ok) {
                showNotification(data.message, 'success');
            } else {
                showNotification(data.message || `Failed to clear chat history for room ${room}.`, 'error');
            }
        } catch (error) {
            console.error(`Failed to clear chat history for room ${room}:`, error);
            showNotification(`An error occurred while clearing chat history for room ${room}.`, 'error');
        }
    }
}
