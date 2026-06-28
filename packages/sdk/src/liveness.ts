import { useState, useEffect, useRef, useCallback } from 'react';

export type LivenessChallenge = 'blink' | 'turn_left' | 'smile';

export interface LivenessStatus {
  currentChallenge: LivenessChallenge | null;
  challengeIndex: number;
  challenges: LivenessChallenge[];
  instruction: string;
  progress: number; // e.g. for blinks: 0, 1, 2, 3
  attempts: number;
  isLocked: boolean;
  score: number;
  completed: boolean;
}

const dist3d = (p1: { x: number; y: number; z: number }, p2: { x: number; y: number; z: number }) =>
  Math.hypot(p1.x - p2.x, p1.y - p2.y, p1.z - p2.z);

export class LivenessGuard {
  private level: 'strict' | 'standard' | 'off';
  private challenges: LivenessChallenge[] = [];
  private currentChallengeIndex = 0;
  private attempts = 0;
  private isLocked = false;
  
  // State trackers for specific challenges
  private blinkCount = 0;
  private isEyeClosed = false;
  private minEarObserved = 1.0;
  private maxSmileRatioObserved = 0.0;
  private minTurnRatioObserved = 1.0;

  // Challenge scores
  private challengeScores: number[] = [];

  constructor(level: 'strict' | 'standard' | 'off' = 'standard') {
    this.level = level;
    this.isLocked = typeof window !== 'undefined' && localStorage.getItem('praman_liveness_locked') === 'true';
    this.resetAttempt();
  }

  public getChallenges(): LivenessChallenge[] {
    return this.challenges;
  }

  public getCurrentChallengeIndex(): number {
    return this.currentChallengeIndex;
  }

  public getAttempts(): number {
    return this.attempts;
  }

  public getIsLocked(): boolean {
    return this.isLocked;
  }

  /**
   * Resets the current attempt status and selects a new challenge set
   */
  public resetAttempt() {
    if (this.isLocked) return;
    this.currentChallengeIndex = 0;
    this.blinkCount = 0;
    this.isEyeClosed = false;
    this.minEarObserved = 1.0;
    this.maxSmileRatioObserved = 0.0;
    this.minTurnRatioObserved = 1.0;
    this.challengeScores = [];

    // Create a random order of the 3 challenges
    const pool: LivenessChallenge[] = ['blink', 'turn_left', 'smile'];
    this.challenges = this.shuffle(pool);
  }

  /**
   * Shuffles an array helper
   */
  private shuffle<T>(array: T[]): T[] {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /**
   * Registers a failed attempt. If failures hit 3, locks the user out.
   */
  public recordFailedAttempt(): boolean {
    this.attempts += 1;
    if (this.attempts >= 3) {
      this.isLocked = true;
      if (typeof window !== 'undefined') {
        localStorage.setItem('praman_liveness_locked', 'true');
      }
      return true; // Locked
    }
    this.resetAttempt();
    return false; // Not locked yet
  }

  /**
   * Hard reset the lockout status (for debug / support)
   */
  public resetLockout() {
    this.isLocked = false;
    this.attempts = 0;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('praman_liveness_locked');
    }
    this.resetAttempt();
  }

  /**
   * Evaluates standard MediaPipe FaceLandmarker 3D points [0..467]
   */
  public evaluateLandmarks(landmarks: { x: number; y: number; z: number }[]): {
    completed: boolean;
    progress: number;
    challengeSuccess: boolean;
    instruction: string;
  } {
    if (this.isLocked) {
      return { completed: false, progress: 0, challengeSuccess: false, instruction: 'Security locked' };
    }

    if (this.level === 'off') {
      return { completed: true, progress: 100, challengeSuccess: true, instruction: 'Liveness bypass' };
    }

    const currentChallenge = this.challenges[this.currentChallengeIndex];
    if (!currentChallenge) {
      return { completed: true, progress: 100, challengeSuccess: true, instruction: 'Liveness completed' };
    }

    let challengeSuccess = false;
    let progress = 0;
    let instruction = '';

    if (currentChallenge === 'blink') {
      // MediaPipe EAR calculation
      // Left eye outer: 33, Inner: 133, Top: 159, Bottom: 145
      // Right eye outer: 263, Inner: 362, Top: 386, Bottom: 374
      const earLeft = dist3d(landmarks[159], landmarks[145]) / dist3d(landmarks[33], landmarks[133]);
      const earRight = dist3d(landmarks[386], landmarks[374]) / dist3d(landmarks[263], landmarks[362]);
      const ear = (earLeft + earRight) / 2.0;

      if (ear < this.minEarObserved) {
        this.minEarObserved = ear;
      }

      // Blink thresholds
      const closedThreshold = this.level === 'strict' ? 0.10 : 0.12;
      const openThreshold = this.level === 'strict' ? 0.16 : 0.15;

      if (!this.isEyeClosed && ear < closedThreshold) {
        this.isEyeClosed = true;
      } else if (this.isEyeClosed && ear > openThreshold) {
        this.isEyeClosed = false;
        this.blinkCount += 1;
      }

      progress = Math.min(3, this.blinkCount);
      instruction = `Blink your eyes: ${progress}/3 times`;

      if (this.blinkCount >= 3) {
        challengeSuccess = true;
        const blinkScore = Math.min(1.0, Math.max(0.7, (0.22 - this.minEarObserved) * 6));
        this.challengeScores.push(blinkScore);
      }
    } else if (currentChallenge === 'turn_left') {
      // Calculate Yaw using 3D coordinates: Left cheek outer (234), Right cheek outer (454), Nose tip (1)
      const leftCheek = landmarks[234];
      const rightCheek = landmarks[454];
      const nose = landmarks[1];
      
      const cheekWidth = rightCheek.x - leftCheek.x;
      const noseOffset = nose.x - leftCheek.x;
      const ratio = noseOffset / cheekWidth;

      // Yaw in degrees (-50 to +50 range approximately)
      // Mirroring is adjusted so looking left decreases Yaw below -15 degrees
      const yaw = (((leftCheek.x + rightCheek.x) / 2) - nose.x) / cheekWidth * 100;

      if (yaw < this.minTurnRatioObserved) {
        this.minTurnRatioObserved = yaw;
      }

      instruction = 'Turn your head left';
      const targetYaw = -15; // Pass if Yaw < -15 degrees (turned left)
      
      progress = Math.min(100, Math.max(0, Math.round((yaw / targetYaw) * 100)));

      if (yaw < targetYaw) {
        challengeSuccess = true;
        const turnScore = Math.min(1.0, 0.85 + Math.abs(targetYaw - yaw) * 0.02);
        this.challengeScores.push(turnScore);
      }
    } else if (currentChallenge === 'smile') {
      // Mouth corners: 61, 291. Face width: Left cheek (234), Right cheek (454).
      const mouthWidth = dist3d(landmarks[61], landmarks[291]);
      const faceWidth = dist3d(landmarks[234], landmarks[454]);
      const ratio = mouthWidth / faceWidth;

      if (ratio > this.maxSmileRatioObserved) {
        this.maxSmileRatioObserved = ratio;
      }

      instruction = 'Smile warmly';
      const startRatio = 0.30;
      const targetRatio = this.level === 'strict' ? 0.38 : 0.35;

      progress = Math.min(100, Math.max(0, Math.round(((ratio - startRatio) / (targetRatio - startRatio)) * 100)));

      if (ratio > targetRatio) {
        challengeSuccess = true;
        const smileScore = Math.min(1.0, 0.85 + (ratio - targetRatio) * 2.0);
        this.challengeScores.push(smileScore);
      }
    }

    if (challengeSuccess) {
      this.currentChallengeIndex += 1;
      this.blinkCount = 0;
      this.isEyeClosed = false;
      this.minEarObserved = 1.0;
      this.maxSmileRatioObserved = 0.0;
      this.minTurnRatioObserved = 1.0;

      // Are all challenges done?
      if (this.currentChallengeIndex >= this.challenges.length) {
        return { completed: true, progress: 100, challengeSuccess: true, instruction: 'Liveness success!' };
      }
    }

    return {
      completed: false,
      progress,
      challengeSuccess,
      instruction,
    };
  }

  /**
   * Calculates the overall liveness score across all challenges (0.0 to 1.0)
   */
  public getLivenessScore(): number {
    if (this.level === 'off') return 1.0;
    if (this.challengeScores.length === 0) return 0.0;
    const sum = this.challengeScores.reduce((a, b) => a + b, 0);
    return Number((sum / this.challengeScores.length).toFixed(3));
  }
}

/**
 * React Hook wrapping the LivenessGuard state machine
 */
export function useLivenessGuard(level: 'strict' | 'standard' | 'off' = 'standard') {
  const guardRef = useRef<LivenessGuard | null>(null);
  
  if (!guardRef.current) {
    guardRef.current = new LivenessGuard(level);
  }

  const [status, setStatus] = useState<LivenessStatus>({
    currentChallenge: guardRef.current.getChallenges()[0] || null,
    challengeIndex: 0,
    challenges: guardRef.current.getChallenges(),
    instruction: '',
    progress: 0,
    attempts: guardRef.current.getAttempts(),
    isLocked: guardRef.current.getIsLocked(),
    score: 0.0,
    completed: false,
  });

  const evaluateFrame = useCallback((landmarks: { x: number; y: number; z: number }[]) => {
    const guard = guardRef.current;
    if (!guard) return;

    if (guard.getIsLocked()) {
      setStatus((prev) => ({ ...prev, isLocked: true }));
      return;
    }

    const evalResult = guard.evaluateLandmarks(landmarks);
    const score = guard.getLivenessScore();

    setStatus((prev) => ({
      ...prev,
      currentChallenge: guard.getChallenges()[guard.getCurrentChallengeIndex()] || null,
      challengeIndex: guard.getCurrentChallengeIndex(),
      challenges: guard.getChallenges(),
      instruction: evalResult.instruction,
      progress: evalResult.progress,
      attempts: guard.getAttempts(),
      isLocked: guard.getIsLocked(),
      score,
      completed: evalResult.completed,
    }));
  }, []);

  const failAttempt = useCallback(() => {
    const guard = guardRef.current;
    if (!guard) return;
    const locked = guard.recordFailedAttempt();
    setStatus((prev) => ({
      ...prev,
      currentChallenge: guard.getChallenges()[0] || null,
      challengeIndex: 0,
      challenges: guard.getChallenges(),
      instruction: '',
      progress: 0,
      attempts: guard.getAttempts(),
      isLocked: locked,
      score: 0.0,
      completed: false,
    }));
  }, []);

  const resetAll = useCallback(() => {
    const guard = guardRef.current;
    if (!guard) return;
    guard.resetAttempt();
    setStatus((prev) => ({
      ...prev,
      currentChallenge: guard.getChallenges()[0] || null,
      challengeIndex: 0,
      challenges: guard.getChallenges(),
      instruction: '',
      progress: 0,
      attempts: guard.getAttempts(),
      isLocked: guard.getIsLocked(),
      score: 0.0,
      completed: false,
    }));
  }, []);

  const resetLockout = useCallback(() => {
    const guard = guardRef.current;
    if (!guard) return;
    guard.resetLockout();
    setStatus((prev) => ({
      ...prev,
      currentChallenge: guard.getChallenges()[0] || null,
      challengeIndex: 0,
      challenges: guard.getChallenges(),
      instruction: '',
      progress: 0,
      attempts: 0,
      isLocked: false,
      score: 0.0,
      completed: false,
    }));
  }, []);

  return {
    status,
    evaluateFrame,
    failAttempt,
    resetAll,
    resetLockout,
  };
}
