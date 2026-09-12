// A quiet, filtered stereo air rush, shared across throws.
export function createFlightWind(context) {
  const buffer = context.createBuffer(2, context.sampleRate * 4, context.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    let smooth = 0;
    for (let i = 0; i < data.length; i++) {
      smooth = (smooth + (Math.random() * 2 - 1) * 0.055) / 1.025;
      data[i] = smooth * 2.2;
    }
    // Match the loop boundary to avoid a repeating click.
    const seam = Math.min(2048, data.length);
    const end = data[data.length - 1];
    for (let i = 0; i < seam; i++) {
      const mix = i / seam;
      data[i] = end * (1 - mix) + data[i] * mix;
    }
  }
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  const highpass = context.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.value = 110;
  const lowpass = context.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = 850;
  lowpass.Q.value = 0.5;
  const gain = context.createGain();
  gain.gain.value = 0;
  source.connect(highpass).connect(lowpass).connect(gain).connect(context.destination);
  source.start();
  let previous = -1;
  return {
    update(intensity) {
      const level = Math.round(Math.max(0, Math.min(1, intensity)) * 100) / 100;
      if (level === previous) return;
      previous = level;
      const now = context.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setTargetAtTime(level * 0.165, now, level ? 0.18 : 0.06);
      lowpass.frequency.cancelScheduledValues(now);
      lowpass.frequency.setTargetAtTime(650 + level * 1550, now, 0.2);
    },
    dispose() {
      source.stop();
      source.disconnect();
      highpass.disconnect();
      lowpass.disconnect();
      gain.disconnect();
    },
  };
}
