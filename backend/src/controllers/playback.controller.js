// Controller: Playback orchestrator

// Called by: routes
// Calls: playback.service

import * as playbackService from '../services/playback.service.js';

// Get current playback state
export const getPlaybackState = async (req, res, next) => {
  try {
    const state = playbackService.getPlaybackState();
    res.status(200).json({ success: true, data: state });
  } catch (error) {
    next(error);
  }
};

// Play a song
export const playSong = async (req, res, next) => {
  try {
    const { songId } = req.body;

    if (!songId) {
      return res.status(400).json({ success: false, error: 'songId required' });
    }

    const newState = await playbackService.playSong(songId);
    res.status(200).json({ success: true, data: newState });
  } catch (error) {
    next(error);
  }
};

// Pause playback
export const pausePlayback = async (req, res, next) => {
  try {
    const newState = playbackService.pausePlayback();
    res.status(200).json({ success: true, data: newState });
  } catch (error) {
    next(error);
  }
};

// Resume playback
export const resumePlayback = async (req, res, next) => {
  try {
    const newState = playbackService.resumePlayback();
    res.status(200).json({ success: true, data: newState });
  } catch (error) {
    next(error);
  }
};

// Update playback time
export const updatePlaybackTime = async (req, res, next) => {
  try {
    const { currentTime } = req.body;

    if (typeof currentTime !== 'number') {
      return res.status(400).json({ success: false, error: 'currentTime must be a number' });
    }

    const newState = playbackService.updatePlaybackTime(currentTime);
    res.status(200).json({ success: true, data: newState });
  } catch (error) {
    next(error);
  }
};
