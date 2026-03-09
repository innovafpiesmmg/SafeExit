const audioCtx = typeof window !== "undefined" ? new (window.AudioContext || (window as any).webkitAudioContext)() : null;

let customAuthorizedUrl: string | null = null;
let customDeniedUrl: string | null = null;
let soundsLoaded = false;

export async function loadCustomSounds() {
  if (soundsLoaded) return;
  try {
    const res = await fetch("/api/settings", { credentials: "include" });
    if (res.ok) {
      const settings = await res.json();
      customAuthorizedUrl = settings.sound_authorized || null;
      customDeniedUrl = settings.sound_denied || null;
    }
  } catch {}
  soundsLoaded = true;
}

export function refreshCustomSounds() {
  soundsLoaded = false;
  loadCustomSounds();
}

function playCustomAudio(url: string) {
  const audio = new Audio(url);
  audio.volume = 0.7;
  audio.play().catch(() => {});
}

function playDefaultSuccess() {
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

function playDefaultError() {
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

export function playSuccessSound() {
  if (customAuthorizedUrl) {
    playCustomAudio(customAuthorizedUrl);
  } else {
    playDefaultSuccess();
  }
}

export function playErrorSound() {
  if (customDeniedUrl) {
    playCustomAudio(customDeniedUrl);
  } else {
    playDefaultError();
  }
}
