async function showLeaderboard() {
    showScreen('leaderboardScreen');
    // Add event listeners for tab buttons using event delegation
    const leaderboardTabs = document.querySelector('#leaderboardScreen .leaderboard-tabs');
    if (leaderboardTabs) {
        leaderboardTabs.addEventListener('click', (event) => {
            const clickedBtn = event.target.closest('.tab-btn');
            if (clickedBtn) {
                const tabType = clickedBtn.dataset.tabType;
                showLeaderboardTab(tabType);
            }
        });
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
    console.log('Country Leaderboard Data:', data); // Added log
    leaderboardList.innerHTML = '';

    if (data.length === 0) {
        leaderboardList.innerHTML = '<div class="no-data">No country data yet. Be the first to play!</div>';
        return;
    }

    data.forEach((entry, index) => {
        const flagPath = entry.flag;
        const countryDisplayName = entry.countryName;
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
                    <span class="leaderboard-player-count">(${entry.playerCount} players)</span>
                </div>
            </div>
            <div class="leaderboard-score">${entry.averageScore} pts</div>
        `;
        leaderboardList.appendChild(item);
    });
}

async function showIndividualLeaderboard() {
    const leaderboardList = document.getElementById('leaderboardList');
    const data = await apiRequest('/api/leaderboard/individual');
    console.log('Individual Leaderboard Data:', data); // Added log
    leaderboardList.innerHTML = '';

    if (data.length === 0) {
        leaderboardList.innerHTML = '<div class="no-data">No scores yet. Be the first to play!</div>';
        return;
    }

    data.forEach((score, index) => {
        console.log(`Leaderboard player: ${score.name}, Level: ${score.level}`);
        const countryCode = score.country;
        const flagPath = countries[countryCode] ? countries[countryCode].flag : '';
        const countryDisplayName = countries[countryCode] ? countries[countryCode].name : score.country;
        const item = document.createElement('div');
        let rankClass = 'leaderboard-item';
        if (index === 0) rankClass += ' rank-1';
        else if (index === 1) rankClass += ' rank-2';
        else if (index === 2) rankClass += ' rank-3';
        item.className = rankClass;
        // Set the playerId from the consistent 'playerid' key from the API
        item.dataset.playerId = score.playerid;

        item.innerHTML = `
            <div class="leaderboard-left-group">
                <div class="leaderboard-rank">#${index + 1}</div>
                <div class="leaderboard-info">
                    <img src="${score.avatarUrl || 'assets/logo.jpg'}" alt="Avatar" class="leaderboard-avatar level-${score.level}-border">
                    <img src="${flagPath}" alt="${countryDisplayName} Flag" class="flag-icon">
                    <span class="leaderboard-name">${score.name}</span>
                    <span class="leaderboard-mode">(${score.mode})</span>
                </div>
            </div>
            <div class="leaderboard-score">${score.score} pts</div>
        `;
        leaderboardList.appendChild(item);
    });

    // Add event listener for delegation
    leaderboardList.addEventListener('click', (event) => {
        const clickedItem = event.target.closest('.leaderboard-item');
        if (clickedItem && clickedItem.dataset.playerId) {
            showPlayerProfile(clickedItem.dataset.playerId);
        }
    });
}
