import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (socket) return socket;

  // An undefined URL means "current browser origin". Next forwards
  // /socket.io to the backend through the private Docker network.
  const configuredUrl = process.env.NEXT_PUBLIC_SOCKET_URL;

  socket = io(configuredUrl || undefined, {
    auth: (cb) => {
      const token = localStorage.getItem('access_token');
      const organizationId = localStorage.getItem('active_org_id');
      cb({ token, organizationId });
    },
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 10,
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
