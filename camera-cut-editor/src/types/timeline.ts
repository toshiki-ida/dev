import { CameraAnimation } from './camera';

export type TransitionType = 'cut' | 'dissolve' | 'fade' | 'wipe';

export interface Cut {
  id: string;
  name: string;
  cameraId: string;
  startTime: number;      // seconds
  duration: number;       // seconds
  transition: TransitionType;
  transitionDuration: number;
  thumbnail?: string;     // base64
  notes?: string;

  // Optional camera animation
  animation?: CameraAnimation;
}

export interface Marker {
  id: string;
  time: number;           // seconds
  name: string;
  color: string;
}

export interface TimelineState {
  currentTime: number;    // seconds
  duration: number;       // total duration in seconds
  isPlaying: boolean;
  frameRate: number;
  zoom: number;           // timeline zoom level
  scrollPosition: number;
}

export interface Timecode {
  hours: number;
  minutes: number;
  seconds: number;
  frames: number;
}

export function secondsToTimecode(seconds: number, frameRate: number): Timecode {
  const totalFrames = Math.floor(seconds * frameRate);
  const frames = totalFrames % frameRate;
  const totalSeconds = Math.floor(totalFrames / frameRate);
  const secs = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const mins = totalMinutes % 60;
  const hrs = Math.floor(totalMinutes / 60);

  return {
    hours: hrs,
    minutes: mins,
    seconds: secs,
    frames: frames,
  };
}

export function timecodeToString(tc: Timecode): string {
  return `${tc.hours.toString().padStart(2, '0')}:${tc.minutes.toString().padStart(2, '0')}:${tc.seconds.toString().padStart(2, '0')}:${tc.frames.toString().padStart(2, '0')}`;
}

export function secondsToTimecodeString(seconds: number, frameRate: number): string {
  return timecodeToString(secondsToTimecode(seconds, frameRate));
}
