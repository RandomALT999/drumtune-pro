// iOS Safari routes Web Audio API output through the quiet earpiece speaker
// instead of the main loudspeaker until a real <audio> element has played at
// least once from a direct user gesture — that's why previews were audible
// over AirPods (a single clear route) but nearly silent on the built-in
// speaker. Playing a silent clip once on the first tap fixes the audio
// session route for every AudioContext sound played afterward.
export function installAudioUnlock() {
  let unlocked = false;
  const unlock = () => {
    if (unlocked) return;
    unlocked = true;
    const audio = document.getElementById("audio-unlock");
    if (audio) audio.play().catch(() => {});
    document.removeEventListener("pointerdown", unlock);
    document.removeEventListener("touchstart", unlock);
  };
  document.addEventListener("pointerdown", unlock, { once: true });
  document.addEventListener("touchstart", unlock, { once: true });
}
