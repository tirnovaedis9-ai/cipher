const STANDARD_ZOOM_LEVEL = 40; // Define the standard zoom level

const preloadedSounds = {}; // Object to store preloaded audio elements

const levelBorderColors = {
    1: { color: '#FFCCCC', shadow: 'rgba(255, 204, 204, 0.5)' }, // Faded Red
    2: { color: '#FF9999', shadow: 'rgba(255, 153, 153, 0.5)' },
    3: { color: '#FF6666', shadow: 'rgba(255, 102, 102, 0.5)' },
    4: { color: '#FF3333', shadow: 'rgba(255, 51, 51, 0.5)' },
    5: { color: '#FF0000', shadow: 'rgba(255, 0, 0, 0.5)' }, // Pure Red
    6: { color: '#CC0000', shadow: 'rgba(204, 0, 0, 0.5)' },
    7: { color: '#990000', shadow: 'rgba(153, 0, 0, 0.5)' },
    8: { color: '#660000', shadow: 'rgba(102, 0, 0, 0.5)' },
    9: { color: '#330000', shadow: 'rgba(51, 0, 0, 0.5)' }, // Vibrant Red
    10: { color: '#FF0000', shadow: 'rgba(255, 0, 0, 0.7)' } // Vibrant Red for Level 10 fallback
};

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
    if (window.IS_DEVELOPMENT) { // Check if in development mode
        console.log('openGame called!', 'gameState.isLoggedIn:', gameState.isLoggedIn);
    }
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
                playerAvatar.className = 'profile-logo no-border'; // No border for level 0
            }
            if (window.IS_DEVELOPMENT) {
                console.log('Game screen player avatar class:', playerAvatar.className);
            }
        }
    }
    document.body.classList.add('no-scroll');
}

function closeGame() {
    // Restore the game container's scrollbar when closing the modal.
    const gameContainer = document.querySelector('#gameModal .game-container');
    if (gameContainer) {
        gameContainer.style.overflowY = 'auto';
    }
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
    document.getElementById('startBtn').textContent = getTranslation('startMatching');
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
    document.getElementById('startBtn').textContent = getTranslation('matching');
    
    // Hide game message for users who have played 10 or more games
    if (gameState.gamecount && gameState.gamecount >= 10) {
        document.getElementById('gameMessage').textContent = '';
    } else {
        document.getElementById('gameMessage').textContent = window.getTranslation('gameMessageMatchColors');
    }
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
        if (gameState.gamecount && gameState.gamecount >= 10) {
            document.getElementById('gameMessage').textContent = '';
        } else {
            document.getElementById('gameMessage').textContent = window.getTranslation('gameMessageSelectColorFirst');
        }
    }
}

function setActiveColor(color) {
    gameState.activeColor = color;
    document.querySelectorAll('.color-swatch').forEach(swatch => {
        swatch.classList.remove('active');
    });
    document.querySelector(`.color-swatch[data-color="${color}"]`).classList.add('active');
    if (gameState.gamecount && gameState.gamecount >= 10) {
        document.getElementById('gameMessage').textContent = '';
    } else {
        document.getElementById('gameMessage').textContent = window.getTranslation('gameMessageApplyColor');
    }
}

function createColorPalette() {
    const colorPaletteContainer = document.getElementById('colorPalette');
    colorPaletteContainer.innerHTML = '';
    const fixedPaletteColors = ['#FF0000', '#FFFF00', '#0000FF']; // Red, Yellow, Blue
    gameState.availableColors = fixedPaletteColors; // Store fixed colors in gameState for palette

    fixedPaletteColors.forEach(color => {
        const colorSwatch = document.createElement('div');
        colorSwatch.className = 'color-swatch';
        colorSwatch.style.backgroundColor = color;
        colorSwatch.dataset.color = color;
        colorSwatch.addEventListener('click', () => setActiveColor(color));
        colorPaletteContainer.appendChild(colorSwatch);
    });

    colorPaletteContainer.style.display = 'flex';

    // Automatically select the middle color from the fixed palette
    if (fixedPaletteColors.length > 0) {
        const middleIndex = Math.floor(fixedPaletteColors.length / 2);
        setActiveColor(fixedPaletteColors[middleIndex]);
    }

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

async function checkGameCompletion() {
    gameState.gameCompleted = true;
    clearInterval(gameState.matchingTimer);

    const score = calculateScore();
    const isWin = gameState.correctMatches === gameState.totalCellsToMatch;

    if (isWin) {
        await saveScore(score);
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

    document.getElementById('gameOverTitle').textContent = isWin ? getTranslation('gameResultWin') : getTranslation('gameResultLose');
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
        if (window.IS_DEVELOPMENT) {
            console.log('[DEBUG] Score saved successfully. API Response:', response);
        }
        
        // Update gameState and localStorage with the new level from the server
        if (response.newLevel !== undefined) {
            gameState.level = response.newLevel;
            localStorage.setItem('level', response.newLevel);
            updateProfileDisplay(gameState.level); // Update UI elements that show level
            if (window.IS_DEVELOPMENT) {
                console.log('[DEBUG] gameState.level updated to:', gameState.level);
            }
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
    document.getElementById('startBtn').textContent = getTranslation('startMatching');
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
    // Restore the game container's scrollbar when leaving the leaderboard or other screens.
    const gameContainer = document.querySelector('#gameModal .game-container');
    if (gameContainer) {
        gameContainer.style.overflowY = 'auto';
    }
    resetGame();
    document.getElementById('chatModal').style.display = 'none'; // Chat modalını kapat
    showScreen('mainMenu');
}

// --- Game Area Control Functions ---

function zoomIn() {
    const gameGrid = document.getElementById('gameGrid');
    let currentSize = parseInt(getComputedStyle(gameGrid).getPropertyValue('--cell-size'));
    let newSize = Math.min(currentSize + 3, 60);
    gameGrid.style.setProperty('--cell-size', `${newSize}px`);
    gameState.zoomLevel = newSize;
    localStorage.setItem('zoomLevel', newSize);
    updateZoomButtonStates();
}

function zoomOut() {
    const gameGrid = document.getElementById('gameGrid');
    let currentSize = parseInt(getComputedStyle(gameGrid).getPropertyValue('--cell-size'));
    let newSize = Math.max(currentSize - 3, 10);
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
    // Select all sound toggle buttons
    const toggleSoundBtns = document.querySelectorAll('#toggleSoundBtn');

    toggleSoundBtns.forEach(btn => {
        const soundIcon = btn.querySelector('i');
        if (gameState.isSoundMuted) {
            soundIcon.classList.remove('fa-volume-up');
            soundIcon.classList.add('fa-volume-mute');
            btn.title = "Unmute Sound";
            btn.classList.remove('active'); // White when muted
        } else {
            soundIcon.classList.remove('fa-volume-mute');
            soundIcon.classList.add('fa-volume-up');
            btn.title = "Mute Sound";
            btn.classList.add('active'); // Blue when unmuted
        }
    });
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

    // Select all instances of the buttons by their IDs
    const zoomInBtns = document.querySelectorAll('#zoomInBtn');
    const zoomOutBtns = document.querySelectorAll('#zoomOutBtn');
    const resetBoardBtns = document.querySelectorAll('#resetBoardBtn');
    const toggleSoundBtns = document.querySelectorAll('#toggleSoundBtn');

    const stopZoom = () => {
        clearInterval(gameState.zoomInInterval);
        clearInterval(gameState.zoomOutInterval);
        gameState.zoomInInterval = null;
        gameState.zoomOutInterval = null;
    };

    // Attach event listeners to all zoomIn buttons
    zoomInBtns.forEach(btn => {
        btn.addEventListener('mousedown', () => {
            zoomIn();
            gameState.zoomInInterval = setInterval(zoomIn, 100);
        });
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            zoomIn();
            gameState.zoomInInterval = setInterval(zoomIn, 100);
        }, { passive: false });
        btn.addEventListener('mouseup', stopZoom);
        btn.addEventListener('mouseleave', stopZoom);
        btn.addEventListener('touchend', stopZoom);
        btn.addEventListener('touchcancel', stopZoom);
    });

    // Attach event listeners to all zoomOut buttons
    zoomOutBtns.forEach(btn => {
        btn.addEventListener('mousedown', () => {
            zoomOut();
            gameState.zoomOutInterval = setInterval(zoomOut, 100);
        });
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            zoomOut();
            gameState.zoomOutInterval = setInterval(zoomOut, 100);
        }, { passive: false });
        btn.addEventListener('mouseup', stopZoom);
        btn.addEventListener('mouseleave', stopZoom);
        btn.addEventListener('touchend', stopZoom);
        btn.addEventListener('touchcancel', stopZoom);
    });

    // Attach event listeners to all toggleSound buttons
    toggleSoundBtns.forEach(btn => {
        btn.addEventListener('click', toggleSound);
    });

    // Attach event listeners to all resetBoard buttons
    resetBoardBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            selectMode(gameState.currentMode);
        });
    });

    document.addEventListener('wheel', (event) => {
        // Only allow color change during the matching phase on the actual game screen.
        if (gameState.currentScreen !== 'gameScreen' || !gameState.gameStarted || gameState.memoryPhase || !gameState.activeColor) {
            return; 
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

    document.addEventListener('keydown', (event) => {
        // Start game with Spacebar
        if (event.code === 'Space' && !gameState.gameStarted && gameState.memoryPhase) {
            event.preventDefault(); // Prevent default spacebar action (e.g., scrolling)
            startGame();
        }

        // Switch colors with 1, 2, 3 keys
        if (gameState.currentScreen === 'gameScreen' && gameState.gameStarted && !gameState.memoryPhase) {
            const colorMap = {
                'Digit1': 0, // Key '1'
                'Digit2': 1, // Key '2'
                'Digit3': 2  // Key '3'
            };

            const colorIndex = colorMap[event.code];
            if (colorIndex !== undefined && gameState.availableColors && gameState.availableColors[colorIndex]) {
                event.preventDefault(); // Prevent default action for number keys if any
                setActiveColor(gameState.availableColors[colorIndex]);
            }
        }

        // Refresh board with 'R' key
        if (event.code === 'KeyR' && gameState.currentScreen === 'gameScreen') {
            event.preventDefault();
            selectMode(gameState.currentMode);
        }
    });
});
