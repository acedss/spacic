// Socket.IO Server: Real-time playback sync
// Handles global playback events and broadcasts state to all connected users
// Called by: index.js on server startup

import { Server } from 'socket.io';
import * as playbackManager from './playback-manager.js';
import * as playbackService from '../services/playback.service.js';

export const initializeSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // On user connection
  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Send current playback state to the new user
    const currentState = playbackManager.getPlaybackState();
    socket.emit('playback:state', currentState);

    // Listen for playback events
    socket.on('playback:play', async (songId) => {
      try {
        const newState = await playbackService.playSong(songId);
        io.emit('playback:state', newState);
      } catch (error) {
        console.error('Error playing song:', error);
        socket.emit('playback:error', { message: error.message });
      }
    });

    socket.on('playback:pause', () => {
      try {
        const newState = playbackService.pausePlayback();
        io.emit('playback:state', newState);
      } catch (error) {
        console.error('Error pausing:', error);
      }
    });

    socket.on('playback:resume', () => {
      try {
        const newState = playbackService.resumePlayback();
        io.emit('playback:state', newState);
      } catch (error) {
        console.error('Error resuming:', error);
      }
    });

    socket.on('playback:update-time', (currentTime) => {
      try {
        const newState = playbackService.updatePlaybackTime(currentTime);
        io.emit('playback:state', newState);
      } catch (error) {
        console.error('Error updating time:', error);
      }
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.id}`);
    });
  });

  return io;
};

export default initializeSocket;
