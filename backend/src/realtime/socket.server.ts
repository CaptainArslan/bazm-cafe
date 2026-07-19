import type { Server as HttpServer } from 'node:http';

import { Server } from 'socket.io';

import { env } from '../config/environment.js';
import { registerSocketEvents } from './socket.events.js';
import type {
    ClientToServerEvents,
    InterServerEvents,
    ServerToClientEvents,
    SocketData,
} from './socket.types.js';

export type SocketServer = Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
>;

let socketServer: SocketServer | null = null;

export function initializeSocketServer(
    httpServer: HttpServer,
): SocketServer {
    if (socketServer !== null) {
        return socketServer;
    }

    socketServer = new Server<
        ClientToServerEvents,
        ServerToClientEvents,
        InterServerEvents,
        SocketData
    >(httpServer, {
        path: '/socket.io',

        cors: {
            origin: env.FRONTEND_URL,
            credentials: true,
            methods: ['GET', 'POST'],
        },

        transports: ['websocket', 'polling'],

        pingInterval: 25_000,
        pingTimeout: 20_000,

        maxHttpBufferSize: 1_000_000,
    });

    socketServer.on('connection', (socket) => {
        registerSocketEvents(socket);
    });

    console.log('Socket.IO server initialized.');

    return socketServer;
}

export function getSocketServer(): SocketServer {
    if (socketServer === null) {
        throw new Error('Socket.IO server has not been initialized.');
    }

    return socketServer;
}