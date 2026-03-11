// Playback Manager: In-memory global playback state
// This stores the current song and playback time for all users
// Called by: playback.service, socket event handlers

let playbackState = {
  currentSongId: null,
  currentTime: 0,      // seconds
  isPlaying: false,
  presignedUrl: null,
  updatedAt: Date.now()
};

export const setPlaybackState = (newState) => {
  playbackState = { ...playbackState, ...newState, updatedAt: Date.now() };
  return playbackState;
};

export const getPlaybackState = () => ({ ...playbackState });

export const updatePlaybackTime = (time) => {
  playbackState.currentTime = time;
  playbackState.updatedAt = Date.now();
  return playbackState;
};

export const setCurrentSong = (songId, presignedUrl) => {
  playbackState.currentSongId = songId;
  playbackState.presignedUrl = presignedUrl;
  playbackState.currentTime = 0;
  playbackState.isPlaying = true;
  playbackState.updatedAt = Date.now();
  return playbackState;
};

export const pausePlayback = () => {
  playbackState.isPlaying = false;
  playbackState.updatedAt = Date.now();
  return playbackState;
};

export const resumePlayback = () => {
  playbackState.isPlaying = true;
  playbackState.updatedAt = Date.now();
  return playbackState;
};

export const resetPlayback = () => {
  playbackState = {
    currentSongId: null,
    currentTime: 0,
    isPlaying: false,
    presignedUrl: null,
    updatedAt: Date.now()
  };
  return playbackState;
};
