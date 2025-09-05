function isMobile() {
    return window.innerWidth <= 768; // Adjust breakpoint as needed
}

async function showLeaderboard() {
    // Hide the game result overlay which might be capturing mouse events.
    const gameResultOverlay = document.getElementById('gameResultOverlay');
    if (gameResultOverlay) {
        gameResultOverlay.style.display = 'none';
        // Also remove classes just in case they have lingering visual effects
        gameResultOverlay.classList.remove('win-active', 'lose-active');
    }

    // Find the game container and hide its scrollbar to prevent nested scrolling issues.
    const gameContainer = document.querySelector('#gameModal .game-container');
    if (gameContainer) {
        gameContainer.style.overflowY = 'hidden';
    }

    showScreen('leaderboardScreen');
    
    // Add event listeners for tab buttons using event delegation
    const leaderboardTabs = document.querySelector('#leaderboardScreen .leaderboard-tabs');
    if (leaderboardTabs) {
        // Use a persistent listener if it might be called multiple times
        if (!leaderboardTabs.hasAttribute('data-listener-added')) {
            leaderboardTabs.addEventListener('click', (event) => {
                const clickedBtn = event.target.closest('.tab-btn');
                if (clickedBtn) {
                    const tabType = clickedBtn.dataset.tabType;
                    showLeaderboardTab(tabType);
                }
            });
            leaderboardTabs.setAttribute('data-listener-added', 'true');
        }
    }
    await showLeaderboardTab('country');
}

async function showLeaderboardTab(tabType) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.tabType === tabType) {
            btn.classList.add('active');
        }
    });

    const leaderboardList = document.getElementById('leaderboardList');
    leaderboardList.classList.add('loading');

    try {
        if (tabType === 'country') {
            await showCountryLeaderboard();
        } else {
            await showIndividualLeaderboard();
        }
    } catch (error) {
        leaderboardList.innerHTML = '<div class="error">Could not load leaderboard.</div>';
    }
}

async function showCountryLeaderboard() {
    const leaderboardList = document.getElementById('leaderboardList');
    const data = await apiRequest('/api/leaderboard/country');
    if (window.IS_DEVELOPMENT) {
        console.log('Country Leaderboard Data:', data);
    }
    leaderboardList.innerHTML = '';

    if (data.length === 0) {
        leaderboardList.innerHTML = '<div class="no-data">No country data yet. Be the first to play!</div>';
        return;
    }

    data.forEach((entry, index) => {
        const flagPath = entry.flag;
        let countryDisplayName = getTranslation('country_' + entry.countryCode.toLowerCase());
        if (isMobile() && countryDisplayName.length > 9) {
            countryDisplayName = countryDisplayName.substring(0, 9) + '...';
        }
        const item = document.createElement('div');
        
        let rankClass = 'leaderboard-item country-item';
        if (index === 0) rankClass += ' rank-1';
        else if (index === 1) rankClass += ' rank-2';
        else if (index === 2) rankClass += ' rank-3';
        item.className = rankClass;

        item.innerHTML = `
            <div class="leaderboard-left-group">
                <div class="leaderboard-rank">#${index + 1}</div>
                <div class="leaderboard-info">
                    <span class="country-flag"><img src="${flagPath}" alt="${countryDisplayName} Flag" class="flag-icon"></span>
                    <span class="leaderboard-name">${countryDisplayName}</span>
                    <span class="leaderboard-player-count">(${entry.playerCount} ${getTranslation('leaderboard_players')})</span>
                </div>
            </div>
            <div class="leaderboard-score">${entry.averageScore} ${getTranslation('leaderboard_pts')}</div>
        `;
        leaderboardList.appendChild(item);
    });
}

async function showIndividualLeaderboard() {
    const leaderboardList = document.getElementById('leaderboardList');
    const data = await apiRequest('/api/leaderboard/individual');
    if (window.IS_DEVELOPMENT) {
        console.log('Individual Leaderboard Data:', data);
    }
    leaderboardList.innerHTML = '';

    if (data.length === 0) {
        leaderboardList.innerHTML = '<div class="no-data">No scores yet. Be the first to play!</div>';
        return;
    }

    data.forEach((score, index) => {
        if (window.IS_DEVELOPMENT) {
            console.log(`Leaderboard player: ${score.name}, Level: ${score.level}`);
        }
        const countryCode = score.country;
        const flagPath = countries[countryCode] ? countries[countryCode].flag : '';
        let countryDisplayName = getTranslation('country_' + countryCode.toLowerCase());
        if (isMobile() && countryDisplayName.length > 9) {
            countryDisplayName = countryDisplayName.substring(0, 9) + '...';
        }
        const item = document.createElement('div');
        let rankClass = 'leaderboard-item';
        if (index === 0) rankClass += ' rank-1';
        else if (index === 1) rankClass += ' rank-2';
        else if (index === 2) rankClass += ' rank-3';
        item.className = rankClass;
        // Set the playerId from the consistent 'playerid' key from the API
        item.dataset.playerId = score.playerid;

        const levelClass = score.level > 0 ? ` level-${score.level}-border` : ' no-border';

        item.innerHTML = `
            <div class="leaderboard-left-group">
                <div class="leaderboard-rank">#${index + 1}</div>
                <div class="leaderboard-info">
                    <img src="${score.avatarUrl || 'assets/logo.jpg'}" alt="Avatar" class="leaderboard-avatar${levelClass} clickable-avatar">
                    <img src="${flagPath}" alt="${countryDisplayName} Flag" class="flag-icon">
                    <span class="leaderboard-name">${isMobile() && score.name.length > 9 ? score.name.substring(0, 9) + '...' : score.name}</span>
                    <span class="leaderboard-mode">(${score.mode})</span>
                </div>
            </div>
            <div class="leaderboard-score">${score.score} ${getTranslation('leaderboard_pts')}</div>
        `;
        leaderboardList.appendChild(item);
    });

    // Add event listener for delegation, ensuring it's only added once
    if (!leaderboardList.hasAttribute('data-click-listener-added')) {
        leaderboardList.addEventListener('click', (event) => {
            const clickedItem = event.target.closest('.leaderboard-item');
            // Check if the actual clicked element or its closest ancestor is the clickable-avatar
            const isAvatarClick = event.target.closest('.clickable-avatar');

            // If an avatar was clicked, we don't want to open the profile modal.
            // The image-modal.js will handle opening the image.
            if (isAvatarClick) {
                return;
            }

            if (clickedItem && clickedItem.dataset.playerId) {
                showPlayerProfile(clickedItem.dataset.playerId);
            }
        });
        leaderboardList.setAttribute('data-click-listener-added', 'true');
    }
}