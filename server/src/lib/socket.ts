import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';

let io: SocketIOServer | null = null;

export function initSocket(httpServer: HttpServer, clientUrl: string): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: clientUrl,
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    socket.on('join', (room: string) => {
      socket.join(room);
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function getIO(): SocketIOServer {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
}

export function emitAlert(alert: {
  id: string;
  type: string;
  title: string;
  message: string;
  channel: string;
  sentAt: Date;
}) {
  if (!io) return;
  io.emit('new_alert', alert);
}
