// --- API Helper ---
async function apiRequest(endpoint, method = 'GET', body = null) {
    try {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        // Add Authorization header if token exists and the endpoint is not public
        const publicEndpoints = ['/api/auth/login', '/api/auth/register'];
        const isPublicEndpoint = publicEndpoints.some(publicPath => endpoint.startsWith(publicPath));

        if (gameState.token && !isPublicEndpoint) {
            options.headers['Authorization'] = `Bearer ${gameState.token}`;
        }

        if (body) {
            options.body = JSON.stringify(body);
        }
        const response = await fetch(endpoint, options);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: response.statusText }));
            if (response.status === 401 || response.status === 403) {
                showNotification('Your session has expired. Please log in again.', 'error');
                logoutUser(); // Log out the user
            }
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`API request failed: ${method} ${endpoint}`, error);
        const gameMessage = document.getElementById('gameMessage');
        if (gameMessage) {
            gameMessage.textContent = `Error: ${error.message || 'Could not connect to the server.'}`;
        }
        throw error;
    }
}

async function apiUploadRequest(endpoint, formData) {
    try {
        const options = {
            method: 'POST',
            headers: {
                // 'Content-Type' is not set for FormData, browser sets it automatically with boundary
            },
            body: formData
        };

        // Add Authorization header if token exists
        if (gameState.token) {
            options.headers['Authorization'] = `Bearer ${gameState.token}`;
        }

        const response = await fetch(endpoint, options);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: response.statusText }));
            if (response.status === 401 || response.status === 403) {
                showNotification('Your session has expired. Please log in again.', 'error');
                logoutUser();
            }
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`API upload request failed: ${endpoint}`, error);
        showNotification(`Upload error: ${error.message || 'Could not connect to the server.'}`, 'error');
        throw error;
    }
}

