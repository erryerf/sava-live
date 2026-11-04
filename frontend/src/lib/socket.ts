import { io, Socket } from 'socket.io-client';

export const WS_BASE_URL =
  process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';

export function createEventSocket(slug: string): Socket {
  const socket = io(WS_BASE_URL, {
    transports: ['websocket', 'polling'],
    query: { slug },
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1500,
  });

  socket.on('connect', () => {
    socket.emit('subscribe', {
      room: `event_${slug}`,
    });
  });

  return socket;
}

