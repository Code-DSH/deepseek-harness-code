import { createServer } from "node:net";

export async function reserveLoopbackPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen({ host: "127.0.0.1", port: 0 }, () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        server.close(() =>
          reject(new Error("Unable to reserve a loopback port")),
        );
        return;
      }
      server.close((error) => (error ? reject(error) : resolve(address.port)));
    });
  });
}

export async function startWithPortRetries<T>(
  allocatePort: () => Promise<number>,
  start: (port: number) => Promise<T>,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await start(await allocatePort());
    } catch (error) {
      lastError = error;
      if (
        !(error instanceof Error) ||
        (error as NodeJS.ErrnoException).code !== "EADDRINUSE"
      ) {
        throw error;
      }
    }
  }
  throw lastError;
}
