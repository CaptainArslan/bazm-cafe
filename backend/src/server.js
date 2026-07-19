import 'dotenv/config';
import { app } from './app.js';
const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';
const server = app.listen(port, host, () => {
    console.log('');
    console.log('BAZM Cafe backend started successfully.');
    console.log(`Local URL: http://localhost:${port}`);
    console.log(`Health API: http://localhost:${port}/api/v1/health`);
    console.log('');
});
const shutdown = (signal) => {
    console.log(`${signal} received. Closing HTTP server...`);
    server.close((error) => {
        if (error) {
            console.error('Failed to close the HTTP server:', error);
            process.exit(1);
        }
        console.log('HTTP server closed successfully.');
        process.exit(0);
    });
};
process.on('SIGINT', () => {
    shutdown('SIGINT');
});
process.on('SIGTERM', () => {
    shutdown('SIGTERM');
});
//# sourceMappingURL=server.js.map