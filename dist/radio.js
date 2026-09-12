// The stable station URL redirects to FluxFM's current audio host.
const STREAM = 'https://streams.fluxfm.de/yogasounds/mp3-128/streams.fluxfm.de';
export function setupRadio(toast) {
  const button = document.querySelector('#music');
  const audio = document.querySelector('#radio');
  let wanted = true, attempt = 0, timeout;
  audio.volume = .35;
  function update(status) {
    button.dataset.status = status;
    button.setAttribute('aria-pressed', String(wanted));
    button.setAttribute('aria-label', wanted ? 'Turn Yoga Sounds radio off' : 'Play Yoga Sounds radio');
    button.title = status === 'ready' ? 'Music on · starts with your first interaction' : status === 'loading' ? 'Connecting to Yoga Sounds… Click to cancel' : wanted ? 'Yoga Sounds · playing' : 'Play Yoga Sounds by FluxFM';
  }
  function stop() {
    wanted = false;
    attempt++;
    clearTimeout(timeout);
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    update('off');
  }
  function fail() {
    if (!wanted) return;
    stop();
    toast('The radio could not connect. Tap the music button to try again.');
  }
  audio.addEventListener('error', fail);
  audio.addEventListener('playing', () => { if (wanted) { clearTimeout(timeout); update('playing'); } });
  audio.addEventListener('waiting', () => { if (wanted) { update('loading'); clearTimeout(timeout); timeout = setTimeout(fail, 15000); } });
  async function start() {
    wanted = true;
    const id = ++attempt;
    update('loading');
    audio.src = STREAM;
    timeout = setTimeout(fail, 15000);
    try { await audio.play(); } catch (error) {
      if (id !== attempt) return;
      clearTimeout(timeout);
      if (error.name === 'NotAllowedError') update('ready');
      else fail();
    }
  }
  button.onclick = () => {
    if (wanted) stop();
    else start();
  };
  function resumeOnGesture(event) {
    if (wanted && button.dataset.status === 'ready' && !button.contains(event.target)) start();
  }
  addEventListener('pointerdown', resumeOnGesture);
  addEventListener('pointerup', resumeOnGesture);
  addEventListener('keydown', resumeOnGesture);
  addEventListener('pagehide', stop, { once: true });
  start();
}
