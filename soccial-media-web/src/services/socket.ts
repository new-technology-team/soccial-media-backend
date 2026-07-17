import { io, type Socket } from 'socket.io-client'

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  import.meta.env.NEXT_PUBLIC_SOCKET_URL ||
  (typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '')
const SOCKET_PATH = import.meta.env.VITE_SOCKET_PATH || import.meta.env.NEXT_PUBLIC_SOCKET_PATH || '/socket.io'

let socketInstance: Socket | null = null

export const connectSocket = (token: string, userId?: number) => {
  if (socketInstance) {
    socketInstance.auth = {
      token,
      userId: Number(userId || 0) || undefined,
    }
    if (!socketInstance.connected) {
      socketInstance.connect()
    }
    return socketInstance
  }

  socketInstance = io(SOCKET_URL, {
    autoConnect: true,
    transports: ['polling', 'websocket'],
    path: SOCKET_PATH,
    auth: {
      token,
      userId: Number(userId || 0) || undefined,
    },
  })

  return socketInstance
}

export const getSocket = () => socketInstance

export const disconnectSocket = () => {
  if (socketInstance) {
    socketInstance.disconnect()
    socketInstance = null
  }
}
