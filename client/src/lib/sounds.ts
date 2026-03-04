const audioCtx = typeof window !== "undefined" ? new (window.AudioContext || (window as any).webkitAudioContext)() : null;

export function playSuccessSound() {
  if (!audioCtx) return;
  const oscillator = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  oscillator.frequency.value = 880;
  oscillator.type = "sine";
  gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
  oscillator.start(audioCtx.currentTime);
  oscillator.stop(audioCtx.currentTime + 0.15);
}

export function playErrorSound() {
  if (!audioCtx) return;
  const oscillator = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  oscillator.frequency.value = 300;
  oscillator.type = "square";
  gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
  oscillator.start(audioCtx.currentTime);
  oscillator.stop(audioCtx.currentTime + 0.4);
}
