// --- UI Helper Functions ---

function showScreen(screenId) {
    if (gameState.currentScreen && gameState.currentScreen !== screenId) {
        gameState.screenHistory.push(gameState.currentScreen);
    }
    gameState.currentScreen = screenId;

    const screens = document.querySelectorAll('.game-screen');
    screens.forEach(screen => {
        screen.classList.remove('active');
    });
    const activeScreen = document.getElementById(screenId);
    if (activeScreen) {
        activeScreen.classList.add('active');
        if (typeof applyTranslations === 'function') {
            applyTranslations();
        }
    }

    const gameInfoDisplay = document.querySelector('.game-info-display');
    if (gameInfoDisplay) {
        if (screenId === 'gameScreen') {
            gameInfoDisplay.style.display = 'flex';
        } else {
            gameInfoDisplay.style.display = 'none';
        }
    }
}

function openPlayerInfoModal() {
    document.getElementById('playerInfoModal').style.display = 'block';
    document.body.classList.add('no-scroll');
}

function closePlayerInfoModal() {
    document.getElementById('playerInfoModal').style.display = 'none';
    document.body.classList.remove('no-scroll');
}

function populateCountryDropdown(selectedCountryCode = null) {
    const select = document.getElementById('playerCountrySelect');
    if (!select) return;

    select.innerHTML = ''; // Clear existing options

    const defaultOption = document.createElement('option');
    defaultOption.textContent = getTranslation('selectCountry');
    defaultOption.value = '';
    defaultOption.disabled = true;
    defaultOption.selected = true;
    select.appendChild(defaultOption);

    const sortedCountries = Object.entries(countries).sort(([, a], [, b]) => a.name.localeCompare(b.name));

    for (const [code, country] of sortedCountries) {
        const option = document.createElement('option');
        option.value = code;
        option.textContent = country.name;
        if (selectedCountryCode && code === selectedCountryCode) {
            option.selected = true;
        }
        select.appendChild(option);
    }
}

function showAuthTab(tabId) {
    document.querySelectorAll('.auth-tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.auth-tab-btn').forEach(btn => btn.classList.remove('active'));

    document.getElementById(`${tabId}Tab`).classList.add('active');
    const button = document.getElementById(`show${tabId.charAt(0).toUpperCase() + tabId.slice(1)}Tab`);
    if (button) {
        button.classList.add('active');
    }

    if (tabId === 'register') {
        if (typeof window.detectUserCountry === 'function') {
            window.detectUserCountry().then(countryCode => {
                populateCountryDropdown(countryCode);
            });
        } else {
            console.warn('window.detectUserCountry is not defined. Country auto-detection will not work.');
            populateCountryDropdown(); // Fallback to populating without pre-selection
        }
    } else {
        populateCountryDropdown(); // Ensure dropdown is populated for other tabs too, without pre-selection
    }
}

function showNotification(message, type) {
    const notificationBar = document.getElementById('notificationBar');
    if (notificationBar) {
        notificationBar.textContent = message;
        notificationBar.className = `notification-bar show ${type}`;
        setTimeout(() => {
            notificationBar.classList.remove('show');
        }, 3000);
    }
}

function updateProfileDisplay(level) {
    const profileNameElement = document.getElementById('profilePlayerName');
    const profileCountryFlagElement = document.getElementById('profileCountryFlag');
    const gameBtn = document.querySelector('.game-btn');
    const headerPlayGameBtn = document.getElementById('headerPlayGameBtn');
    const myProfileBtn = document.getElementById('myProfileBtn');

    const gameModalProfileLogo = document.querySelector('.profile-logo');
    const profileAvatarPreview = document.getElementById('profileAvatarPreview');

    const avatarToUse = (gameState.isLoggedIn && gameState.avatarUrl) ? gameState.avatarUrl : 'assets/logo.jpg';
    const cacheBustedAvatarUrl = `${avatarToUse}?t=${new Date().getTime()}`;

    if (gameState.isLoggedIn) {
        if (profileNameElement) profileNameElement.textContent = gameState.username;
        if (profileCountryFlagElement) {
            const countryInfo = countries[gameState.playerCountry];
            profileCountryFlagElement.innerHTML = countryInfo ? `<img src="${countryInfo.flag}" alt="${countryInfo.name} Flag" class="flag-icon">` : '';
        }
        if(gameBtn) {
            const span = gameBtn.querySelector('span');
            if(span) span.textContent = getTranslation('playGame');
        }
        if(headerPlayGameBtn) {
            const span = headerPlayGameBtn.querySelector('span');
            if(span) span.textContent = getTranslation('playGame');
        }
        if(myProfileBtn) {
            myProfileBtn.innerHTML = ` ${getTranslation('myProfile')}`;
        }

    } else {
        if (profileNameElement) profileNameElement.textContent = getTranslation('guest');
        if (profileCountryFlagElement) profileCountryFlagElement.innerHTML = '';
        if(gameBtn) {
            const span = gameBtn.querySelector('span');
            if(span) span.textContent = getTranslation('loginOrRegister');
        }
        if(headerPlayGameBtn) {
            const span = headerPlayGameBtn.querySelector('span');
            if(span) span.textContent = getTranslation('loginOrRegister');
        }
        if(myProfileBtn) {
            myProfileBtn.innerHTML = ` ${getTranslation('myProfile')}`;
        }
    }

    const levelClass = (level > 0) ? `level-${level}-border` : '';

    if (gameModalProfileLogo) {
        gameModalProfileLogo.src = cacheBustedAvatarUrl;
        gameModalProfileLogo.className = `profile-logo ${levelClass}`.trim();
    }
    if (profileAvatarPreview) {
        profileAvatarPreview.src = cacheBustedAvatarUrl;
        profileAvatarPreview.className = `profile-avatar-preview ${levelClass}`.trim();
    }
}

async function showPlayerProfile(playerId) {
    try {
        const player = await apiRequest(`/api/players/${playerId}`, 'GET');

        document.getElementById('playerProfileUsername').textContent = player.username;
        document.getElementById('playerProfileCountry').innerHTML = countries[player.country] ? `<img src="${countries[player.country].flag}" alt="${countries[player.country].name} Flag" class="flag-icon"> ${countries[player.country].name}` : player.country;
        document.getElementById('playerProfileAvatar').src = player.avatarurl || 'assets/logo.jpg';
        document.getElementById('playerProfileGamesPlayed').textContent = player.gameCount;
        document.getElementById('playerProfileHighestScore').textContent = player.highestScore;
        document.getElementById('playerProfileJoinedDate').textContent = new Date(player.createdAt).toLocaleDateString();

        const playerScoresList = document.getElementById('playerProfileScores');
        playerScoresList.innerHTML = '';
        if (player.scores && player.scores.length > 0) {
            player.scores.forEach(score => {
                const li = document.createElement('li');
                li.textContent = `${getTranslation('mode')}: ${score.mode}, ${getTranslation('score')}: ${score.score} (${new Date(score.timestamp).toLocaleDateString()})`;
                playerScoresList.appendChild(li);
            });
        } else {
            playerScoresList.innerHTML = `<li>${getTranslation('noScoresYet')}</li>`;
        }

        document.getElementById('playerProfileModal').style.display = 'block';
    } catch (error) {
        console.error('Failed to fetch player profile:', error);
        showNotification(`${getTranslation('loadProfileFailed')}: ${error.message}`, 'error');
    }
}

function goBack() {
    if (gameState.screenHistory.length > 0) {
        const previousScreenId = gameState.screenHistory.pop();
        showScreen(previousScreenId);
    } else {
        showScreen('mainMenu'); // Fallback to main menu if no history
    }
}

// --- Emoji Picker Functions ---
function toggleEmojiPicker() {
    const emojiPicker = document.getElementById('emojiPicker');
    emojiPicker.classList.toggle('show');
}

function populateEmojiPicker() {
    const emojiPicker = document.getElementById('emojiPicker');
    if (!emojiPicker || emojiPicker.innerHTML !== '') return; // Populate only once

    const emojis = [
        '😀', '😂', '😊', '😍', '🤔', '😎', '😭', '😡', '👍', '👎', '❤️', '🔥', '🚀', '🎉', '💰', '💎',
        '💯', '🙏', '🙌', '🤷', '🤦', '👀', '🤯', '🤣', '🥰', '😘', '🤩', '😴', '👋', '👌', '✌️', '🤞',
        '🧠', '💪', '🎮', '🏆', '🌍', '🏳️', '⚔️', '🛡️', '📈', '📉', '💡', '💀', '🤖', '👾', '👽', '👑'
    ];

    emojis.forEach(emoji => {
        const emojiSpan = document.createElement('span');
        emojiSpan.textContent = emoji;
        emojiSpan.addEventListener('click', () => insertEmoji(emoji));
        emojiPicker.appendChild(emojiSpan);
    });
}

function insertEmoji(emoji) {
    const chatInput = document.getElementById('chatInput');
    chatInput.value += emoji;
    chatInput.focus();
}

function playSound(sound, extension = 'wav') {
    if (gameState.isSoundMuted) return;
    const audio = new Audio(`assets/${sound}.${extension}`);
    audio.play().catch(error => console.error(`Error playing sound: ${sound}`, error));
}



function populateChatTabs() {
    const chatRoomList = document.getElementById('chatRoomList');
    if (!chatRoomList) return;

    chatRoomList.innerHTML = ''; // Clear existing options

    // Fetch rooms dynamically from the server
    apiRequest('/api/chat/rooms', 'GET')
        .then(serverRooms => {
            // Ensure 'Global' is always the first option
            let rooms = ['Global'];
            serverRooms.forEach(room => {
                if (room !== 'Global' && !rooms.includes(room)) {
                    rooms.push(room);
                }
            });
            rooms.sort(); // Sort other rooms alphabetically

            rooms.forEach(room => {
                const li = document.createElement('li');
                li.textContent = room;
                li.dataset.roomName = room;
                li.classList.add('chat-room-list-item');
                if (room === gameState.currentRoom) {
                    li.classList.add('active');
                }
                li.addEventListener('click', () => {
                    selectChatTab(room);
                    // Close sidebar on selection
                    document.getElementById('chatRoomSidebar').classList.remove('active');
                    document.getElementById('chatRoomDropdownBtn').classList.remove('active');
                });
                chatRoomList.appendChild(li);
            });
        })
        .catch(error => {
            console.error('Failed to fetch chat rooms:', error);
            showNotification(getTranslation('failedToLoadChatRooms'), 'error');
            // Fallback to static rooms if API fails
            const fallbackRooms = ['Global', ...Object.keys(continentMap)];
            fallbackRooms.sort().forEach(room => {
                const li = document.createElement('li');
                li.textContent = room;
                li.dataset.roomName = room;
                li.classList.add('chat-room-list-item');
                if (room === gameState.currentRoom) {
                    li.classList.add('active');
                }
                li.addEventListener('click', () => {
                    selectChatTab(room);
                    document.getElementById('chatRoomSidebar').classList.remove('active');
                    document.getElementById('chatRoomDropdownBtn').classList.remove('active');
                });
                chatRoomList.appendChild(li);
            });
        });
}

function selectChatTab(roomName) {
    // Only proceed if the room is actually changing
    if (gameState.currentRoom === roomName) {
        return;
    }

    gameState.currentRoom = roomName;
    gameState.chatHistoryOffset = 0; // Reset offset when changing rooms

    // Update the active class in the list
    document.querySelectorAll('.chat-room-list-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.roomName === roomName) {
            item.classList.add('active');
        }
    });

    if (socket && socket.connected) {
        socket.emit('joinRoom', { playerId: gameState.playerId, username: gameState.username, country: gameState.playerCountry, room: roomName });
    }
    fetchChatMessages(roomName);
}

function createTokenChart() {
    const chartContainer = document.getElementById('tokenomics');
    if (!chartContainer) {
        return;
    }

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const ctx = document.getElementById('tokenChart');
                if (ctx && !ctx.chart) {
                    const data = {
                        labels: [
                            'Public Sale / Liquidity',
                            'Team'
                        ],
                        datasets: [{
                            data: [90, 10],
                            backgroundColor: [
                                '#00d4ff',
                                '#ff0096'
                            ],
                            borderWidth: 2,
                            borderColor: '#1a1a2e',
                            hoverBorderColor: '#fff',
                            hoverBorderWidth: 3,
                        }]
                    };

                    const options = {
                        responsive: true,
                        maintainAspectRatio: false,
                        cutout: '70%',
                        animation: {
                            animateScale: true,
                            animateRotate: true,
                            duration: 2000,
                            easing: 'easeInOutQuart'
                        },
                        plugins: {
                            legend: {
                                display: false
                            },
                            tooltip: {
                                enabled: false,
                                external: function(context) {
                                    let tooltipEl = document.getElementById('chartjs-tooltip');
                                    if (!tooltipEl) {
                                        tooltipEl = document.createElement('div');
                                        tooltipEl.id = 'chartjs-tooltip';
                                        tooltipEl.innerHTML = '<table></table>';
                                        document.body.appendChild(tooltipEl);
                                    }
                                    const tooltipModel = context.tooltip;
                                    if (tooltipModel.opacity === 0) {
                                        tooltipEl.style.opacity = 0;
                                        return;
                                    }
                                    tooltipEl.classList.remove('above', 'below', 'no-transform');
                                    if (tooltipModel.yAlign) {
                                        tooltipEl.classList.add(tooltipModel.yAlign);
                                    } else {
                                        tooltipEl.classList.add('no-transform');
                                    }
                                    function getBody(bodyItem) {
                                        return bodyItem.lines;
                                    }
                                    if (tooltipModel.body) {
                                        const titleLines = tooltipModel.title || [];
                                        const bodyLines = tooltipModel.body.map(getBody);
                                        let innerHtml = '<thead>';
                                        titleLines.forEach(function(title) {
                                            innerHtml += '<tr><th>' + title + '</th></tr>';
                                        });
                                        innerHtml += '</thead><tbody>';
                                        bodyLines.forEach(function(body, i) {
                                            const colors = tooltipModel.labelColors[i];
                                            // Apply background and border color directly to span for Chart.js color blocks
                                            let spanStyle = 'background:' + colors.backgroundColor + '; border-color:' + colors.borderColor + '; border-width: 2px;';
                                            const span = '<span style="' + spanStyle + '"></span>';
                                            innerHtml += '<tr><td>' + span + body + '</td></tr>';
                                        });
                                        innerHtml += '</tbody>';
                                        let table = tooltipEl.querySelector('table');
                                        table.innerHTML = innerHtml;
                                    }
                                    const position = context.chart.canvas.getBoundingClientRect();
                                    tooltipEl.style.opacity = 1;
                                    tooltipEl.style.position = 'absolute';
                                    tooltipEl.style.left = position.left + window.pageXOffset + tooltipModel.caretX + 'px';
                                    tooltipEl.style.top = position.top + window.pageYOffset + tooltipModel.caretY + 'px';
                                    // Add the new class for static styles
                                    tooltipEl.classList.add('chartjs-tooltip-dynamic');
                                    // Remove direct style assignments that are now in CSS
                                    // tooltipEl.style.font = '1rem Inter, sans-serif';
                                    // tooltipEl.style.padding = tooltipModel.padding + 'px ' + tooltipModel.padding + 'px';
                                    // tooltipEl.style.pointerEvents = 'none';
                                    // tooltipEl.style.background = 'rgba(15, 26, 43, 0.9)';
                                    // tooltipEl.style.border = '1px solid #00AEEF';
                                    // tooltipEl.style.borderRadius = '10px';
                                    // tooltipEl.style.color = '#fff';
                                    // tooltipEl.style.transition = 'opacity 0.2s';
                                    // tooltipEl.style.boxShadow = '0 0 15px rgba(0, 174, 239, 0.5)';
                                }
                            }
                        }
                    };

                    ctx.chart = new Chart(ctx, {
                        type: 'doughnut',
                        data: data,
                        options: options
                    });
                }
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });

    observer.observe(chartContainer);
}

document.addEventListener('DOMContentLoaded', () => {
    const introOverlay = document.getElementById('intro-overlay');
    const mainContent = document.getElementById('main-content');

    const transitionToMainContent = () => {
        if (introOverlay) {
            introOverlay.style.opacity = '0';
            setTimeout(() => {
                if (introOverlay) {
                    introOverlay.style.display = 'none';
                }
            }, 500);
        }
        if (mainContent) {
            mainContent.style.opacity = '1';
        }
    };

    if (localStorage.getItem('hasVisited')) {
        document.body.classList.add('intro-skipped');
        if (introOverlay) {
            introOverlay.style.display = 'none';
        }
        if (mainContent) {
            mainContent.style.opacity = '1';
        }
    } else {
        localStorage.setItem('hasVisited', 'true');
        setTimeout(transitionToMainContent, 3000);
    }
});
