// Default Game State
const defaultGameState = {
    currentMode: null,
    gameGrid: [],
    originalColors: [],
    gameStarted: false,
    memoryPhase: true,
    memoryTimer: null,
    matchingTimer: null,
    memoryElapsedTime: 0,
    matchingElapsedTime: 0,
    gameCompleted: false,
    correctMatches: 0,
    totalCellsToMatch: 0,
    cellsFilledCount: 0,
    isPainting: false, // Flag for drag-to-paint
    // User authentication state
    isLoggedIn: false,
    username: '',
    playerCountry: '',
    avatarUrl: 'assets/logo.jpg',
    playerId: null,
    token: null,
    activeColor: null,
    lastGameScore: 0,
    lastGameMode: '',
    lastGameAccuracy: '',
    lastGameTime: '',
    currentRoom: 'Global', // Default chat room
    lastChatMessageTime: 0, // For client-side rate limiting
    chatHistoryOffset: 0, // Offset for fetching chat history
    chatHistoryLimit: 50, // Number of messages to fetch per request
    screenHistory: [], // To keep track of screen navigation
    currentScreen: null, // To keep track of the currently active screen
    isSoundMuted: false, // To track sound state
    zoomLevel: 40, // To track zoom level
    zoomInInterval: null, // For holding zoom in
    zoomOutInterval: null // For holding zoom out
};

// Game State
let gameState = { ...defaultGameState };

// Cropper.js instance
let cropper = null;