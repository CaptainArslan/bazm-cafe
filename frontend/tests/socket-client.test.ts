import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("socket.io-client", () => {
  const instances: Array<Record<string, unknown>> = [];
  return {
    io: vi.fn((opts: Record<string, unknown>) => {
      const instance = {
        opts,
        auth: opts.auth,
        connected: false,
        connect: vi.fn(function (this: { connected: boolean }) {
          this.connected = true;
        }),
        disconnect: vi.fn(function (this: { connected: boolean }) {
          this.connected = false;
        }),
        on: vi.fn(),
      };
      instances.push(instance);
      return instance;
    }),
    __instances: instances,
  };
});

afterEach(() => {
  vi.resetModules();
});

describe("socket client", () => {
  it("connects with no auth token by default", async () => {
    const { getSocket } = await import("../src/socket/client");
    const socket = getSocket() as unknown as { opts: { auth?: { token?: string } } };
    expect(socket.opts.auth).toBeUndefined();
  });

  it("setSocketAuthToken updates the auth payload used on the next connect", async () => {
    const { getSocket, setSocketAuthToken } = await import("../src/socket/client");
    setSocketAuthToken("access-123");
    const socket = getSocket() as unknown as { opts: { auth?: { token?: string } } };
    expect(socket.opts.auth).toEqual({ token: "access-123" });
  });

  it("reconnects an already-connected socket when the token changes", async () => {
    const { connectSocket, setSocketAuthToken } = await import("../src/socket/client");
    const socket = connectSocket() as unknown as {
      connected: boolean;
      connect: () => void;
      disconnect: () => void;
    };
    expect(socket.connected).toBe(true);

    const disconnectSpy = vi.spyOn(socket, "disconnect");
    const connectSpy = vi.spyOn(socket, "connect");
    disconnectSpy.mockClear();
    connectSpy.mockClear();

    setSocketAuthToken("new-token");

    expect(disconnectSpy).toHaveBeenCalled();
    expect(connectSpy).toHaveBeenCalled();
  });

  it("preserves previously attached listeners across an auth token change", async () => {
    const { connectSocket, getSocket, setSocketAuthToken } = await import("../src/socket/client");
    const socket = connectSocket() as unknown as {
      on: (event: string, handler: () => void) => void;
    };

    const handler = vi.fn();
    socket.on("some-event", handler);

    setSocketAuthToken("new-token");

    expect(getSocket()).toBe(socket);
    expect((socket.on as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
  });
});
