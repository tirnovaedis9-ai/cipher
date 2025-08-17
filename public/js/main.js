document.addEventListener('DOMContentLoaded', async function() {
    // The new checkLoginStatus function will handle the initial state restoration.
    await checkLoginStatus(); 
    
    // These can run in parallel as they don't depend on login state.
    populateCountryDropdown();
    createTokenChart();
    setupEventListeners();
    populateEmojiPicker();
});

// This function is now removed from main.js as its logic is now in checkLoginStatus in auth.js
/*
async function initializeApp() {
    ...
}
*/

function setupEventListeners() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    const mobileToggle = document.querySelector('.mobile-menu-toggle');
    const nav = document.querySelector('.nav');

    if (mobileToggle) {
        mobileToggle.addEventListener('click', function() {
            mobileToggle.classList.toggle('active');
            nav.classList.toggle('active');
        });
    }

    const gameBtns = document.querySelectorAll('.game-btn, .play-game-btn');
    gameBtns.forEach(btn => {
        btn.addEventListener('click', openGame);
    });

    document.getElementById('gameModal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeGame();
        }
    });

    const gameBackButton = document.getElementById('gameBackButton');
    if (gameBackButton) {
        gameBackButton.addEventListener('click', backToMenu);
    }

    const chatBackButton = document.getElementById('chatBackButton');
    if (chatBackButton) {
        chatBackButton.addEventListener('click', backToMenu);
    }

    const closeGameButtons = document.querySelectorAll('.close-game');
    closeGameButtons.forEach(btn => {
        // Exclude specific modals from the generic closeGame listener
        if (!btn.closest('#playerProfileModal') && !btn.closest('#imageCropperModal')) {
            btn.addEventListener('click', closeGame);
        }
    });

    document.getElementById('playerInfoModal').addEventListener('click', function(e) {
        if (e.target === this) {
            closePlayerInfoModal();
        }
    });

    let lastScrollTop = 0;
    const header = document.querySelector('.header');
    const headerHeight = header.offsetHeight;

    window.addEventListener('scroll', function() {
        let scrollTop = window.pageYOffset || document.documentElement.scrollTop;

        if (scrollTop > lastScrollTop && scrollTop > headerHeight) {
            header.classList.add('header-hidden');
        } else if (scrollTop < lastScrollTop) {
            header.classList.remove('header-hidden');
        }
        lastScrollTop = scrollTop;

        const scrollToTopBtn = document.getElementById('scrollToTopBtn');
        if (scrollToTopBtn) {
            if (scrollTop > 200) {
                scrollToTopBtn.classList.add('show');
            } else {
                scrollToTopBtn.classList.remove('show');
            }
        }
    });

    document.getElementById('scrollToTopBtn').addEventListener('click', function() {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    document.getElementById('showRegisterTab').addEventListener('click', () => showAuthTab('register'));
    document.getElementById('showLoginTab').addEventListener('click', () => showAuthTab('login'));

    document.getElementById('registerBtn').addEventListener('click', registerUser);
    document.getElementById('loginBtn').addEventListener('click', loginUser);

    // Chat-related event listeners
    document.getElementById('chatSendBtn').addEventListener('click', sendMessage);
    document.getElementById('chatInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
    document.getElementById('emojiBtn').addEventListener('click', (event) => {
            event.stopPropagation(); // Prevent the click from closing the picker immediately
            toggleEmojiPicker();
        });

        const showChatRoomsBtn = document.getElementById('showChatRoomsBtn');
        const showActiveUsersBtn = document.getElementById('showActiveUsersBtn');
        const chatRoomsContent = document.getElementById('chatRoomsContent');
        const activeUsersContent = document.getElementById('activeUsersContent');

        if (showChatRoomsBtn && showActiveUsersBtn && chatRoomsContent && activeUsersContent) {
            showChatRoomsBtn.addEventListener('click', () => showChatSidebarTab('chatRooms'));
            showActiveUsersBtn.addEventListener('click', () => showChatSidebarTab('activeUsers'));
        }

        const modeBtns = document.querySelectorAll('.mode-btn');
        modeBtns.forEach(btn => {
            btn.addEventListener('click', (event) => {
                const size = parseInt(event.currentTarget.dataset.size);
                selectMode(size);
            });
        });

    const leaderboardBtn = document.querySelector('.leaderboard-btn');
    if (leaderboardBtn) {
        leaderboardBtn.addEventListener('click', showLeaderboard);
    }

    const chatBtn = document.querySelector('.leaderboard-btn.chat-btn');
    if (chatBtn) {
        chatBtn.addEventListener('click', () => {
            // First, ensure the user is in the correct room
            const targetRoom = gameState.playerCountry ? `country-${gameState.playerCountry}` : 'Global';
            if (socket && socket.connected) {
                switchRoom(targetRoom);
            } else {
                // If not connected, connectChat will handle joining the correct room
                connectChat();
            }
            // Then, show the chat screen
            showChatScreen();
        });
    }

    const chatRoomDropdownBtn = document.getElementById('chatRoomDropdownBtn');
    const chatRoomSidebar = document.getElementById('chatRoomSidebar');

    if (chatRoomDropdownBtn && chatRoomSidebar) {
        chatRoomDropdownBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            chatRoomDropdownBtn.classList.toggle('active');
            chatRoomSidebar.classList.toggle('active');
        });

        document.addEventListener('click', (event) => {
            if (!chatRoomSidebar.contains(event.target) && !chatRoomDropdownBtn.contains(event.target)) {
                chatRoomDropdownBtn.classList.remove('active');
                chatRoomSidebar.classList.remove('active');
            }
        });
    }

    if (myProfileBtn) {
        myProfileBtn.addEventListener('click', () => {
            if (gameState.isLoggedIn) {
                showScreen('profileScreen');
                populateMyProfileData(); // Yeni eklenecek fonksiyon
            } else {
                openPlayerInfoModal();
            }
        });
    }

    const startBtn = document.getElementById('startBtn');
    if (startBtn) {
        startBtn.addEventListener('click', startGame);
    }

    // Profile screen buttons
    const updateUsernameBtn = document.getElementById('updateUsernameBtn');
    if (updateUsernameBtn) {
        updateUsernameBtn.addEventListener('click', updateUsername);
    }

    const updatePasswordBtn = document.getElementById('updatePasswordBtn');
    if (updatePasswordBtn) {
        updatePasswordBtn.addEventListener('click', updatePassword);
    }

    const profileScreen = document.getElementById('profileScreen');
    if (profileScreen) {
        profileScreen.addEventListener('click', (e) => {
            const target = e.target.closest('[data-action]');
            if (!target) return;

            const action = target.dataset.action;
            if (typeof window[action] === 'function') {
                window[action]();
            } else if (action === 'changePicture') {
                document.getElementById('avatarUploadInput').click();
            }
        });
    }

    const avatarUploadInput = document.getElementById('avatarUploadInput');
    if (avatarUploadInput) {
        avatarUploadInput.addEventListener('change', processAndUploadAvatar);
    }

    const cropImageBtn = document.getElementById('cropImageBtn');
    if (cropImageBtn) {
        cropImageBtn.addEventListener('click', () => {
            if (cropper) {
                cropper.getCroppedCanvas({
                    width: 250,
                    height: 250,
                    fillColor: '#fff',
                }).toBlob((blob) => {
                    if (blob) {
                        updateAvatar(blob);
                        closeImageCropper();
                    } else {
                        showNotification('Failed to crop image.', 'error');
                    }
                }, 'image/jpeg', 0.9);
            }
        });
    }

    const closePlayerInfoModalBtn = document.querySelector('#playerInfoModal .close-game');
    if (closePlayerInfoModalBtn) {
        closePlayerInfoModalBtn.addEventListener('click', closePlayerInfoModal);
    }

    const closePlayerProfileModalBtn = document.querySelector('#playerProfileModal .close-game');
    if (closePlayerProfileModalBtn) {
        closePlayerProfileModalBtn.addEventListener('click', closePlayerProfileModal);
    }

    const closeImageCropperBtn = document.querySelector('#imageCropperModal .close-game');
    if (closeImageCropperBtn) {
        closeImageCropperBtn.addEventListener('click', closeImageCropper);
    }

    window.addEventListener('mouseup', () => {
        if (gameState.isPainting) {
            gameState.isPainting = false;
        }
    });

    // Close emoji picker when clicking outside
    document.addEventListener('click', (event) => {
        const emojiPicker = document.getElementById('emojiPicker');
        const emojiBtn = document.getElementById('emojiBtn');
        if (emojiPicker && emojiBtn && !emojiPicker.contains(event.target) && !emojiBtn.contains(event.target)) {
            emojiPicker.classList.remove('show');
        }
    });
}

// Export functions for global access
window.openGame = openGame;
window.closeGame = closeGame;
window.selectMode = selectMode;
window.startGame = startGame;
window.backToMenu = backToMenu;
window.showLeaderboard = showLeaderboard;
window.showLeaderboardTab = showLeaderboardTab;
window.openPlayerInfoModal = openPlayerInfoModal;
window.closePlayerInfoModal = closePlayerInfoModal;
window.registerUser = registerUser;
window.loginUser = loginUser;
window.logoutUser = logoutUser;
window.populateCountryDropdown = populateCountryDropdown;
window.setActiveColor = setActiveColor;
window.restartGame = restartGame;
window.shareScoreToX = shareScoreToX;
window.showPlayerProfile = showPlayerProfile;
window.closePlayerProfileModal = closePlayerProfileModal;
window.showAuthTab = showAuthTab;
window.showChatScreen = showChatScreen;
window.closeChatScreen = closeChatScreen;
window.updateUsername = updateUsername;
window.updatePassword = updatePassword;
window.closeImageCropper = closeImageCropper;
window.enableMessageEdit = enableMessageEdit;
window.deleteMessage = deleteMessage;
window.populateMyProfileData = populateMyProfileData;
window.goBack = goBack;

function showChatSidebarTab(tabName) {
    const chatRoomsContent = document.getElementById('chatRoomsContent');
    const activeUsersContent = document.getElementById('activeUsersContent');
    const showChatRoomsBtn = document.getElementById('showChatRoomsBtn');
    const showActiveUsersBtn = document.getElementById('showActiveUsersBtn');

    if (tabName === 'chatRooms') {
        chatRoomsContent.classList.remove('hidden');
        activeUsersContent.classList.add('hidden');
        showChatRoomsBtn.classList.add('active');
        showActiveUsersBtn.classList.remove('active');
    } else if (tabName === 'activeUsers') {
        chatRoomsContent.classList.add('hidden');
        activeUsersContent.classList.remove('hidden');
        showChatRoomsBtn.classList.remove('active');
        showActiveUsersBtn.classList.add('active');
        // Optionally, fetch and update active users here if not already handled by socket.io
    }
}
