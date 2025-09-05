document.addEventListener('DOMContentLoaded', () => {
    const cetrisPlayBtn = document.querySelector('[data-game-target="cetris-game-container"]');
    const cetrisGameContainer = document.getElementById('cetris-game-container');
    const casualGameSelection = document.getElementById('casual-game-selection');
    const casualGamesBackBtn = document.getElementById('casualGamesBackBtn');

    // Cetris Game Variables
    const canvas = document.getElementById('cetrisCanvas');
    const ctx = canvas.getContext('2d');
    const scoreDisplay = document.getElementById('cetris-score');
    const levelDisplay = document.getElementById('cetris-level');
    const gameOverScreen = document.querySelector('.cetris-game-over-screen');
    const finalScoreDisplay = document.getElementById('cetris-final-score');
    const playAgainBtn = document.getElementById('cetris-play-again-btn');
    const cetrisCanvasWrapper = document.getElementById('cetris-canvas-wrapper'); // Get the wrapper

    const BOARD_WIDTH = 15;
    const BOARD_HEIGHT = 15;
    const BLOCK_SIZE = 20; // Fixed block size for 400x400 wrapper

    let board = [];
    let currentPiece;
    let nextPiece;
    let score = 0;
    let level = 1;
    let dropInterval = 1000; // Milliseconds
    let gameLoop;
    let isGameOver = false;

    // Tetromino shapes (J, L, O, S, I, T, Z)
    const TETROMINOES = [
        // J
        [[0, 1, 0],
         [0, 1, 0],
         [1, 1, 0]],
        // L
        [[0, 1, 0],
         [0, 1, 0],
         [0, 1, 1]],
        // O
        [[1, 1],
         [1, 1]],
        // S
        [[0, 1, 1],
         [1, 1, 0],
         [0, 0, 0]],
        // I
        [[0, 0, 0, 0],
         [1, 1, 1, 1],
         [0, 0, 0, 0],
         [0, 0, 0, 0]],
        // T
        [[0, 1, 0],
         [1, 1, 1],
         [0, 0, 0]],
        // Z
        [[1, 1, 0],
         [0, 1, 1],
         [0, 0, 0]]
    ];

    const COLORS = [
        '#F44336', // Red
        '#FFEB3B', // Yellow
        '#2196F3'  // Blue
    ];

    // Function to resize canvas and calculate BLOCK_SIZE
    function resizeCanvasAndCalculateBlockSize() {
        canvas.width = 300;
        canvas.height = 300;
    }

    function initBoard() {
        for (let row = 0; row < BOARD_HEIGHT; row++) {
            board[row] = [];
            for (let col = 0; col < BOARD_WIDTH; col++) {
                board[row][col] = 0; // 0 represents empty
            }
        }
    }

    function createPiece() {
        const randIndex = Math.floor(Math.random() * TETROMINOES.length);
        const shape = TETROMINOES[randIndex];
        const color = COLORS[Math.floor(Math.random() * COLORS.length)]; // Random color from limited set
        return {
            shape: shape,
            color: color,
            x: Math.floor(BOARD_WIDTH / 2) - Math.floor(shape[0].length / 2),
            y: 0
        };
    }

    function drawBlock(x, y, color) {
        ctx.fillStyle = color;
        ctx.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
        ctx.strokeStyle = '#333';
        ctx.strokeRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear canvas

        // Draw board
        for (let row = 0; row < BOARD_HEIGHT; row++) {
            for (let col = 0; col < BOARD_WIDTH; col++) {
                if (board[row][col] !== 0) {
                    drawBlock(col, row, board[row][col]);
                }
            }
        }

        // Draw current piece
        if (currentPiece) {
            for (let row = 0; row < currentPiece.shape.length; row++) {
                for (let col = 0; col < currentPiece.shape[row].length; col++) {
                    if (currentPiece.shape[row][col] !== 0) {
                        drawBlock(currentPiece.x + col, currentPiece.y + row, currentPiece.color);
                    }
                }
            }
        }
    }

    function isValidMove(piece, offsetX, offsetY, newShape) {
        for (let row = 0; row < newShape.length; row++) {
            for (let col = 0; col < newShape[row].length; col++) {
                if (newShape[row][col] !== 0) {
                    const boardX = piece.x + col + offsetX;
                    const boardY = piece.y + row + offsetY;

                    if (boardX < 0 || boardX >= BOARD_WIDTH || boardY >= BOARD_HEIGHT) {
                        return false; // Out of bounds
                    }
                    if (boardY < 0) { // Allow pieces to spawn partially above board
                        continue;
                    }
                    if (board[boardY][boardX] !== 0) {
                        return false; // Collision with existing block
                    }
                }
            }
        }
        return true;
    }

    function rotate(piece) {
        const newShape = piece.shape[0].map((val, index) => piece.shape.map(row => row[index]).reverse());
        if (isValidMove(piece, 0, 0, newShape)) {
            piece.shape = newShape;
        }
    }

    function mergePiece() {
        for (let row = 0; row < currentPiece.shape.length; row++) {
            for (let col = 0; col < currentPiece.shape[row].length; col++) {
                if (currentPiece.shape[row][col] !== 0) {
                    board[currentPiece.y + row][currentPiece.x + col] = currentPiece.color;
                }
            }
        }
    }

    function clearLines() {
        let linesCleared = 0;
        for (let row = BOARD_HEIGHT - 1; row >= 0; row--) {
            if (board[row].every(cell => cell !== 0)) {
                linesCleared++;
                for (let r = row; r > 0; r--) {
                    board[r] = [...board[r - 1]]; // Copy row above down
                }
                board[0] = new Array(BOARD_WIDTH).fill(0); // Clear top row
                row++; // Check the new row at this position
            }
        }
        if (linesCleared > 0) {
            score += linesCleared * 100 * level; // Basic scoring
            if (score >= level * 500) { // Level up condition
                level++;
                dropInterval = Math.max(50, dropInterval - 50); // Increase speed
            }
            scoreDisplay.textContent = score;
            levelDisplay.textContent = level;
        }
    }

    function dropPiece() {
        if (!isGameOver) {
            if (isValidMove(currentPiece, 0, 1, currentPiece.shape)) {
                currentPiece.y++;
            } else {
                mergePiece();
                clearLines();
                currentPiece = nextPiece;
                nextPiece = createPiece();
                if (!isValidMove(currentPiece, 0, 0, currentPiece.shape)) {
                    isGameOver = true;
                    clearInterval(gameLoop);
                    showGameOverScreen();
                }
            }
            draw();
        }
    }

    function showGameOverScreen() {
        gameOverScreen.classList.remove('hidden');
        finalScoreDisplay.textContent = score;
    }

    function startGame() {
        resizeCanvasAndCalculateBlockSize(); // Calculate BLOCK_SIZE and set canvas dimensions
        initBoard();
        score = 0;
        level = 1;
        dropInterval = 1000;
        isGameOver = false;
        scoreDisplay.textContent = score;
        levelDisplay.textContent = level;
        gameOverScreen.classList.add('hidden');

        currentPiece = createPiece();
        nextPiece = createPiece(); // Pre-load next piece
        draw();
        clearInterval(gameLoop); // Clear any existing loop
        gameLoop = setInterval(dropPiece, dropInterval);
    }

    

    // Placeholder functions for old mobile controls to prevent errors
    const handleLeftBtnClick = () => { /* Handled by joystick */ };
    const handleRightBtnClick = () => { /* Handled by joystick */ };
    const handleDownBtnClick = () => { /* Handled by joystick */ };

    // Event Listeners
    if (cetrisPlayBtn && cetrisGameContainer && casualGameSelection && casualGamesBackBtn) {
        cetrisPlayBtn.addEventListener('click', () => {
            casualGameSelection.classList.add('hidden');
            cetrisGameContainer.classList.remove('hidden');
            startGame(); // Start the game when the button is clicked
            // document.removeEventListener('keydown', handleKeyPress); // Remove keyboard control
        });

        casualGamesBackBtn.addEventListener('click', () => {
            if (!cetrisGameContainer.classList.contains('hidden')) {
                cetrisGameContainer.classList.add('hidden');
                casualGameSelection.classList.remove('hidden');
                clearInterval(gameLoop); // Stop the game loop
                document.removeEventListener('keydown', handleKeyPress);
                isGameOver = false; // Reset game over state
                console.log('Back to casual game selection from Cetris');
            }
        });

        playAgainBtn.addEventListener('click', () => {
            startGame();
        });

        // Add Joystick HTML
            const joystick = document.createElement('div');
            joystick.id = 'cetris-joystick';
            joystick.innerHTML = `<div id="cetris-joystick-handle"></div>`;
            cetrisGameContainer.appendChild(joystick);

            // Joystick movement for mobile
            const joystickHandle = document.getElementById('cetris-joystick-handle');
            const joystickBase = document.getElementById('cetris-joystick');
            let joystickActive = false;
            let initialTouchX = 0;
            let initialTouchY = 0;
            let lastMoveX = 0;
            let lastMoveY = 0;

            joystickBase.addEventListener('touchstart', (e) => {
                e.preventDefault();
                joystickActive = true;
                const touch = e.touches[0];
                initialTouchX = touch.clientX;
                initialTouchY = touch.clientY;
                lastMoveX = initialTouchX;
                lastMoveY = initialTouchY;
            }, { passive: false });

            joystickBase.addEventListener('touchmove', (e) => {
                e.preventDefault();
                if (!joystickActive) return;

                const touch = e.touches[0];
                const deltaX = touch.clientX - initialTouchX;
                const deltaY = touch.clientY - initialTouchY;

                // Move the handle visually
                const maxHandleMove = joystickBase.clientWidth / 2;
                const handleX = Math.max(-maxHandleMove, Math.min(maxHandleMove, deltaX));
                const handleY = Math.max(-maxHandleMove, Math.min(maxHandleMove, deltaY));
                joystickHandle.style.transform = `translate(${handleX}px, ${handleY}px)`;

                const moveThreshold = 40; // Pixels to move before piece moves

                // Horizontal movement
                if (deltaX > moveThreshold && isValidMove(currentPiece, 1, 0, currentPiece.shape)) {
                    currentPiece.x++;
                    initialTouchX = touch.clientX; // Reset initial touch to prevent continuous movement
                    draw();
                } else if (deltaX < -moveThreshold && isValidMove(currentPiece, -1, 0, currentPiece.shape)) {
                    currentPiece.x--;
                    initialTouchX = touch.clientX; // Reset initial touch to prevent continuous movement
                    draw();
                }

                // Vertical movement (soft drop or rotate)
                if (Math.abs(deltaY) > moveThreshold) {
                    if (deltaY > 0) { // Down swipe (soft drop)
                        if (isValidMove(currentPiece, 0, 1, currentPiece.shape)) {
                            currentPiece.y++;
                            initialTouchY = touch.clientY; // Reset initial touch
                            draw();
                        }
                    } else { // Up swipe (rotate)
                        rotate(currentPiece);
                        initialTouchY = touch.clientY; // Reset initial touch
                        draw();
                    }
                }

            }, { passive: false });

            joystickBase.addEventListener('touchend', (e) => {
                e.preventDefault();
                joystickActive = false;
                joystickHandle.style.transform = `translate(0px, 0px)`; // Reset handle position
            });

                // Mobile controls
        document.getElementById('cetris-rotate-btn').addEventListener('click', () => {
            if (isGameOver) return;
            rotate(currentPiece);
            draw();
        });
        document.getElementById('cetris-drop-btn').addEventListener('click', () => {
            if (isGameOver) return;
            while (isValidMove(currentPiece, 0, 1, currentPiece.shape)) {
                currentPiece.y++;
            }
            dropPiece();
        });
    }
});