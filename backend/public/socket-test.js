const statusElement = document.getElementById('status');
const logElement = document.getElementById('log');
const pingButton = document.getElementById('ping-button');

function addLog(message, data) {
    const timestamp = new Date().toLocaleTimeString();

    logElement.textContent +=
        `[${timestamp}] ${message}` +
        (data ? `\n${JSON.stringify(data, null, 2)}` : '') +
        '\n\n';
}

const socket = io({
    path: '/socket.io',
    transports: ['websocket', 'polling'],
});

socket.on('connect', () => {
    statusElement.textContent = `Connected: ${socket.id}`;
    statusElement.style.background = '#d1fae5';

    addLog('Socket connected', {
        socketId: socket.id,
        transport: socket.io.engine.transport.name,
    });
});

socket.on('connection:ready', (payload) => {
    addLog('Received connection:ready', payload);
});

socket.on('connect_error', (error) => {
    statusElement.textContent = `Connection failed: ${error.message}`;
    statusElement.style.background = '#fee2e2';

    addLog('Connection error', {
        message: error.message,
    });
});

socket.on('disconnect', (reason) => {
    statusElement.textContent = `Disconnected: ${reason}`;
    statusElement.style.background = '#fee2e2';

    addLog('Socket disconnected', {
        reason,
    });
});

pingButton.addEventListener('click', () => {
    addLog('Sending connection:ping');

    socket.emit('connection:ping', (response) => {
        addLog('Ping acknowledgement received', response);
    });
});