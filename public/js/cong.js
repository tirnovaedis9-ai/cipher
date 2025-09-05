document.addEventListener('DOMContentLoaded', () => {
    const congGameContainer = document.getElementById('cong-game-container');
    const casualGameSelection = document.getElementById('casual-game-selection');

    const playCongButton = document.querySelector('.game-card[data-game="cong"] .play-casual-game-btn');
    if (playCongButton) {
        playCongButton.addEventListener('click', () => {
            if (casualGameSelection) {
                casualGameSelection.classList.add('hidden');
            }
            congGameContainer.classList.remove('hidden');
            // Initialize the game inside the container
            initializeCongGame(congGameContainer);
        });
    }

    const casualGamesBackBtn = document.getElementById('casualGamesBackBtn');
    if (casualGamesBackBtn) {
        casualGamesBackBtn.addEventListener('click', () => {
            congGameContainer.classList.add('hidden');
            congGameContainer.innerHTML = ''; // Clear the game content
            if (casualGameSelection) {
                casualGameSelection.classList.remove('hidden');
            }
            // Make sure to stop any running game loop
            if (window.congGame && window.congGame.stop) {
                window.congGame.stop();
            }
        });
    }
});

function initializeCongGame(container) {
    // Clear previous game if any and stop its loop
    if (window.congGame && window.congGame.stop) {
        window.congGame.stop();
    }
    container.innerHTML = '';

    // --- Create Game UI ---
    const scoreDiv = document.createElement('div');
    scoreDiv.id = 'cong-score';
    scoreDiv.innerHTML = `<span id="player-score">0</span> | <span id="ai-score">0</span>`;

    const canvasWrapper = document.createElement('div');
    canvasWrapper.className = 'cong-canvas-wrapper';

    const canvas = document.createElement('canvas');
    canvas.id = 'cong-canvas';

    const startScreen = document.createElement('div');
    startScreen.id = 'cong-start-screen';
    startScreen.innerHTML = `<button id="cong-start-btn" class="btn btn-primary cong-game-btn"><i class="fas fa-play"></i></button>`;

    const gameOverScreen = document.createElement('div');
    gameOverScreen.id = 'cong-game-over-screen';
    gameOverScreen.className = 'hidden';
    gameOverScreen.innerHTML = `
        <h2 id="cong-winner-text"></h2>
        <p>Final Score: <span id="cong-final-score">0 - 0</span></p>
        <button id="cong-play-again-btn" class="btn btn-primary cong-game-btn"><i class="fas fa-redo"></i></button>
    `;

    canvasWrapper.appendChild(canvas);
    canvasWrapper.appendChild(startScreen);
    canvasWrapper.appendChild(gameOverScreen);

    container.appendChild(scoreDiv);
    container.appendChild(canvasWrapper);

    // --- Create Joystick UI ---
    const joystick = document.createElement('div');
    joystick.id = 'cong-joystick';
    joystick.innerHTML = `<div id="cong-joystick-handle"></div>`;
    container.appendChild(joystick);

    // --- Game Logic ---
    const ctx = canvas.getContext('2d');

    // Set fixed canvas size
    canvas.width = 350;
    canvas.height = 350;

    const playerScoreDisplay = document.getElementById('player-score');
    const aiScoreDisplay = document.getElementById('ai-score');
    const startBtn = document.getElementById('cong-start-btn');
    const playAgainBtn = document.getElementById('cong-play-again-btn');
    const winnerText = document.getElementById('cong-winner-text');
    const finalScoreDisplay = document.getElementById('cong-final-score');


    let animationFrameId;
    let gameRunning = false;

    const paddleWidth = 10,
          paddleHeight = 100,
          ballRadius = 8,
          winningScore = 5;
    let player, ai, ball;

    function resetGame() {
        player = { x: canvas.width - paddleWidth * 2, y: canvas.height / 2 - paddleHeight / 2, width: paddleWidth, height: paddleHeight, score: 0 };
        ai = { x: paddleWidth, y: canvas.height / 2 - paddleHeight / 2, width: paddleWidth, height: paddleHeight, score: 0 };
        resetBall();
        updateScore();
    }

    function resetBall() {
        const isMobile = window.innerWidth <= 768; // Define mobile threshold
        const baseSpeed = isMobile ? 4 : 7; // Slower speed for mobile

        ball = {
            x: canvas.width / 2,
            y: canvas.height / 2,
            radius: ballRadius,
            speed: baseSpeed,
            dx: (Math.random() > 0.5 ? 1 : -1) * baseSpeed,
            dy: (Math.random() * 10) - 5 // -5 to 5, for more varied angles
        };
    }

    function draw() {
        // Clear canvas with a solid black color
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const paddleColor = 'white';
        const ballColor = 'white';
        const netColor = 'rgba(255, 255, 255, 0.3)';

        // Draw Net
        ctx.beginPath();
        ctx.setLineDash([10, 10]);
        ctx.moveTo(canvas.width / 2, 0);
        ctx.lineTo(canvas.width / 2, canvas.height);
        ctx.strokeStyle = netColor;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw Paddles and Ball
        ctx.fillStyle = 'blue'; // AI paddle
        ctx.fillRect(ai.x, ai.y, ai.width, ai.height);
        ctx.fillStyle = 'red'; // Player paddle
        ctx.fillRect(player.x, player.y, player.width, player.height);
        
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'yellow'; // Ball color
        ctx.fill();
    }

    function update() {
        // AI Movement (simple easing for smooth follow)
        const aiCenter = ai.y + ai.height / 2;
        const targetY = ball.y;
        ai.y += (targetY - aiCenter) * 0.08; // Adjust the multiplier for difficulty

        // Clamp AI paddle to stay within bounds
        if (ai.y < 0) ai.y = 0;
        if (ai.y + ai.height > canvas.height) ai.y = canvas.height - ai.height;

        // Ball movement
        ball.x += ball.dx;
        ball.y += ball.dy;

        // Wall collision (top/bottom)
        if (ball.y + ball.radius > canvas.height || ball.y - ball.radius < 0) {
            ball.dy *= -1;
        }

        // Paddle collision
        let paddle = (ball.x < canvas.width / 2) ? ai : player;
        if (isColliding(ball, paddle)) {
            let collidePoint = (ball.y - (paddle.y + paddle.height / 2));
            collidePoint = collidePoint / (paddle.height / 2); // Value between -1 and 1

            let angleRad = (Math.PI / 4) * collidePoint; // Max 45 degrees
            let direction = (ball.x < canvas.width / 2) ? 1 : -1;

            // Increase speed and change angle
            ball.speed *= 1.05;
            ball.dx = direction * ball.speed * Math.cos(angleRad);
            ball.dy = ball.speed * Math.sin(angleRad);
        }

        // Score
        if (ball.x - ball.radius < 0) {
            player.score++;
            resetBall();
        } else if (ball.x + ball.radius > canvas.width) {
            ai.score++;
            resetBall();
        }

        updateScore();

        if (player.score >= winningScore || ai.score >= winningScore) {
            endGame();
        }
    }

    function isColliding(b, p) {
        // Check if the ball is within the horizontal and vertical range of the paddle
        return b.x + b.radius > p.x &&
               b.x - b.radius < p.x + p.width &&
               b.y + b.radius > p.y &&
               b.y - b.radius < p.y + p.height;
    }

    function updateScore() {
        playerScoreDisplay.textContent = player.score;
        aiScoreDisplay.textContent = ai.score;
    }

    function gameLoop() {
        if (!gameRunning) return;
        update();
        draw();
        animationFrameId = requestAnimationFrame(gameLoop);
    }

    function startGame() {
        gameRunning = true;
        startScreen.classList.add('hidden');
        gameOverScreen.classList.add('hidden');
        scoreDiv.style.display = 'flex';
        resetGame();
        gameLoop();
    }

    function stopGame() {
        gameRunning = false;
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }
    }

    function endGame() {
        stopGame();
        winnerText.textContent = player.score >= winningScore ? 'You Win!' : 'Game Over';
        finalScoreDisplay.textContent = `${ai.score} - ${player.score}`;
        gameOverScreen.classList.remove('hidden');
    }

    // --- Event Listeners ---
    startBtn.addEventListener('click', startGame);
    playAgainBtn.addEventListener('click', startGame);

    // Mouse movement for desktop
    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        const y = e.clientY - rect.top;
        player.y = y - player.height / 2;
        // Clamp paddle position
        if (player.y < 0) player.y = 0;
        if (player.y + player.height > canvas.height) player.y = canvas.height - player.height;
    });

    // Joystick movement for mobile
    const joystickHandle = document.getElementById('cong-joystick-handle');
    const joystickBase = document.getElementById('cong-joystick');
    let joystickActive = false;
    let initialTouchY = 0;
    let initialPaddleY = 0;

    joystickBase.addEventListener('touchstart', (e) => {
        e.preventDefault();
        joystickActive = true;
        const touch = e.touches[0];
        initialTouchY = touch.clientY;
        initialPaddleY = player.y;
    }, { passive: false });

    joystickBase.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (!joystickActive) return;

        const touch = e.touches[0];
        const deltaY = touch.clientY - initialTouchY;

        // Move the handle visually
        const maxHandleMove = joystickBase.clientHeight / 2;
        const handleY = Math.max(-maxHandleMove, Math.min(maxHandleMove, deltaY));
        joystickHandle.style.transform = `translateY(${handleY}px)`;

        // Map joystick movement to paddle movement
        const joystickRange = joystickBase.clientHeight; // Total height of joystick base
        const paddleRange = canvas.height - player.height; // Total range paddle can move

        // Calculate new paddle Y based on initial paddle Y and joystick delta
        let newPaddleY = initialPaddleY + (deltaY / joystickRange) * paddleRange * 0.8; // Reduced sensitivity

        // Clamp paddle position
        if (newPaddleY < 0) newPaddleY = 0;
        if (newPaddleY > canvas.height - player.height) newPaddleY = canvas.height - player.height;

        player.y = newPaddleY;

    }, { passive: false });

    joystickBase.addEventListener('touchend', (e) => {
        e.preventDefault();
        joystickActive = false;
        joystickHandle.style.transform = `translateY(0px)`; // Reset handle position
    });


    // --- Initial Setup ---
    resetGame();
    draw();

    // Expose a stop function to be called when the modal is closed
    window.congGame = {
        stop: () => {
            stopGame();
        }
    };
}