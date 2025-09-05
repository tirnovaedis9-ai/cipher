// Function to fetch and render TOP PLAYERS leaderboard preview
async function fetchAndRenderLeaderboardPreview() {
    const container = document.getElementById('player-leaderboard-cards-container');
    if (!container) return;

    container.innerHTML = ''; // Clear existing content

    try {
        // Corrected API endpoint
        const topPlayers = await apiRequest('/api/scores/top-preview', 'GET');

        if (topPlayers.length === 0) {
            container.innerHTML = '<p style="color: #A0A0B0;">No players on the leaderboard yet.</p>';
            return;
        }

        topPlayers.slice(0, 3).forEach((player, index) => {
            const rank = index + 1;
            const card = document.createElement('div');
            card.className = `leaderboard-card rank-${rank}`;
            let rankContent = `<span class="rank">#${rank}</span>`;
            const levelClass = player.level > 0 ? ` level-${player.level}-border` : ' no-border';
            card.innerHTML = `
                ${rankContent}
                <span class="player-name-above-avatar">${player.name}</span>
                <img src="${player.avatarUrl || 'assets/logo.jpg'}" alt="${player.name}'s Avatar" class="leaderboard-preview-avatar${levelClass} clickable-avatar">
                <img src="assets/flags/${player.country.toLowerCase()}.png" alt="${getTranslation('country_' + player.country.toLowerCase())} Flag" class="flag-icon">
                <span class="score">${player.score.toLocaleString()}</span>
                <span class="game-mode">${player.mode}</span>
            `;
            container.appendChild(card);
        });
    } catch (error) {
        console.error('Failed to fetch top players preview:', error);
        container.innerHTML = '<p style="color: #A0A0B0;">Leaderboard could not be loaded.</p>';
    }
}

// Function to fetch and render BY COUNTRY leaderboard preview
async function fetchAndRenderCountryLeaderboardPreview() {
    const container = document.getElementById('country-leaderboard-cards-container');
    if (!container) return;

    container.innerHTML = ''; // Clear existing content

    try {
        const countryScores = await apiRequest('/api/scores/country', 'GET');

        if (countryScores.length === 0) {
            container.innerHTML = '<p style="color: #A0A0B0;">No country data available yet.</p>';
            return;
        }

        countryScores.slice(0, 3).forEach((country, index) => {
            const rank = index + 1;
            const card = document.createElement('div');
            card.className = `leaderboard-card rank-${rank}`;
            let rankContent = `<span class="rank">#${rank}</span>`;
            // Note: The country card structure is slightly different
            card.innerHTML = `
                ${rankContent}
                <span class="player-name-above-avatar">${getTranslation('country_' + country.countryCode.toLowerCase())}</span>
                <div class="country-flag-container">
                    <img src="assets/flags/${country.countryCode.toLowerCase()}.png" alt="${getTranslation('country_' + country.countryCode.toLowerCase())}" class="country-flag-large">
                </div>
                <span class="score">${parseInt(country.averageScore).toLocaleString()}</span>
            `;
            container.appendChild(card);
        });
    } catch (error) {
        console.error('Failed to fetch country leaderboard preview:', error);
        container.innerHTML = '<p style="color: #A0A0B0;">Leaderboard could not be loaded.</p>';
    }
}

function initializeLeaderboardPreviews() {
    fetchAndRenderLeaderboardPreview();
    fetchAndRenderCountryLeaderboardPreview();
}

window.initializeLeaderboardPreviews = initializeLeaderboardPreviews;

document.addEventListener('DOMContentLoaded', () => {
    // Use querySelectorAll to handle multiple buttons
    const viewFullLeaderboardBtns = document.querySelectorAll('.view-full-leaderboard-btn');
    
    if (viewFullLeaderboardBtns.length > 0) {
        viewFullLeaderboardBtns.forEach(btn => {
            // The showLeaderboard function is likely in ui.js or main.js and attached to window
            btn.addEventListener('click', () => {
                if (window.showLeaderboard) {
                    window.showLeaderboard();
                } else {
                    console.warn('showLeaderboard function not found');
                }
            });
        });
    }
});

document.addEventListener('languageChanged', initializeLeaderboardPreviews);