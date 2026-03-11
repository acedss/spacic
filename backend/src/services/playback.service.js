// Service: Playback business logic
// Called by: playback.controller, socket event handlers
// Calls: playback-manager, song model, s3 service

import { Song } from '../models/song.model.js';
import { getPresignedUrl } from './s3.services.js';
import * as playbackManager from '../lib/playback-manager.js';

// Play a song: get details, generate S3 URL, update state
export const playSong = async (songId) => {
  try {
    const song = await Song.findById(songId);
    if (!song) throw new Error('Song not found');

    const presignedUrl = await getPresignedUrl(song.s3Key, 300); // 5 min expiry
    return playbackManager.setCurrentSong(songId, presignedUrl);
  } catch (error) {
    throw new Error(`Failed to play song: ${error.message}`);
  }
};

// Pause playback
export const pausePlayback = () => {
  return playbackManager.pausePlayback();
};

// Resume playback
export const resumePlayback = () => {
  return playbackManager.resumePlayback();
};

// Update current playback time
export const updatePlaybackTime = (currentTime) => {
  if (typeof currentTime !== 'number' || currentTime < 0) {
    throw new Error('Invalid playback time');
  }
  return playbackManager.updatePlaybackTime(currentTime);
};

// Get current playback state
export const getPlaybackState = () => {
  return playbackManager.getPlaybackState();
};
