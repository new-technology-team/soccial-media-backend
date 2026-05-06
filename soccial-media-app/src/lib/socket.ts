import { io, Socket } from "socket.io-client";
import { normalizeServiceUrl } from "./service-url";

type SocketCallback = (...args: unknown[]) => void;

let socketInstance: Socket | null = null;
let socketToken: string | null = null;

export const getSocket = (
  token: string,
  onConnect?: SocketCallback,
  onDisconnect?: SocketCallback,
): Socket => {
  if (socketInstance && socketToken && socketToken !== token) {
    socketInstance.disconnect();
    socketInstance = null;
    socketToken = null;
  }

  if (socketInstance?.connected) {
    return socketInstance;
  }

  const SOCKET_URL = normalizeServiceUrl(
    process.env.EXPO_PUBLIC_SOCKET_URL,
    "http://10.0.2.2:5000",
  );

  socketInstance = io(SOCKET_URL, {
    transports: ["websocket"],
    auth: { token },
  });
  socketToken = token;

  if (onConnect) socketInstance.on("connect", onConnect);
  if (onDisconnect) socketInstance.on("disconnect", onDisconnect);

  return socketInstance;
};

export const disconnectSocket = () => {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
    socketToken = null;
  }
};
