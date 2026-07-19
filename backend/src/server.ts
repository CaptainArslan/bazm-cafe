import { createServer } from "node:http";

import listEndpoints from "express-list-endpoints";

import { app } from "./app.js";
import { prisma } from "./config/database.js";
import { env } from "./config/environment.js";
import { startEmptySessionExpiryJob } from "./jobs/empty-session-expiry.job.js";
import { initializeSocketServer } from "./realtime/socket.server.js";
import { ensureUploadDirectories } from "./utils/storage.js";

const httpServer = createServer(app);
const io = initializeSocketServer(httpServer);

if (env.NODE_ENV === "development") {
  console.table(
    listEndpoints(app).flatMap((endpoint) =>
      endpoint.methods.map((method) => ({
        method,
        path: endpoint.path,
        middleware: endpoint.middlewares.join(", "),
      })),
    ),
  );
}

void ensureUploadDirectories().then(() => {
  httpServer.listen(env.PORT, env.HOST, () => {
    console.log("");
    console.log(`${env.APP_NAME} backend started successfully.`);
    console.log(`Local URL: http://localhost:${env.PORT}`);
    console.log(`Health API: http://localhost:${env.PORT}/api/v1/health`);
    console.log(`Socket.IO path: http://localhost:${env.PORT}/socket.io`);
    console.log("");

    startEmptySessionExpiryJob();
  });
});

let isShuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  console.log(`${signal} received. Closing application...`);

  io.close(async () => {
    await prisma.$disconnect();

    console.log("Socket.IO and database connections closed.");
    process.exit(0);
  });
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
