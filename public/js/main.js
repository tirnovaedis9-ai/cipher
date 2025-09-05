document.addEventListener('DOMContentLoaded', async function() {
    // The new checkLoginStatus function will handle the initial state restoration.
    await checkLoginStatus(); 
    
    // These can run in parallel as they don't depend on login state.
    populateCountryDropdown();
    createTokenChart();
    setupEventListeners();
    setupEmojiPicker();
    setupCountrySearch();

    // Call the function to position the Play Game button on load
    positionPlayGameButton();
});

// Call the function to position the Play Game button on window resize
// Recalculate on resize
window.addEventListener('resize', positionPlayGameButton);



// This function is now removed from main.js as its logic is now in checkLoginStatus in auth.js
/*
async function initializeApp() {
    ...
}
*/

function setupEventListeners() {
    setupCarousel();
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

            // Close the mobile menu if it's open
            const mobileToggle = document.querySelector('.mobile-menu-toggle');
            const nav = document.querySelector('.nav');
            if (mobileToggle && nav && mobileToggle.classList.contains('active')) {
                mobileToggle.classList.remove('active');
                nav.classList.remove('active');
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

        // Close mobile menu when clicking outside
        document.addEventListener('click', function(event) {
            // Check if the click is outside the mobile toggle button and the navigation menu
            const isClickInsideNav = nav.contains(event.target);
            const isClickInsideToggle = mobileToggle.contains(event.target);

            if (nav.classList.contains('active') && !isClickInsideNav && !isClickInsideToggle) {
                mobileToggle.classList.remove('active');
                nav.classList.remove('active');
            }
        });
    }

    const gameBtns = document.querySelectorAll('.game-btn, .play-game-btn');
    gameBtns.forEach(btn => {
        btn.addEventListener('click', openGame);
    });

    document.getElementById('gameModal').addEventListener('click', function(e) {
        if (e.target === this) {
            // Close game modal when clicking outside the game content
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
            // Close player info modal when clicking outside
            closePlayerInfoModal();
        }
    });

    let lastScrollTop = 0;
    const header = document.querySelector('.header');
    const headerHeight = header.offsetHeight;

    window.addEventListener('scroll', function() {
        let scrollTop = window.pageYOffset || document.documentElement.scrollTop;

        // Handle the new dynamic island header
        const dynamicHeader = document.getElementById('desktop-header-container');
        if (dynamicHeader) {
            if (scrollTop > 50) { // A small threshold
                dynamicHeader.classList.add('scrolled');
            } else {
                dynamicHeader.classList.remove('scrolled');
            }
        }

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

    const casualGamesBtn = document.getElementById('casualGamesBtn');
    if (casualGamesBtn) {
        casualGamesBtn.addEventListener('click', openCasualGamesModal);
    }

    const closeCasualGamesModalBtn = document.querySelector('#casualGamesModal .close-game');
    if (closeCasualGamesModalBtn) {
        closeCasualGamesModalBtn.addEventListener('click', closeCasualGamesModal);
    }

    const casualGamesBackBtn = document.getElementById('casualGamesBackBtn');
    if (casualGamesBackBtn) {
        casualGamesBackBtn.addEventListener('click', closeCasualGamesModal);
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

    const copyContractBtn = document.getElementById('copyContractBtn');
    if (copyContractBtn) {
        copyContractBtn.addEventListener('click', () => {
            const contractAddress = document.getElementById('contractAddress').textContent;
            navigator.clipboard.writeText(contractAddress).then(() => {
                showNotification(getTranslation('addressCopiedSuccess'), 'success');
                const icon = copyContractBtn.querySelector('i');
                icon.classList.remove('fa-copy');
                icon.classList.add('fa-check');
                setTimeout(() => {
                    icon.classList.remove('fa-check');
                    icon.classList.add('fa-copy');
                }, 2000);
            }).catch(err => {
                showNotification(getTranslation('addressCopiedFailed'), 'error');
                console.error('Failed to copy text: ', err);
            });
        });
    }
    // Image Modal Logic
    const modal = document.getElementById('imageModal');
    const modalImg = document.getElementById('modalImage');
    const socialItems = document.querySelectorAll('.social-item');
    const closeModal = document.querySelector('.close-image-modal');

    if (modal && modalImg && closeModal && socialItems.length > 0) {
        socialItems.forEach(item => {
            item.addEventListener('click', function() {
                const img = this.querySelector('img');
                if (img) {
                    modal.style.display = 'flex';
                    modalImg.src = img.src;
                    modalImg.alt = img.alt;
                }
            });
        });

        closeModal.addEventListener('click', function() {
            modal.style.display = 'none';
        });

        modal.addEventListener('click', function(event) {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });
    }
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
window.openCasualGamesModal = openCasualGamesModal;
window.closeCasualGamesModal = closeCasualGamesModal;

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

// Function to dynamically position the Play Game button
function positionPlayGameButton() {
    const dynamicIsland = document.getElementById('dynamic-island-nav');
    const playGameButton = document.getElementById('headerPlayGameBtnDesktop');
    const desktopHeaderContainer = document.getElementById('desktop-header-container');

    // Only apply this logic on desktop and if elements exist
    if (!dynamicIsland || !playGameButton || !desktopHeaderContainer || window.innerWidth <= 768) {
        // Reset button position if not on desktop or elements not found
        if (playGameButton) {
            playGameButton.style.left = '';
            playGameButton.style.right = ''; // Clear any previous right setting
        }
        return;
    }

    const containerRect = desktopHeaderContainer.getBoundingClientRect();
    const islandRect = dynamicIsland.getBoundingClientRect();
    const buttonRect = playGameButton.getBoundingClientRect();

    // The center of the space between the island's right edge and the screen's right edge, in viewport coordinates
    const targetButtonCenterXViewport = (islandRect.right + window.innerWidth) / 2;

    // Convert the target center to be relative to the container
    const targetButtonCenterXRelativeToContainer = targetButtonCenterXViewport - containerRect.left;

    // Calculate the new 'left' position for the button
    const newButtonLeft = targetButtonCenterXRelativeToContainer - (buttonRect.width / 2);

    playGameButton.style.left = `${newButtonLeft}px`;
    playGameButton.style.right = 'auto'; // Ensure right property is cleared

    // Make the button visible after positioning to avoid FOUC
    playGameButton.style.opacity = '1';
}

function setupCarousel() {
    const carousel = document.querySelector('.casual-games-carousel');
    const paginationContainer = document.querySelector('.carousel-pagination');
    const gameCards = document.querySelectorAll('.game-card');

    if (!carousel || !paginationContainer || gameCards.length === 0) {
        return;
    }

    // Create dots
    gameCards.forEach((_, index) => {
        const dot = document.createElement('button');
        dot.classList.add('dot');
        if (index === 0) {
            dot.classList.add('active');
        }
        dot.addEventListener('click', () => {
            scrollToCard(index);
        });
        paginationContainer.appendChild(dot);
    });

    const dots = paginationContainer.querySelectorAll('.dot');

    function scrollToCard(index) {
        carousel.scrollTo({
            left: gameCards[index].offsetLeft,
            behavior: 'smooth'
        });
    }

    function updatePagination() {
        const scrollLeft = carousel.scrollLeft;
        const cardWidth = gameCards[0].offsetWidth;
        const activeIndex = Math.round(scrollLeft / cardWidth);
        
        dots.forEach((dot, index) => {
            if (index === activeIndex) {
                dot.classList.add('active');
            } else {
                dot.classList.remove('active');
            }
        });
    }

    carousel.addEventListener('scroll', updatePagination);
}
