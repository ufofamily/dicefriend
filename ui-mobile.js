/* diceFriend CORE: presentation-only progressive enhancement.
   All audio, MIDI, recording and preset logic remains in the original modules. */
(() => {
  const mobileQuery = window.matchMedia('(max-width: 900px)');
  const boot = () => {
    const nav = document.querySelector('.studio-nav');
    const transport = document.querySelector('.studio-transport');
    if (!nav || !transport || !document.querySelector('#midiPanel')) return false;
    const captions = {synth: ['01', 'SYNTH'], sample: ['02', 'SAMPLE'], midi: ['03', 'MIDI'], master: ['04', 'MASTER']};
    nav.querySelectorAll('[data-view]').forEach(btn => {
      const [index, label] = captions[btn.dataset.view];
      btn.replaceChildren();
      const idx = document.createElement('span'); idx.className = 'nav-index'; idx.textContent = index;
      const name = document.createElement('span'); name.className = 'nav-name'; name.textContent = label;
      btn.append(idx, name);
      btn.setAttribute('aria-label', label);
    });

    // Keep the detailed transport controls available but outside the mobile first-screen layout.
    const fold = document.createElement('details');
    fold.className = 'transport-fold';
    const summary = document.createElement('summary');
    summary.innerHTML = '<span>CLOCK / TRANSPORT</span><span class="fold-meta"><strong id="clockBpmReadout">120 BPM</strong><span class="fold-arrow">+</span></span>';
    while (transport.firstChild) fold.appendChild(transport.firstChild);
    transport.append(summary, fold); // summary must be first inside details, moved below
    fold.prepend(summary);
    const bpm = document.querySelector('#studioBpm');
    const readout = document.querySelector('#clockBpmReadout');
    const updateBpm = () => { if (bpm && readout) readout.textContent = `${bpm.value || '120'} BPM`; };
    bpm?.addEventListener('change', updateBpm);
    bpm?.addEventListener('input', updateBpm);
    updateBpm();
    const instrumentData = document.querySelector('#instrumentDetails');
    const sessionSettings = document.querySelector('.session-more');
    const apply = () => {
      fold.open = !mobileQuery.matches;
      if (instrumentData) instrumentData.open = !mobileQuery.matches;
      if (sessionSettings) sessionSettings.open = !mobileQuery.matches;
    };
    apply();
    mobileQuery.addEventListener?.('change', apply);
    document.body.classList.add('ui-ready');
    return true;
  };
  const run = () => {
    if (boot()) return;
    let retries = 0;
    const retry = () => { if (boot() || ++retries > 120) return; requestAnimationFrame(retry); };
    requestAnimationFrame(retry);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, {once:true});
  else run();
})();
