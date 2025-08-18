const STANDARD_ZOOM_LEVEL = 40; // Define the standard zoom level

const preloadedSounds = {}; // Object to store preloaded audio elements

function preloadGameSounds() {
    const soundsToPreload = [
        { name: 'click', path: 'assets/click.mp3' },
        { name: 'win', path: 'assets/win.mp3' },
        { name: 'lose', path: 'assets/lose.mp3' }
    ];

    soundsToPreload.forEach(sound => {
        const audio = new Audio(sound.path);
        audio.load(); // Start loading the audio
        preloadedSounds[sound.name] = audio;
    });
}


// Helper function to get all cells in a line between two points (Bresenham's-like algorithm)
function getCellsInLine(startIndex, endIndex, gridSize) {
    const cells = [];
    const startX = startIndex % gridSize;
    const startY = Math.floor(startIndex / gridSize);
    const endX = endIndex % gridSize;
    const endY = Math.floor(endIndex / gridSize);

    const dx = Math.abs(endX - startX);
    const dy = Math.abs(endY - startY);
    const sx = (startX < endX) ? 1 : -1;
    const sy = (startY < endY) ? 1 : -1;
    let err = dx - dy;

    let x = startX;
    let y = startY;

    while (true) {
        cells.push(y * gridSize + x);
        if (x === endX && y === endY) break;
        const e2 = 2 * err;
        if (e2 > -dy) {
            err -= dy;
            x += sx;
        }
        if (e2 < dx) {
            err += dx;
            y += sy;
        }
    }
    return cells;
}

function getCellFromCoordinates(e) {
    const point = e; // No longer need to check for e.touches
    return document.elementFromPoint(point.clientX, point.clientY);
}

function handlePaintingStart(e) {
    e.preventDefault();
    gameState.isPainting = true;
    const cellElement = getCellFromCoordinates(e)?.closest('.grid-cell');
    if (cellElement) {
        paintCell(cellElement);
        gameState.lastPaintedCellIndex = parseInt(cellElement.dataset.index);
    }
}

function handlePaintingMove(e) {
    e.preventDefault();
    if (!gameState.isPainting || !gameState.activeColor) return;
    
    const currentCellElement = getCellFromCoordinates(e)?.closest('.grid-cell');
    if (!currentCellElement) return;

    const currentCellIndex = parseInt(currentCellElement.dataset.index);

    if (gameState.lastPaintedCellIndex !== null && gameState.lastPaintedCellIndex !== currentCellIndex) {
        const cellsToPaint = getCellsInLine(gameState.lastPaintedCellIndex, currentCellIndex, gameState.currentMode);
        cellsToPaint.forEach(index => {
            const cellToPaint = gameState.gameGrid[index]?.element;
            if (cellToPaint) {
                paintCell(cellToPaint);
            }
        });
    } else if (gameState.lastPaintedCellIndex !== currentCellIndex) {
        paintCell(currentCellElement);
    }
    
    gameState.lastPaintedCellIndex = currentCellIndex;
}

function handlePaintingEnd(e) {
    e.preventDefault();
    gameState.isPainting = false;
    gameState.lastPaintedCellIndex = null;
}


function openGame() {
    console.log('openGame called!', 'gameState.isLoggedIn:', gameState.isLoggedIn);
    updateProfileDisplay(gameState.level);
    if (!gameState.isLoggedIn) {
        document.getElementById('playerInfoModal').style.display = 'block';
        showAuthTab('login');
    } else {
        document.getElementById('gameModal').style.display = 'block';
        showScreen('mainMenu');
        const playerAvatar = document.querySelector('#gameModal .profile-logo');
        if (playerAvatar) {
            if (gameState.level > 0) {
                playerAvatar.className = `profile-logo level-${gameState.level}-border`;
            } else {
                playerAvatar.className = 'profile-logo'; // No border for level 0
            }
            console.log('Game screen player avatar class:', playerAvatar.className);
        }
    }
    document.body.classList.add('no-scroll');
}

function closeGame() {
    document.getElementById('gameModal').style.display = 'none';
    document.getElementById('chatModal').style.display = 'none';
    resetGame();
    document.body.classList.remove('no-scroll');
}

function selectMode(size) {
    gameState.currentMode = size;

    generateGameGrid(size);
    showScreen('gameScreen');
    resetTimer();
    startMemoryTimer();
}

function generateGameGrid(size) {
    const gameGrid = document.getElementById('gameGrid');
    gameGrid.innerHTML = '';
    gameGrid.style.gridTemplateColumns = `repeat(${size}, 1fr)`;

    let cellSize = gameState.zoomLevel;
    if (size >= 10) cellSize = 22;
    if (size >= 20) cellSize = 16;
    gameGrid.style.setProperty('--cell-size', `${cellSize}px`);
    gameGrid.style.gap = size >= 10 ? '1px' : '2px';

    gameState.gameGrid = [];
    gameState.originalColors = [];
    gameState.totalCellsToMatch = size * size;

    const numColors = 3;
    const selectedColors = gameColors.slice(0, numColors);
    const colorDistribution = [];
    for (let i = 0; i < size * size; i++) {
        colorDistribution.push(selectedColors[i % selectedColors.length]);
    }
    for (let i = colorDistribution.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [colorDistribution[i], colorDistribution[j]] = [colorDistribution[j], colorDistribution[i]];
    }
    gameState.originalColors = colorDistribution;

    const fragment = document.createDocumentFragment(); // Use DocumentFragment

    for (let i = 0; i < size * size; i++) {
        const cell = document.createElement('div');
        cell.className = 'grid-cell';
        cell.style.backgroundColor = gameState.originalColors[i];
        cell.dataset.index = i;
        cell.dataset.originalColor = gameState.originalColors[i];
        
        fragment.appendChild(cell); // Append to fragment
        gameState.gameGrid.push({
            originalColor: gameState.originalColors[i],
            currentColor: gameState.originalColors[i],
            isCorrect: false,
            element: cell
        });
    }
    gameGrid.appendChild(fragment); // Append fragment to DOM once

    // Event Delegation for painting using Pointer Events
    gameGrid.addEventListener('pointerdown', handlePaintingStart);
    gameGrid.addEventListener('pointermove', handlePaintingMove);

    // Global listeners for stopping painting
    document.addEventListener('pointerup', handlePaintingEnd);
    document.addEventListener('pointercancel', handlePaintingEnd);
    gameGrid.addEventListener('mouseleave', handlePaintingEnd);


    gameState.gameStarted = false;
    gameState.gameCompleted = false;
    gameState.memoryPhase = true;
    gameState.memoryElapsedTime = 0;
    gameState.matchingElapsedTime = 0;
    gameState.correctMatches = 0;
    gameState.cellsFilledCount = 0;
    gameState.activeColor = null;

    document.getElementById('memoryTimerDisplay').textContent = '0';
    document.getElementById('matchingTimerDisplay').textContent = '0';
    document.getElementById('startBtn').disabled = false;
    document.getElementById('startBtn').textContent = 'Start Matching';
    document.getElementById('gameMessage').textContent = '';
    document.getElementById('colorPalette').innerHTML = '';
    document.getElementById('colorPalette').style.display = 'none';

    document.querySelectorAll('.color-swatch').forEach(swatch => {
        swatch.classList.remove('active');
    });
    gameState.lastPaintedCellIndex = null;
}

function startGame() {
    if (gameState.gameStarted) return;
    gameState.gameStarted = true;
    gameState.memoryPhase = false;
    clearInterval(gameState.memoryTimer);
    document.getElementById('memoryTimerDisplay').textContent = gameState.memoryElapsedTime.toFixed(1);

    gameState.gameGrid.forEach(cell => {
        cell.element.style.backgroundColor = '#333';
        cell.currentColor = '#333';
        cell.isCorrect = false;
        cell.element.classList.remove('correct-feedback');
    });

    document.getElementById('startBtn').disabled = true;
    document.getElementById('startBtn').textContent = 'Matching...';
    document.getElementById('gameMessage').textContent = window.getTranslation('gameMessageMatchColors');
    startMatchingTimer();
    createColorPalette();
}

function startMemoryTimer() {
    gameState.startTime = Date.now();
    gameState.memoryTimer = setInterval(() => {
        gameState.memoryElapsedTime = (Date.now() - gameState.startTime) / 1000;
        document.getElementById('memoryTimerDisplay').textContent = gameState.memoryElapsedTime.toFixed(1);
    }, 100);
}

function startMatchingTimer() {
    gameState.startTime = Date.now();
    gameState.matchingTimer = setInterval(() => {
        gameState.matchingElapsedTime = (Date.now() - gameState.startTime) / 1000;
        document.getElementById('matchingTimerDisplay').textContent = gameState.matchingElapsedTime.toFixed(1);
    }, 100);
}

function resetTimer() {
    if (gameState.memoryTimer) clearInterval(gameState.memoryTimer);
    if (gameState.matchingTimer) clearInterval(gameState.matchingTimer);
    gameState.memoryTimer = null;
    gameState.matchingTimer = null;
    gameState.memoryElapsedTime = 0;
    gameState.matchingElapsedTime = 0;
    document.getElementById('memoryTimerDisplay').textContent = '0';
    document.getElementById('matchingTimerDisplay').textContent = '0';
}

function paintCell(cell) {
    if (!cell || !cell.dataset.index) return;

    const cellIndex = parseInt(cell.dataset.index);
    const cellState = gameState.gameGrid[cellIndex];

    if (gameState.memoryPhase || gameState.gameCompleted || cellState.isCorrect) return;

    if (gameState.activeColor) {
        if (cellState.currentColor === '#333') {
            gameState.cellsFilledCount++;
        }

        cell.style.backgroundColor = gameState.activeColor;
        cellState.currentColor = gameState.activeColor;
        playSound('click', 'mp3');

        if (cellState.currentColor === cellState.originalColor) {
            cellState.isCorrect = true;
            cell.classList.add('correct-feedback');
            cell.classList.remove('incorrect-feedback');
            gameState.correctMatches++;
        } else {
            cellState.isCorrect = false;
            cell.classList.remove('correct-feedback');
            cell.classList.add('incorrect-feedback');
            setTimeout(() => {
                cell.classList.remove('incorrect-feedback');
            }, 500);
        }

        if (gameState.cellsFilledCount === gameState.totalCellsToMatch) {
            checkGameCompletion();
        }
    } else {
        document.getElementById('gameMessage').textContent = window.getTranslation('gameMessageSelectColorFirst');
    }
}

function setActiveColor(color) {
    gameState.activeColor = color;
    document.querySelectorAll('.color-swatch').forEach(swatch => {
        swatch.classList.remove('active');
    });
    document.querySelector(`.color-swatch[data-color="${color}"]`).classList.add('active');
    document.getElementById('gameMessage').textContent = window.getTranslation('gameMessageApplyColor');
}

function createColorPalette() {
    const colorPaletteContainer = document.getElementById('colorPalette');
    colorPaletteContainer.innerHTML = '';
    const uniqueColors = [...new Set(gameState.originalColors)];
    gameState.availableColors = uniqueColors; // Store unique colors in gameState

    uniqueColors.forEach(color => {
        const colorSwatch = document.createElement('div');
        colorSwatch.className = 'color-swatch';
        colorSwatch.style.backgroundColor = color;
        colorSwatch.dataset.color = color;
        colorSwatch.addEventListener('click', () => setActiveColor(color));
        colorPaletteContainer.appendChild(colorSwatch);
    });

    colorPaletteContainer.style.display = 'flex';

    // --- START: Swipe Functionality for Color Palette ---
    let touchStartX = 0;
    let touchEndX = 0;
    const swipeThreshold = 50; // Minimum distance for a swipe

    colorPaletteContainer.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    colorPaletteContainer.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    }, { passive: true });

    function handleSwipe() {
        if (!gameState.activeColor) return; // Don't swipe if no color is active

        const currentActiveColorIndex = gameState.availableColors.indexOf(gameState.activeColor);
        if (currentActiveColorIndex === -1) return;

        let nextColorIndex = currentActiveColorIndex;

        // Swipe Left
        if (touchStartX - touchEndX > swipeThreshold) {
            nextColorIndex = (currentActiveColorIndex + 1) % gameState.availableColors.length;
        }
        // Swipe Right
        else if (touchEndX - touchStartX > swipeThreshold) {
            nextColorIndex = (currentActiveColorIndex - 1 + gameState.availableColors.length) % gameState.availableColors.length;
        }

        if (nextColorIndex !== currentActiveColorIndex) {
            setActiveColor(gameState.availableColors[nextColorIndex]);
        }
    }
    // --- END: Swipe Functionality for Color Palette ---
}

function checkGameCompletion() {
    gameState.gameCompleted = true;
    clearInterval(gameState.matchingTimer);

    const score = calculateScore();
    const isWin = gameState.correctMatches === gameState.totalCellsToMatch;

    if (isWin) {
        saveScore(score);
    }

    setTimeout(() => {
        showGameOverScreen(isWin, score);
    }, 1500);
}

function showGameOverScreen(isWin, score) {
    gameState.lastGameScore = isWin ? score : 0;
    gameState.lastGameMode = `${gameState.currentMode}x${gameState.currentMode}`;
    gameState.lastGameAccuracy = `${gameState.correctMatches} / ${gameState.totalCellsToMatch}`;
    gameState.lastGameTime = `${gameState.matchingElapsedTime.toFixed(1)}s`;

    document.getElementById('gameOverTitle').textContent = isWin ? 'WIN' : 'LOSE';
    const gameOverTitleElement = document.getElementById('gameOverTitle');

    gameOverTitleElement.classList.remove('win', 'lose');

    if (isWin) {
        gameOverTitleElement.classList.add('win');
        playSound('win', 'mp3');
    } else {
        gameOverTitleElement.classList.add('lose');
        playSound('lose', 'mp3');
    }
    document.getElementById('statMode').textContent = gameState.lastGameMode;
    document.getElementById('statScore').textContent = gameState.lastGameScore;
    document.getElementById('statAccuracy').textContent = gameState.lastGameAccuracy;
    document.getElementById('statTime').textContent = gameState.lastGameTime;
    showScreen('gameOverScreen');

    document.querySelector('[data-action="restartGame"]').onclick = restartGame;
    document.querySelector('[data-action="showLeaderboard"]').onclick = showLeaderboard;
    document.querySelector('[data-action="shareScoreToX"]').onclick = shareScoreToX;
}

function restartGame() {
    selectMode(gameState.currentMode);
}

function shareScoreToX() {
    // More dynamic and engaging text
    const text = `Just crushed it in CIPHER! My score: ${gameState.lastGameScore} in ${gameState.lastGameMode} mode with ${gameState.lastGameAccuracy} accuracy. Challenge your memory and represent your country!`;
    const hashtags = "CIPHER";
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&hashtags=${hashtags}`;

    // 1. Populate the hidden share image template
    const shareImageTemplate = document.getElementById('shareImageTemplate');
    shareImageTemplate.style.backgroundImage = `url('assets/share_background.jpg')`;
    
    // --- User Info ---
    document.getElementById('shareAvatar').src = gameState.avatarUrl || 'assets/logo.jpg';
    document.getElementById('shareUsername').textContent = gameState.username;

    // Explicitly set position for #CIPHER hashtag before rendering
    const shareHashtag = shareImageTemplate.querySelector('.share-hashtag');
    if (shareHashtag) {
        shareHashtag.style.position = 'absolute';
        shareHashtag.style.top = '10px'; // Adjust as needed
        shareHashtag.style.right = '10px'; // Adjust as needed
    }
    const shareCountryElement = document.getElementById('shareCountry');
    const countryInfo = countries[gameState.playerCountry];
    if (countryInfo) {
        shareCountryElement.innerHTML = `<img src="${countryInfo.flag}" alt="${countryInfo.name} Flag"> ${countryInfo.name}`;
    } else {
        shareCountryElement.innerHTML = '';
    }

    // --- Stats Grid ---
    const statsGrid = shareImageTemplate.querySelector('.stats-grid-container');
    statsGrid.innerHTML = `
        <div class="stat-item-box">
            <h3>Mode</h3>
            <p>${gameState.lastGameMode}</p>
        </div>
        <div class="stat-item-box">
            <h3>Score</h3>
            <p>${gameState.lastGameScore}</p>
        </div>
        <div class="stat-item-box">
            <h3>Accuracy</h3>
            <p>${gameState.lastGameAccuracy}</p>
        </div>
        <div class="stat-item-box">
            <h3>Time</h3>
            <p>${gameState.lastGameTime}</p>
        </div>
    `;

    // --- Tagline ---
    const taglineElement = shareImageTemplate.querySelector('.tagline');
    taglineElement.textContent = "Can you beat my score?";


    // Temporarily make the template visible for html2canvas to render correctly
    shareImageTemplate.style.display = 'flex'; // Use flex as defined in CSS

    html2canvas(shareImageTemplate, {
        scale: 2,
        useCORS: true,
        backgroundColor: null,
        logging: false // Suppress html2canvas logging in console
    }).then(canvas => {
        shareImageTemplate.style.display = 'none'; // Hide it again

        const imageUrl = canvas.toDataURL('image/png');

        const shareConfirmationModal = document.getElementById('shareConfirmationModal');
        const scorePreviewImage = document.getElementById('scorePreviewImage');
        scorePreviewImage.src = imageUrl;
        shareConfirmationModal.style.display = 'block';
        document.body.classList.add('no-scroll');

        const downloadAndShareBtn = document.getElementById('downloadAndShareBtn');
        downloadAndShareBtn.onclick = () => {
            const downloadLink = document.createElement('a');
            downloadLink.href = imageUrl;
            downloadLink.download = `CIPHER_Score_${gameState.username}_${gameState.lastGameScore}.png`;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);

            window.open(twitterUrl, '_blank');

            shareConfirmationModal.style.display = 'none';
            document.body.classList.remove('no-scroll');
        };

        const cancelShareBtn = document.getElementById('cancelShareBtn');
        cancelShareBtn.onclick = () => {
            shareConfirmationModal.style.display = 'none';
            document.body.classList.remove('no-scroll');
        };

        const closeModalBtn = shareConfirmationModal.querySelector('.close-game');
        closeModalBtn.onclick = () => {
            shareConfirmationModal.style.display = 'none';
            document.body.classList.remove('no-scroll');
        };

    }).catch(error => {
        shareImageTemplate.style.display = 'none'; // Hide it again in case of error
        console.error('Error capturing game over screen:', error);
        showNotification('Could not capture game screen. Sharing text only.', 'error');
        window.open(twitterUrl, '_blank'); // Fallback to text-only tweet
    });
}

function calculateScore() {
    const modeSize = gameState.currentMode;
    const maxBaseScore = (modeSize === 2) ? 2 : (modeSize * modeSize);

    const accuracyFactor = (gameState.correctMatches / gameState.totalCellsToMatch);
    const scoreFromAccuracy = maxBaseScore * accuracyFactor;

    const totalTime = gameState.memoryElapsedTime + gameState.matchingElapsedTime;
    const timePenalty = totalTime * modeSize * 0.1;

    let finalScore = Math.round(scoreFromAccuracy - timePenalty);
    return Math.max(finalScore, 0);
}

async function saveScore(score) {
    if (!gameState.isLoggedIn) {
        console.error("Cannot save score: User not logged in.");
        showNotification("Please log in to save your score.", 'info');
        return;
    }
    const clientGameId = `game_${gameState.username}_${Date.now()}`; // Create a unique ID for the game session
    const scoreEntry = {
        score: score,
        mode: `${gameState.currentMode}x${gameState.currentMode}`,
        memoryTime: gameState.memoryElapsedTime,
        matchingTime: gameState.matchingElapsedTime,
        clientGameId: clientGameId // Send the unique ID to the server
    };
    try {
        const response = await apiRequest('/api/scores', 'POST', scoreEntry);
        console.log('[DEBUG] Score saved successfully. API Response:', response);
        
        // Update gameState and localStorage with the new level from the server
        if (response.newLevel !== undefined) {
            gameState.level = response.newLevel;
            localStorage.setItem('level', response.newLevel);
            updateProfileDisplay(gameState.level); // Update UI elements that show level
            console.log('[DEBUG] gameState.level updated to:', gameState.level);
        }

    } catch (error) {
        console.error('Failed to save score:', error);
        showNotification(`Failed to save score: ${error.message}`, 'error');
    }
}

function resetGame() {
    clearInterval(gameState.memoryTimer);
    clearInterval(gameState.matchingTimer);
    gameState.gameStarted = false;
    gameState.gameCompleted = false;
    gameState.memoryPhase = true;
    gameState.memoryElapsedTime = 0;
    gameState.matchingElapsedTime = 0;
    gameState.gameGrid = [];
    gameState.originalColors = [];
    gameState.correctMatches = 0;
    gameState.totalCellsToMatch = 0;
    gameState.cellsFilledCount = 0;
    gameState.activeColor = null;
    gameState.lastPaintedCellIndex = null;
    document.getElementById('memoryTimerDisplay').textContent = '0';
    document.getElementById('matchingTimerDisplay').textContent = '0';
    document.getElementById('startBtn').disabled = false;
    document.getElementById('startBtn').textContent = 'Start Matching';
    document.getElementById('gameMessage').textContent = '';
    document.getElementById('colorPalette').innerHTML = '';
    document.getElementById('colorPalette').style.display = 'none';
    document.getElementById('gameGrid').innerHTML = '';
    document.querySelectorAll('.color-swatch').forEach(swatch => {
        swatch.classList.remove('active');
    });
    const gameResultOverlayElement = document.getElementById('gameResultOverlay');
    if (gameResultOverlayElement) {
        gameResultOverlayElement.classList.remove('win-active', 'lose-active');
    }
}

function backToMenu() {
    resetGame();
    document.getElementById('chatModal').style.display = 'none'; // Chat modalını kapat
    showScreen('mainMenu');
}

// --- Game Area Control Functions ---

function zoomIn() {
    const gameGrid = document.getElementById('gameGrid');
    let currentSize = parseInt(getComputedStyle(gameGrid).getPropertyValue('--cell-size'));
    let newSize = Math.min(currentSize + 2, 60);
    gameGrid.style.setProperty('--cell-size', `${newSize}px`);
    gameState.zoomLevel = newSize;
    localStorage.setItem('zoomLevel', newSize);
    updateZoomButtonStates();
}

function zoomOut() {
    const gameGrid = document.getElementById('gameGrid');
    let currentSize = parseInt(getComputedStyle(gameGrid).getPropertyValue('--cell-size'));
    let newSize = Math.max(currentSize - 2, 10);
    gameGrid.style.setProperty('--cell-size', `${newSize}px`);
    gameState.zoomLevel = newSize;
    localStorage.setItem('zoomLevel', newSize);
    updateZoomButtonStates();
}

function updateZoomButtonStates() {
    const zoomInBtn = document.getElementById('zoomInBtn');
    const zoomOutBtn = document.getElementById('zoomOutBtn');

    if (gameState.zoomLevel > STANDARD_ZOOM_LEVEL) {
        zoomInBtn.classList.add('active');
        zoomOutBtn.classList.remove('active');
    } else if (gameState.zoomLevel < STANDARD_ZOOM_LEVEL) {
        zoomOutBtn.classList.add('active');
        zoomInBtn.classList.remove('active');
    } else { // At standard zoom level
        zoomInBtn.classList.remove('active');
        zoomOutBtn.classList.remove('active');
    }
}

function toggleSound() {
    gameState.isSoundMuted = !gameState.isSoundMuted;
    localStorage.setItem('isSoundMuted', gameState.isSoundMuted);
    applySoundSetting();
}

function applySoundSetting() {
    const soundIcon = document.querySelector('#toggleSoundBtn i');
    const toggleSoundBtn = document.getElementById('toggleSoundBtn');
    if (gameState.isSoundMuted) {
        soundIcon.classList.remove('fa-volume-up');
        soundIcon.classList.add('fa-volume-mute');
        toggleSoundBtn.title = "Unmute Sound";
        toggleSoundBtn.classList.remove('active');
    } else {
        soundIcon.classList.remove('fa-volume-mute');
        soundIcon.classList.add('fa-volume-up');
        toggleSoundBtn.title = "Mute Sound";
        toggleSoundBtn.classList.add('active');
    }
}

function applyStoredSettings() {
    const storedZoomLevel = localStorage.getItem('zoomLevel');
    if (storedZoomLevel) {
        gameState.zoomLevel = parseInt(storedZoomLevel);
        const gameGrid = document.getElementById('gameGrid');
        gameGrid.style.setProperty('--cell-size', `${gameState.zoomLevel}px`);
    } else {
        gameState.zoomLevel = STANDARD_ZOOM_LEVEL; // Set to standard if no stored value
    }
    updateZoomButtonStates(); // Apply initial zoom button states

    const storedSoundMuted = localStorage.getItem('isSoundMuted');
    if (storedSoundMuted !== null) { // Check for null to differentiate from 'false'
        gameState.isSoundMuted = storedSoundMuted === 'true';
    }
    applySoundSetting(); // Apply initial sound setting and button state
}

// Event listeners for the new controls
document.addEventListener('DOMContentLoaded', () => {
    applyStoredSettings();

    const zoomInBtn = document.getElementById('zoomInBtn');
    const zoomOutBtn = document.getElementById('zoomOutBtn');
    const resetBoardBtn = document.getElementById('resetBoardBtn');

    const stopZoom = () => {
        clearInterval(gameState.zoomInInterval);
        clearInterval(gameState.zoomOutInterval);
        gameState.zoomInInterval = null;
        gameState.zoomOutInterval = null;
    };

    zoomInBtn.addEventListener('mousedown', () => {
        zoomIn(); // Initial zoom on click
        gameState.zoomInInterval = setInterval(zoomIn, 100); // Continuous zoom
    });

    zoomOutBtn.addEventListener('mousedown', () => {
        zoomOut(); // Initial zoom on click
        gameState.zoomOutInterval = setInterval(zoomOut, 100); // Continuous zoom
    });

    zoomInBtn.addEventListener('mouseup', stopZoom);
    zoomInBtn.addEventListener('mouseleave', stopZoom);
    zoomOutBtn.addEventListener('mouseup', stopZoom);
    zoomOutBtn.addEventListener('mouseleave', stopZoom);

    document.getElementById('toggleSoundBtn').addEventListener('click', toggleSound);

    if (resetBoardBtn) {
        resetBoardBtn.addEventListener('click', () => {
            selectMode(gameState.currentMode);
        });
    }

    // Add wheel event listener for color selection
    document.addEventListener('wheel', (event) => {
        if (!gameState.gameStarted || gameState.memoryPhase || !gameState.activeColor) {
            return; // Only allow color change during matching phase and if a color is active
        }

        event.preventDefault(); // Prevent page scrolling

        const currentActiveColorIndex = gameState.availableColors.indexOf(gameState.activeColor);
        let nextColorIndex = currentActiveColorIndex;

        if (event.deltaY < 0) {
            // Wheel up, go to previous color
            nextColorIndex = (currentActiveColorIndex - 1 + gameState.availableColors.length) % gameState.availableColors.length;
        } else {
            // Wheel down, go to next color
            nextColorIndex = (currentActiveColorIndex + 1) % gameState.availableColors.length;
        }

        setActiveColor(gameState.availableColors[nextColorIndex]);
    }, { passive: false });
});
