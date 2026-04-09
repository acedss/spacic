// io.js — Socket.IO instance singleton
// Allows services (friend.service, etc.) to emit events without being
// passed `io` as a parameter through the entire call chain.
//
// Usage:
//   initializeSocket()  → calls setIo(io) once on server start
//   friend.service.js   → calls getIo().to(userId).emit(...)

let _io = null;

export const setIo = (io) => { _io = io; };
export const getIo = ()   => _io;
