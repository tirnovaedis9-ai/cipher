document.addEventListener('DOMContentLoaded', () => {
    const gameSelectionMenu = document.getElementById('casual-game-selection');
    const snakeGameContainer = document.getElementById('snake-game-container');
    const playSnakeCard = document.querySelector('.game-card[data-game="snake"]');
    
    const canvas = document.getElementById('snakeCanvas');
    const ctx = canvas.getContext('2d');
    const scoreElement = document.getElementById('snake-score');
    
    const startScreen = document.getElementById('snake-start-screen');
    const startButton = document.getElementById('snake-start-btn');
    
    const gameOverScreen = document.getElementById('snake-game-over-screen');
    const finalScoreElement = document.getElementById('snake-final-score');
    const playAgainButton = document.getElementById('snake-play-again-btn');

    let gridSize = 20;
    let snake, food, score, direction, isGameOver, gameLoopId;
    let lastUpdateTime = 0;
    let foodAnimationTime = 0;
    let snakeSpeed = 150; // ms per move

    // RESTORED: Original snake colors
    const snakeColors = ['#ff0000', '#ffff00', '#0000ff'];

    function resizeCanvas() {
        const container = document.getElementById('snake-game-container');
        const containerSize = container.getBoundingClientRect();
        const size = Math.min(containerSize.width, window.innerHeight * 0.6) - 20; // Leave some padding
        
        canvas.width = size;
        canvas.height = size;

        // Recalculate grid size to maintain a 20x20 grid
        gridSize = canvas.width / 20;
    }

    function gameLoop(currentTime) {
        if (isGameOver) return;

        gameLoopId = requestAnimationFrame(gameLoop);

        foodAnimationTime += 0.1;

        const timeSinceLastUpdate = currentTime - lastUpdateTime;
        if (timeSinceLastUpdate < snakeSpeed) return;

        lastUpdateTime = currentTime;
        update();
    }

    function startGameLoop() {
        if(gameLoopId) cancelAnimationFrame(gameLoopId);
        lastUpdateTime = performance.now();
        gameLoop(lastUpdateTime);
    }

    function initSnakeGame(isRestarting = false) {
        if (gameLoopId) cancelAnimationFrame(gameLoopId);
        
        snake = [{ x: 10, y: 10 }];
        score = 0;
        direction = 'right';
        isGameOver = false;
        snakeSpeed = 150;

        scoreElement.textContent = `0`;
        scoreElement.classList.remove('hidden');
        
        gameOverScreen.classList.add('hidden');
        canvas.classList.remove('hidden');
        
        generateFood();
        draw(); // Draw initial state

        if (isRestarting) {
            startScreen.classList.add('hidden');
            startGameLoop();
        } else {
            startScreen.classList.remove('hidden');
        }
    }

    function update() {
        const head = { ...snake[0] };

        switch (direction) {
            case 'up': head.y--; break;
            case 'down': head.y++; break;
            case 'left': head.x--; break;
            case 'right': head.x++; break;
        }

        if (head.x < 0 || head.x >= 20 || head.y < 0 || head.y >= 20 || checkSelfCollision(head)) {
            gameOver();
            return;
        }

        snake.unshift(head);

        if (head.x === food.x && head.y === food.y) {
            score++;
            scoreElement.textContent = score;
            generateFood();
            if (snakeSpeed > 50) { // Speed up
                snakeSpeed -= 2;
            }
        } else {
            snake.pop();
        }
        draw();
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // RESTORED: Draw Snake with Glow and multiple colors
        ctx.shadowBlur = 10;
        snake.forEach((segment, index) => {
            const color = snakeColors[index % snakeColors.length];
            ctx.fillStyle = color;
            ctx.shadowColor = color;
            ctx.fillRect(segment.x * gridSize, segment.y * gridSize, gridSize, gridSize);
        });

        // RESTORED: Pulsating Food
        const pulse = Math.sin(foodAnimationTime) * 0.1 + 0.9;
        const foodSize = gridSize * pulse;
        const foodOffset = (gridSize - foodSize) / 2;

        const foodColor = '#ffffff';
        ctx.fillStyle = foodColor;
        ctx.shadowColor = foodColor;
        ctx.fillRect(food.x * gridSize + foodOffset, food.y * gridSize + foodOffset, foodSize, foodSize);

        ctx.shadowBlur = 0;
    }

    function generateFood() {
        food = {
            x: Math.floor(Math.random() * 20),
            y: Math.floor(Math.random() * 20)
        };

        if (snake.some(segment => segment.x === food.x && segment.y === food.y)) {
            generateFood();
        }
    }

    function checkSelfCollision(head) {
        return snake.some((segment, index) => index > 0 && segment.x === head.x && segment.y === head.y);
    }

    function gameOver() {
        isGameOver = true;
        cancelAnimationFrame(gameLoopId);
        
        finalScoreElement.textContent = score;
        gameOverScreen.classList.remove('hidden');
        // Don't hide the canvas, the overlay will cover it
    }

    function changeDirection(e) {
        if (isGameOver) return;
        const newDirection = e.key.replace('Arrow', '').toLowerCase();
        const oppositeDirections = {
            'up': 'down', 'down': 'up', 'left': 'right', 'right': 'left'
        };

        if (['up', 'down', 'left', 'right'].includes(newDirection) && snake.length > 1 && oppositeDirections[direction] === newDirection) {
            return;
        }
        
        if (['up', 'down', 'left', 'right'].includes(newDirection)) {
            direction = newDirection;
        }
    }

    function showSnakeGame() {
        gameSelectionMenu.classList.add('hidden');
        snakeGameContainer.classList.remove('hidden');
        resizeCanvas();
        initSnakeGame(false); // Initial setup, don't start loop
    }

    function showCasualMenu() {
        snakeGameContainer.classList.add('hidden');
        gameSelectionMenu.classList.remove('hidden');
        isGameOver = true; 
        cancelAnimationFrame(gameLoopId);
    }

    // --- Event Listeners ---
    if (playSnakeCard) {
        playSnakeCard.addEventListener('click', showSnakeGame);
    }
    if (startButton) {
        startButton.addEventListener('click', () => {
            startScreen.classList.add('hidden');
            startGameLoop();
        });
    }
    if (playAgainButton) {
        playAgainButton.addEventListener('click', () => initSnakeGame(true));
    }
    
    document.addEventListener('keydown', changeDirection);
    window.addEventListener('resize', resizeCanvas);

    // Mobile Controls
    document.getElementById('snake-up').addEventListener('click', () => changeDirection({ key: 'ArrowUp' }));
    document.getElementById('snake-down').addEventListener('click', () => changeDirection({ key: 'ArrowDown' }));
    document.getElementById('snake-left').addEventListener('click', () => changeDirection({ key: 'ArrowLeft' }));
    document.getElementById('snake-right').addEventListener('click', () => changeDirection({ key: 'ArrowRight' }));

    window.showCasualMenu = showCasualMenu;
});

document.addEventListener('DOMContentLoaded', () => {
    const casualGamesBackBtn = document.getElementById('casualGamesBackBtn');
    if (casualGamesBackBtn) {
        casualGamesBackBtn.addEventListener('click', () => {
            if (!document.getElementById('snake-game-container').classList.contains('hidden')) {
                if (window.showCasualMenu) {
                    window.showCasualMenu();
                }
            } else {
                const casualGamesModal = document.getElementById('casualGamesModal');
                if (casualGamesModal) {
                    casualGamesModal.classList.remove('active');
                }
            }
        });
    }
});