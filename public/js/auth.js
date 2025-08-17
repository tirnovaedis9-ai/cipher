async function registerUser() {
    const username = document.getElementById('usernameInputRegister').value;
    const password = document.getElementById('passwordInputRegister').value;
    const country = document.getElementById('playerCountrySelect').value;

    if (!username || !password || !country) {
        showNotification(getTranslation('fillAllFields'), 'error');
        return;
    }

    try {
        const data = await apiRequest('/api/auth/register', 'POST', { username, password, country });
        
        // After registration, fetch the full profile to get the level
        const profileData = await apiRequest(`/api/profile/players/${data.playerId}`);

        localStorage.setItem('token', data.token);
        localStorage.setItem('playerId', data.playerId);
        localStorage.setItem('username', profileData.username);
        localStorage.setItem('playerCountry', profileData.country);
        localStorage.setItem('avatarUrl', profileData.avatarUrl);
        localStorage.setItem('level', profileData.level);

        Object.assign(gameState, { ...profileData, isLoggedIn: true, token: data.token, playerCountry: profileData.country });

        updateProfileDisplay(gameState.level);
        closePlayerInfoModal();
        document.getElementById('gameModal').style.display = 'block';
        showScreen('mainMenu');
        showNotification(getTranslation('registrationSuccess'), 'success');
        connectChat();
    } catch (error) {
        console.error('Registration failed:', error);
        showNotification(`${getTranslation('registrationFailed')}: ${error.message}`, 'error');
    }
}

async function loginUser() {
    const username = document.getElementById('usernameInput').value;
    const password = document.getElementById('passwordInput').value;

    if (!username || !password) {
        showNotification(getTranslation('enterUsernamePassword'), 'error');
        return;
    }

    try {
        const data = await apiRequest('/api/auth/login', 'POST', { username, password });

        // After login, fetch the full profile to get the level
        const profileData = await apiRequest(`/api/profile/players/${data.playerId}`);

        localStorage.setItem('token', data.token);
        localStorage.setItem('playerId', data.playerId);
        localStorage.setItem('username', profileData.username);
        localStorage.setItem('playerCountry', profileData.country);
        localStorage.setItem('avatarUrl', profileData.avatarUrl);
        localStorage.setItem('level', profileData.level);

        Object.assign(gameState, { ...profileData, isLoggedIn: true, token: data.token, playerCountry: profileData.country });

        updateProfileDisplay(gameState.level);
        closePlayerInfoModal();
        document.getElementById('gameModal').style.display = 'block';
        showScreen('mainMenu');
        showNotification(getTranslation('loginSuccess'), 'success');
        connectChat();
    } catch (error) {
        console.error('Login failed:', error);
        showNotification(`${getTranslation('loginFailed')}: ${error.message}`, 'error');
    }
}

function logoutUser() {
    localStorage.clear(); // Clear all user data

    Object.assign(gameState, {
        token: null,
        playerId: null,
        username: '',
        playerCountry: '',
        avatarUrl: null,
        isLoggedIn: false,
        level: 1
    });

    if (socket) {
        socket.disconnect();
    }

    updateProfileDisplay();
    showNotification(getTranslation('loggedOut'), 'info');
    closeGame(); 
    showScreen('mainMenu');
}

async function checkLoginStatus() {
    const token = localStorage.getItem('token');
    const playerId = localStorage.getItem('playerId');

    if (token && playerId) {
        try {
            // Fetch the latest profile data from the server
            const profileData = await apiRequest(`/api/profile/players/${playerId}`);

            // Update localStorage with the fresh data
            localStorage.setItem('username', profileData.username);
            localStorage.setItem('playerCountry', profileData.country);
            localStorage.setItem('avatarUrl', profileData.avatarUrl);
            localStorage.setItem('level', profileData.level);

            // Update the game state
            Object.assign(gameState, {
                ...profileData,
                token,
                playerId,
                isLoggedIn: true,
                playerCountry: profileData.country // Ensure consistency
            });

            console.log('User is logged in. Game state restored and updated from server:', gameState);
            updateProfileDisplay(gameState.level);
            connectChat();
        } catch (error) {
            console.error('Session restore failed:', error);
            // If token is invalid or user not found, log them out
            logoutUser();
            showNotification('Your session has expired. Please log in again.', 'error');
        }
    } else {
        console.log('No active login session found.');
        updateProfileDisplay();
    }
}


// --- Enter Key Navigation for Auth Forms ---
document.addEventListener('DOMContentLoaded', () => {
    const usernameInput = document.getElementById('usernameInput');
    const passwordInput = document.getElementById('passwordInput');
    const loginBtn = document.getElementById('loginBtn');

    const usernameInputRegister = document.getElementById('usernameInputRegister');
    const passwordInputRegister = document.getElementById('passwordInputRegister');
    const playerCountrySelect = document.getElementById('playerCountrySelect');
    const registerBtn = document.getElementById('registerBtn');

    // Login Form
    usernameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            passwordInput.focus();
        }
    });

    passwordInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            loginBtn.click();
        }
    });

    // Register Form
    usernameInputRegister.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            passwordInputRegister.focus();
        }
    });

    passwordInputRegister.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            playerCountrySelect.focus();
        }
    });

    playerCountrySelect.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            registerBtn.click();
        }
    });
});

async function detectUserCountry() {
    const CACHE_KEY = 'cachedCountryCode';
    const CACHE_EXPIRATION_MS = 24 * 60 * 60 * 1000; // 24 hours

    // Try to get from cache first
    const cachedData = localStorage.getItem(CACHE_KEY);
    if (cachedData) {
        const { countryCode, timestamp } = JSON.parse(cachedData);
        if (Date.now() - timestamp < CACHE_EXPIRATION_MS) {
            console.log('Detected country code from cache:', countryCode);
            return countryCode;
        }
    }

    try {
        const response = await fetch('https://ipapi.co/json/'); // Doğrudan ipapi.co'ya istek
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        if (data.country_code) { // ipapi.co uses country_code
            console.log('Detected country code directly from ipapi.co:', data.country_code);
            // Cache the result
            localStorage.setItem(CACHE_KEY, JSON.stringify({ countryCode: data.country_code, timestamp: Date.now() }));
            return data.country_code;
        } else {
            console.warn('Country detection failed from ipapi.co:', data.error);
            return null;
        }
    } catch (error) {
        console.error('Error detecting user country directly from ipapi.co:', error);
        return null;
    }
}

window.detectUserCountry = detectUserCountry; // Make it globally accessible
