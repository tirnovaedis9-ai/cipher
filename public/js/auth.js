async function registerUser() {
    const username = document.getElementById('usernameInputRegister').value;
    const password = document.getElementById('passwordInputRegister').value;
    const country = document.getElementById('countrySearchInput').dataset.selectedCode;

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

        Object.assign(gameState, { ...profileData, playerId: data.playerId, isLoggedIn: true, token: data.token, playerCountry: profileData.country });

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

        Object.assign(gameState, { ...profileData, playerId: data.playerId, isLoggedIn: true, token: data.token, playerCountry: profileData.country });

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

    // Preserve settings that shouldn't be reset on logout
    const preservedState = {
        isSoundMuted: gameState.isSoundMuted,
        zoomLevel: gameState.zoomLevel
    };

    // Reset the game state to its default values
    gameState = { ...defaultGameState };

    // Restore the preserved settings
    Object.assign(gameState, preservedState);

    if (socket) {
        socket.disconnect();
        socket = null; // Make sure the socket is properly cleaned up
    }

    // Clear UI elements related to the user
    document.getElementById('chatMessages').innerHTML = '';
    document.getElementById('onlineUserList').innerHTML = '';
    document.getElementById('activeUserListSidebar').innerHTML = '';
    document.getElementById('onlineUserCount').textContent = '0';


    updateProfileDisplay(); // Update UI to reflect logged-out state
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

            if (window.IS_DEVELOPMENT) {
                console.log('User is logged in. Game state restored and updated from server:', gameState);
            }
            updateProfileDisplay(gameState.level);
            connectChat();
            // Call positionPlayGameButton after login status is checked
            if (typeof positionPlayGameButton === 'function') {
                positionPlayGameButton();
            }
        } catch (error) {
            console.error('Session restore failed:', error);
            // If token is invalid or user not found, log them out
            logoutUser();
            showNotification(getTranslation('sessionExpired'), 'error');
        }
    } else {
        if (window.IS_DEVELOPMENT) { // Check if in development mode
            console.log('No active login session found.');
        }
        updateProfileDisplay();
        // Call positionPlayGameButton even if no session found, to ensure correct initial positioning
        if (typeof positionPlayGameButton === 'function') {
            positionPlayGameButton();
        }
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
    if (usernameInput) {
        usernameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                passwordInput.focus();
            }
        });
    }

    if (passwordInput) {
        passwordInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                loginBtn.click();
            }
        });
    }

    // Register Form
    if (usernameInputRegister) {
        usernameInputRegister.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                passwordInputRegister.focus();
            }
        });
    }

    if (passwordInputRegister) {
        passwordInputRegister.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (playerCountrySelect) {
                    playerCountrySelect.focus();
                }
            }
        });
    }

    if (playerCountrySelect) {
        playerCountrySelect.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (registerBtn) {
                    registerBtn.click();
                }
            }
        });
    }
});



async function detectUserCountry() {
    try {
        // Attempt to use a geolocation API for more accurate detection
        const response = await fetch('https://ipapi.co/json/?fields=countryCode');
        const data = await response.json();
        if (data && data.countryCode) {
            if (window.IS_DEVELOPMENT) {
                console.log('Detected country from ipapi.co:', data.countryCode);
            }
            return data.countryCode;
        }
    } catch (error) {
        console.warn('Failed to detect country via IP API, falling back to navigator.language:', error);
    }

    // Fallback to browser language
    const userLanguage = navigator.language || navigator.userLanguage;
    if (userLanguage) {
        const parts = userLanguage.split('-');
        if (parts.length > 1) {
            const detectedCode = parts[1].toUpperCase();
            if (window.IS_DEVELOPMENT) {
                console.log('Detected country from navigator.language:', detectedCode);
            }
            return detectedCode;
        }
    }
    if (window.IS_DEVELOPMENT) {
        console.log('Defaulting to US as country detection failed.');
    }
    return 'US'; // Default to United States if detection fails
}

window.detectUserCountry = detectUserCountry; // Make it globally accessible

// Function to populate the custom country select dropdown
function populateCountrySelect(filter = '') {
    const countrySearchInput = document.getElementById('countrySearchInput');
    const dropdownList = document.getElementById('countryDropdownList');
    dropdownList.innerHTML = ''; // Clear previous options

    const countryNames = Object.keys(countries).map(code => ({
        code: code,
        name: getTranslation('country_' + code.toLowerCase()),
        flag: countries[code].flag
    })).sort((a, b) => a.name.localeCompare(b.name));

    countryNames.forEach(country => {
        if (country.name.toLowerCase().includes(filter.toLowerCase())) {
            const countryItem = document.createElement('div');
            countryItem.className = 'country-item';
            countryItem.dataset.countryCode = country.code;
            countryItem.innerHTML = `<img src="${country.flag}" alt="${country.name} Flag" class="flag-icon"><span>${country.name}</span>`;
            
            countryItem.addEventListener('click', () => {
                countrySearchInput.dataset.selectedCode = country.code; // Set the code first
                updateCountryInputDisplay(country.code); // Explicitly update display with flag and translated name
                dropdownList.classList.remove('active');
                countrySearchInput.classList.remove('active-search');
                countrySearchInput.readOnly = true; // Set readOnly after display update
            });
            dropdownList.appendChild(countryItem);
        }
    });
}

// Function to update the input's display (name + flag) - MOVED OUTSIDE DOMContentLoaded
function updateCountryInputDisplay(countryCode) {
    const countrySearchInput = document.getElementById('countrySearchInput'); // Get element here
    if (countryCode && countries[countryCode]) {
        const country = countries[countryCode];
        countrySearchInput.value = getTranslation('country_' + countryCode.toLowerCase());
        countrySearchInput.style.backgroundImage = `url(${country.flag})`;
        countrySearchInput.style.backgroundRepeat = 'no-repeat';
        countrySearchInput.style.backgroundPosition = '0.75rem center';
        countrySearchInput.style.backgroundSize = '24px 16px';
        countrySearchInput.style.paddingLeft = '2.5rem';
    } else {
        countrySearchInput.value = '';
        countrySearchInput.placeholder = getTranslation('selectCountry');
        countrySearchInput.style.backgroundImage = 'none';
        countrySearchInput.style.paddingLeft = '0.75rem';
    }
}

// Event listeners for custom country select
document.addEventListener('DOMContentLoaded', () => {
    const countrySearchInput = document.getElementById('countrySearchInput');
    const countryDropdownList = document.getElementById('countryDropdownList');
    const registerBtn = document.getElementById('registerBtn');

    // Toggle dropdown visibility and enable search
    if (countrySearchInput) {
        countrySearchInput.addEventListener('click', () => {
            countrySearchInput.readOnly = false;
            countrySearchInput.value = '';
            countrySearchInput.classList.add('active-search');
            countrySearchInput.style.backgroundImage = 'none';
            countrySearchInput.style.paddingLeft = '0.75rem';
            populateCountrySelect();
            countryDropdownList.classList.add('active');
            countrySearchInput.focus();
        });

        countrySearchInput.addEventListener('input', (event) => {
            populateCountrySelect(event.target.value);
            countryDropdownList.classList.add('active');
        });

        countrySearchInput.addEventListener('focus', () => {
            // If it's not already in search mode, clear and show dropdown
            if (countrySearchInput.readOnly) {
                countrySearchInput.value = '';
                countrySearchInput.readOnly = false;
                countrySearchInput.classList.add('active-search');
                populateCountrySelect();
                countryDropdownList.classList.add('active');
            }
        });

        countrySearchInput.addEventListener('blur', () => {
            // Delay to allow click on country item to register
            setTimeout(() => {
                if (!countryDropdownList.contains(document.activeElement)) {
                    countryDropdownList.classList.remove('active');
                    countrySearchInput.readOnly = true;
                    countrySearchInput.classList.remove('active-search');

                    if (countrySearchInput.dataset.selectedCode) {
                        updateCountryInputDisplay(countrySearchInput.dataset.selectedCode);
                    } else {
                        updateCountryInputDisplay('');
                    }
                }
            }, 100);
        });
    }

    // Close dropdown when clicking outside (excluding the input and dropdown itself)
    document.addEventListener('click', (event) => {
        if (countrySearchInput && countryDropdownList && !countrySearchInput.contains(event.target) && !countryDropdownList.contains(event.target)) {
            countryDropdownList.classList.remove('active');
            countrySearchInput.readOnly = true;
            countrySearchInput.classList.remove('active-search');
            if (countrySearchInput.dataset.selectedCode) {
                updateCountryInputDisplay(countrySearchInput.dataset.selectedCode);
            } else {
                updateCountryInputDisplay('');
            }
        }
    });

    // Populate the country select when the DOM is loaded
    populateCountrySelect();
    // Set initial display for the input
    updateCountryInputDisplay('');

    // Also populate when the register tab is shown (in case it's loaded dynamically)
    const showRegisterTabBtn = document.getElementById('showRegisterTab');
    if (showRegisterTabBtn) {
        showRegisterTabBtn.addEventListener('click', () => {
            populateCountrySelect();
            if (countrySearchInput) {
                countrySearchInput.value = '';
                countrySearchInput.readOnly = true;
                countrySearchInput.classList.remove('active-search');
                countrySearchInput.dataset.selectedCode = '';
                updateCountryInputDisplay('');
            }
            countryDropdownList.classList.remove('active');
        });
    }
});