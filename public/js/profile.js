let currentProfilePage = 1;
const scoresPerPage = 10;
let isLoadingScores = false;
let currentProfilePlayerId = null;

async function showPlayerProfile(playerId) {
    if (window.IS_DEVELOPMENT) {
        console.log('showPlayerProfile called with playerId:', playerId);
    }
    const modal = document.getElementById('playerProfileModal');
    const content = document.getElementById('playerProfileContent');
    const nameTitle = document.getElementById('profileModalPlayerName');

    modal.style.display = 'block';
    content.innerHTML = '<div class="loading">Loading profile...</div>';
    nameTitle.textContent = 'Player Profile';

    currentProfilePlayerId = playerId; // Store the current player ID
    currentProfilePage = 1; // Reset the page number

    try {
        if (window.IS_DEVELOPMENT) {
            console.log('Attempting to fetch player data for playerId:', playerId);
        }
        const playerData = await apiRequest(`/api/profile/players/${playerId}`);
        if (window.IS_DEVELOPMENT) {
            console.log('Player data fetched successfully:', playerData);
        }
        displayProfileData(playerData);
        await loadMoreScores(); // Load the first page of scores
    } catch (error) {
        console.error('Failed to load player profile:', error);
        content.innerHTML = '<div class="error">Could not load player profile.</div>';
    }
}

function displayProfileData(data) {
    const content = document.getElementById('playerProfileContent');
    const nameTitle = document.getElementById('profileModalPlayerName');

    nameTitle.textContent = '';

    const levelClass = data.level > 0 ? ` level-${data.level}-border` : ' no-border';

    content.innerHTML = `
        <div class="profile-header">
            <div class="profile-avatar-small-wrapper">
                <img src="${data.avatarurl || 'assets/logo.jpg'}" alt="Player Avatar" class="profile-avatar-small${levelClass} clickable-avatar">
            </div>
            <h2 class="profile-name">${data.username}</h2>
            <span class="profile-flag"><img src="${countries[data.country]?.flag || ''}" alt="${countries[data.country]?.name || 'Unknown'} Flag" class="flag-icon"></span>
        </div>
        <div class="profile-stats">
            <div class="profile-stat-item">
                <h4>${getTranslation('highestScore')}</h4>
                <p>${data.highestscore}</p>
            </div>
            <div class="profile-stat-item">
                <h4>${getTranslation('gamesPlayed')}</h4>
                <p>${data.gamecount}</p>
            </div>
            <div class="profile-stat-item">
                <h4>${getTranslation('level')}</h4>
                <p>${data.level}</p>
            </div>
            <div class="profile-stat-item">
                <h4>${getTranslation('memberSince')}</h4>
                <p>${new Date(data.createdat).toLocaleDateString()}</p>
            </div>
        </div>
        <div class="profile-recent-games">
            <h3>${getTranslation('recentGames')}</h3>
            <div class="profile-games-list" id="profileGamesList">
                <div class="loading">Loading games...</div>
            </div>
            <button id="loadMoreScoresBtn" class="load-more-icon-btn" style="display:none;" title="${getTranslation('loadMore')}"><i class="fas fa-chevron-down"></i></button>
        </div>
    `;

    const loadMoreBtn = document.getElementById('loadMoreScoresBtn');
    loadMoreBtn.onclick = loadMoreScores;

    const profileGamesList = document.getElementById('profileGamesList');
    if (profileGamesList) {
        profileGamesList.addEventListener('wheel', (e) => {
            e.stopPropagation();
        });
    }
}

async function loadMoreScores() {
    if (isLoadingScores) return;
    isLoadingScores = true;

    const loadMoreBtn = document.getElementById('loadMoreScoresBtn');
    const gamesList = document.getElementById('profileGamesList');
    const loadingIndicator = gamesList.querySelector('.loading');

    if (loadMoreBtn) loadMoreBtn.disabled = true;
    if (loadingIndicator) loadingIndicator.style.display = 'block';

    try {
        const scores = await apiRequest(`/api/profile/players/${currentProfilePlayerId}/scores?page=${currentProfilePage}&limit=${scoresPerPage}`);
        
        if (loadingIndicator) loadingIndicator.remove();

        if (scores.length > 0) {
            const scoresHTML = scores.map(score => `
                <div class="profile-game-item">
                    <div>
                        <div class="profile-game-mode">${score.mode}</div>
                        <div class="profile-game-date">${new Date(score.timestamp).toLocaleDateString()}</div>
                    </div>
                    <div class="profile-game-score">${score.score} pts</div>
                </div>
            `).join('');
            gamesList.innerHTML += scoresHTML;
            currentProfilePage++;
        }

        if (scores.length < scoresPerPage) {
            if (loadMoreBtn) loadMoreBtn.style.display = 'none';
            if (gamesList.children.length === 0) {
                 gamesList.innerHTML = '<div class="no-data">No recent games found.</div>';
            }
        } else {
            if (loadMoreBtn) loadMoreBtn.style.display = 'block';
        }

    } catch (error) {
        console.error('Failed to load more scores:', error);
        if (loadingIndicator) loadingIndicator.remove();
        gamesList.innerHTML = '<div class="error">Could not load games.</div>';
    } finally {
        isLoadingScores = false;
        if (loadMoreBtn) loadMoreBtn.disabled = false;
    }
}

async function updateUsername() {
    const newUsername = document.getElementById('newUsernameInput').value;
    if (!newUsername) {
        showNotification('Username cannot be empty.', 'error');
        return;
    }
    if (newUsername === gameState.username) {
        showNotification('New username is the same as current username.', 'info');
        return;
    }
    try {
        const response = await apiRequest('/api/profile/username', 'PUT', { newUsername });
        gameState.username = newUsername;
        localStorage.setItem('username', newUsername);
        updateProfileDisplay(gameState.level);
        showNotification(response.message || 'Username updated successfully!', 'success');
    } catch (error) {
        console.error('Failed to update username:', error);
        showNotification(`Failed to update username: ${error.message}`, 'error');
    }
}

async function updatePassword() {
    const currentPassword = document.getElementById('currentPasswordInput').value;
    const newPassword = document.getElementById('newPasswordInput').value;
    const confirmPassword = document.getElementById('confirmPasswordInput').value;

    if (!currentPassword || !newPassword || !confirmPassword) {
        showNotification('Please fill in all password fields.', 'error');
        return;
    }
    if (newPassword !== confirmPassword) {
        showNotification('New password and confirmation do not match.', 'error');
        return;
    }
    if (newPassword.length < 6) {
        showNotification('New password must be at least 6 characters long.', 'error');
        return;
    }

    try {
        const response = await apiRequest('/api/profile/password', 'PUT', { currentPassword, newPassword });
        showNotification(response.message || 'Password updated successfully!', 'success');
        document.getElementById('currentPasswordInput').value = '';
        document.getElementById('newPasswordInput').value = '';
        document.getElementById('confirmPasswordInput').value = '';
    } catch (error) {
        console.error('Failed to update password:', error);
        showNotification(`Failed to update password: ${error.message}`, 'error');
    }
}

async function processAndUploadAvatar(event) {
    const file = event.target.files[0];
    if (!file) {
        return;
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
        showNotification('Invalid file type. Please select a JPG, PNG, or GIF.', 'error');
        return;
    }
    if (file.size > 5 * 1024 * 1024) {
        showNotification('File is too large. Maximum size is 5MB.', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('imageToCrop').src = e.target.result;
        document.getElementById('imageCropperModal').style.display = 'block';
        setupCropper();
    };
    reader.onerror = () => {
        showNotification(getTranslation('couldNotReadFile'), 'error');
    };
    reader.readAsDataURL(file);
}

function setupCropper() {
    const image = document.getElementById('imageToCrop');
    if (cropper) {
        cropper.destroy();
    }
    cropper = new Cropper(image, {
        aspectRatio: 1,
        viewMode: 1,
        dragMode: 'move',
        autoCropArea: 0.8,
        responsive: true,
        restore: false,
        guides: false,
        center: true,
        highlight: false,
        cropBoxMovable: false,
        cropBoxResizable: false,
        toggleDragModeOnDblclick: false,
    });
}

async function updateAvatar(blob) {
    const formData = new FormData();
    formData.append('avatar', blob, 'avatar.jpg');

    try {
        const data = await apiUploadRequest('/api/profile/avatar', formData);
        
        gameState.avatarUrl = data.avatarUrl;
        localStorage.setItem('avatarUrl', data.avatarUrl);
        document.getElementById('profileAvatarPreview').src = data.avatarUrl;
        updateProfileDisplay(gameState.level);

        // Notify the chat server about the avatar update
        if (socket && socket.connected) {
            socket.emit('avatarUpdated', { avatarUrl: data.avatarUrl });
        }

        showNotification(data.message || 'Avatar updated successfully!', 'success');

    } catch (error) {
        // The error is already logged and displayed by apiUploadRequest
        // You can add specific UI updates here if needed, e.g., resetting an input field
    }
}

function closePlayerProfileModal() {
    document.getElementById('playerProfileModal').style.display = 'none';
    showScreen('leaderboardScreen'); // Explicitly go back to leaderboard screen
}

async function populateMyProfileData() {
    try {
        // Fetch the latest, most comprehensive profile data
        const profileData = await apiRequest(`/api/profile/players/${gameState.playerId}`);

        // Update avatar
        const avatarPreview = document.getElementById('profileAvatarPreview');
        avatarPreview.src = profileData.avatarurl || 'assets/logo.jpg';
        avatarPreview.classList.add('clickable-avatar'); // Make avatar clickable
        if (profileData.level > 0) {
            avatarPreview.className = `profile-avatar-preview level-${profileData.level}-border`;
        } else {
            avatarPreview.className = 'profile-avatar-preview no-border';
        }

        // Update username input
        document.getElementById('newUsernameInput').value = profileData.username;

        // Populate the new stats fields
        document.getElementById('myProfileLevel').textContent = profileData.level;
        document.getElementById('myProfileGamesPlayed').textContent = profileData.gamecount;
        document.getElementById('myProfileHighestScore').textContent = profileData.highestscore;
        document.getElementById('myProfileMemberSince').textContent = new Date(profileData.createdat).toLocaleDateString();

        // Store gamecount in gameState for global access
        gameState.gamecount = profileData.gamecount;

    } catch (error) {
        console.error('Failed to populate profile data:', error);
        showNotification('Could not load your profile data. Please try again.', 'error');
    }
}

function closeImageCropper() {
    const modal = document.getElementById('imageCropperModal');

    if (modal) {
        modal.style.display = 'none';
    }

    if (cropper) {
        cropper.destroy();
        cropper = null;
    }
}

window.closeImageCropper = closeImageCropper;

document.addEventListener('languageChanged', () => {
    const modal = document.getElementById('playerProfileModal');
    if (modal && modal.style.display === 'block' && currentProfilePlayerId) {
        // If a profile modal is open, refresh it to update translations
        showPlayerProfile(currentProfilePlayerId);
    }
});
