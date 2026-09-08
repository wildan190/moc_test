// Utilitas Audio Chime synthesizer & Text-to-Speech (Indonesian voice announcer)

/**
 * Memutar nada chime lembut (2 nada harmonis) menggunakan Web Audio API
 */
export function playChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    // Nada pertama (E5 - 659.25 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0.18, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.5);

    // Nada kedua (G#5 - 830.61 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(830.61, now + 0.18);
    gain2.gain.setValueAtTime(0.2, now + 0.18);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.18);
    osc2.stop(now + 0.8);
  } catch (err) {
    console.debug("[Audio] Chime playback blocked or not supported:", err);
  }
}

/**
 * Memanggil nama pelanggan & meja via browser Text-to-Speech (id-ID)
 */
export function speakQueueCall(customerName: string, tableId: string | number) {
  try {
    if (!("speechSynthesis" in window)) return;

    playChime();

    // Beri jeda 600ms setelah nada chime berbunyi
    setTimeout(() => {
      const text = `Nomor antrean atas nama ${customerName}, silakan menuju ke Meja ${tableId}`;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "id-ID";
      utterance.rate = 0.95;
      utterance.pitch = 1.05;

      // Cari suara berbahasa Indonesia jika tersedia di sistem
      const voices = window.speechSynthesis.getVoices();
      const idVoice = voices.find((v) => v.lang.startsWith("id") || v.lang.includes("ID"));
      if (idVoice) utterance.voice = idVoice;

      window.speechSynthesis.speak(utterance);
    }, 600);
  } catch (err) {
    console.debug("[TTS] Speech synthesis error:", err);
  }
}
