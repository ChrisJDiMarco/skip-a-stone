// The stable station URL redirects to FluxFM's current audio host.
const STREAM = 'https://streams.fluxfm.de/yogasounds/mp3-128/streams.fluxfm.de';
export function setupRadio(toast) {
  const button = document.querySelector('#music');
  const audio = document.querySelector('#radio');
  let wanted = false, attempt = 0, timeout;
  audio.volume = .35;
  function update(status) {
    button.dataset.status = status;
    button.setAttribute('aria-pressed', String(wanted));
    button.setAttribute('aria-label', wanted ? 'Turn Yoga Sounds radio off' : 'Play Yoga Sounds radio');
    button.title = status === 'loading' ? 'Connecting to Yoga Sounds… Click to cancel' : wanted ? 'Yoga Sounds · playing' : 'Play Yoga Sounds by FluxFM';
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
  button.onclick = async () => {
    if (wanted) { stop(); return; }
    wanted = true;
    const id = ++attempt;
    update('loading');
    audio.src = STREAM;
    timeout = setTimeout(fail, 15000);
    try { await audio.play(); } catch { if (id === attempt) fail(); }
  };
  addEventListener('pagehide', stop, { once: true });
  update('off');
}
