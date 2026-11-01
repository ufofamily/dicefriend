/* DICEFRIEND // RACK 01 — UI layer only.
   All music/audio behaviour is delegated to existing controls.
   Does not alter the DSP, transport, MIDI or recorder engines. */
(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const label = (text, className) => {
    const el = document.createElement('span');
    el.className = className;
    el.textContent = text;
    return el;
  };
  let prepared = false;
  function init() {
    if (prepared || !$('.studio-nav') || !$('#transportStart') || !$('#presetPanel') || !$('#midiPanel')) return false;
    prepared = true;
    const main = $('main');
    document.body.classList.add('rack-ui');

    // Restore meaningful, short controls for four producer workflows.
    const names = {synth:['01','SYNTH'],sample:['02','SAMPLE'],midi:['03','MIDI'],master:['04','MASTER']};
    document.querySelectorAll('.studio-nav [data-view]').forEach(b => {
      const [number, title] = names[b.dataset.view];
      b.replaceChildren(label(number,'nav-index'),label(title,'nav-name'));
      b.setAttribute('aria-label', title);
    });

    const deck = document.createElement('section');
    deck.className = 'rack-deck';
    deck.setAttribute('aria-label', 'Основное управление студией');
    deck.innerHTML = `
      <div class="rack-deck-status">
        <div class="rack-model"><span class="rack-eyebrow">DICEFRIEND / RACK UNIT 01</span><strong>CORE <em>STUDIO</em></strong></div>
        <div class="lcd lcd--green" role="status" aria-live="off"><span>SESSION / CLOCK</span><strong id="rackReadout">120.0 BPM</strong><small id="rackState">STANDBY</small></div>
        <div class="lcd lcd--blue"><span>OUTPUT / STATUS</span><strong id="rackOutput">READY</strong><small id="rackMessage">TAP AUDIO TO ENABLE</small></div>
      </div>
      <div class="rack-deck-actions">
        <button id="rackAudio" class="rack-button rack-button--power" aria-label="Включить или выключить синтезатор">◉ <span>AUDIO</span></button>
        <button id="rackPlay" class="rack-button rack-button--play" aria-label="Запустить общий транспорт">▶ <span>PLAY</span></button>
        <button id="rackStop" class="rack-button" aria-label="Остановить общий транспорт">■ <span>STOP</span></button>
        <button id="rackDice" class="rack-button rack-button--dice" aria-label="Случайные параметры">⚄ <span>DICE</span></button>
        <button id="rackRecord" class="rack-button rack-button--rec" aria-label="Начать или остановить запись">● <span>REC</span></button>
      </div>
      <div class="rack-deck-foot"><span><i class="rack-pilot"></i> LIVE AUDIO ENGINE</span><span id="rackContext">LOCAL / STEREO</span><button id="rackSettings" type="button">SETTINGS <span aria-hidden="true">↗</span></button></div>`;
    main.insertBefore(deck, $('.studio-nav'));

    // The pads belong immediately after the sound selector, before fine-tuning.
    const instrument = $('.instrument');
    const bottom = $('.hardware-bottom',instrument);
    const knobs = $('.knobs',instrument);
    if (bottom && knobs) knobs.before(bottom);
    const help = $('#padHelp');
    if (help && bottom) bottom.after(help);

    // Preserve all patch and session controls, hide secondary controls in an explicit drawer.
    const bank = $('.factory-bank');
    if (bank) {
      const patches = document.createElement('details');
      patches.className = 'rack-patch-drawer';
      patches.innerHTML = '<summary><span>PATCH LIBRARY</span><small>GENRE / PRESET / ADD</small></summary>';
      bank.before(patches);
      patches.append(bank);
    }

    const session = $('.session-bar');
    if (session) {
      const badge = document.createElement('div');
      badge.className = 'rack-panel-tag';
      badge.textContent = 'PATCH / SESSION MEMORY';
      session.prepend(badge);
      // A performer needs pads before administrative patch-management controls.
      // Keep patch switching available in a one-row live strip.
      const quick = document.createElement('div');
      quick.className = 'rack-live-patches';
      quick.setAttribute('aria-label','Быстрое переключение пресетов');
      const tabs = $('#presetTabs');
      if (tabs) {
        quick.append(label('BANK','rack-live-label'),tabs);
        $('.studio-nav').after(quick);
      }
      const workspace = $('.workspace');
      if (workspace) workspace.after(session);
      const syncPatchStrip = () => { quick.hidden = $('.studio-nav [aria-selected="true"]')?.dataset.view !== 'synth'; };
      $('.studio-nav').querySelectorAll('[data-view]').forEach(b => b.addEventListener('click',syncPatchStrip));
      syncPatchStrip();
    }
    const instrumentDetails = $('#instrumentDetails');
    const syncDetails = $('.session-more');
    const keyDetails = $('.keyboard-help');
    const setCompact = () => {
      if (window.matchMedia('(max-width: 850px)').matches) {
        if (instrumentDetails) instrumentDetails.open = false;
        if (syncDetails) syncDetails.open = false;
        if (keyDetails) keyDetails.open = false;
      }
    };
    setCompact();
    // A smaller secondary transport view, without moving any pre-bound buttons.
    const detailedTransport = $('.studio-transport');
    if (detailedTransport) {
      const fold = document.createElement('details');
      fold.className = 'rack-clock-drawer';
      fold.innerHTML = '<summary><span>TRANSPORT / TEMPO / SYNC</span><small>ADVANCED CLOCK ↗</small></summary>';
      const workspace = $('.workspace');
      if (workspace) workspace.after(fold);
      else detailedTransport.before(fold);
      fold.append(detailedTransport);
    }

    const activate = (selector) => { const control = $(selector); if (control && !control.disabled) control.click(); };
    $('#rackAudio').addEventListener('click', () => activate('#start'));
    $('#rackPlay').addEventListener('click', () => activate('#transportStart'));
    $('#rackStop').addEventListener('click', () => activate('#transportStop'));
    // The original hardware DICE listens to pointerup rather than click.
    // Studio DICE exposes a proper click action and honours per-source masks.
    $('#rackDice').addEventListener('click', () => activate('#studioDice'));
    $('#rackRecord').addEventListener('click', () => activate('#record'));
    $('#rackSettings').addEventListener('click', () => {
      activate('.studio-nav [data-view="synth"]');
      if (instrumentDetails) {
        instrumentDetails.open = !instrumentDetails.open;
        if (instrumentDetails.open) instrumentDetails.scrollIntoView({block:'nearest',behavior:'smooth'});
      }
    });

    function syncReadouts() {
      const bpm = $('#studioBpm')?.value || $('#tempo')?.value || '120';
      const playing = $('#transportState')?.textContent?.includes('RUNNING');
      const activeSynth = $('#led')?.classList.contains('on');
      const recording = $('#record')?.classList.contains('recording');
      const clip = $('#clipIndicator')?.classList.contains('clipping');
      const value = Number(bpm);
      $('#rackReadout').textContent = Number.isFinite(value) ? value.toFixed(1)+' BPM' : bpm+' BPM';
      $('#rackState').textContent = recording ? '● RECORDING' : playing ? '▶ TRANSPORT RUNNING' : activeSynth ? '● SYNTH ACTIVE' : '■ TRANSPORT STOPPED';
      $('#rackOutput').textContent = clip ? 'CLIP!' : recording ? 'CAPTURE' : (activeSynth || playing) ? 'ON AIR' : 'IDLE';
      $('#rackOutput').parentElement.classList.toggle('lcd--alert', !!clip);
      $('#rackAudio').classList.toggle('is-on', !!activeSynth);
      $('#rackPlay').classList.toggle('is-on', !!playing);
      $('#rackRecord').classList.toggle('is-recording', !!recording);
      $('#rackMessage').textContent = recording ? ($('#recordTime')?.textContent || 'RECORDING') :
        ($('#studioStatus')?.textContent || $('#message')?.textContent || '').replace(/\s+/g,' ').slice(0,35) || 'AUDIO READY';
      $('#rackContext').textContent = ($('.studio-nav [aria-selected="true"] .nav-name')?.textContent || 'SYNTH') + ' / LOCAL STEREO';
    }
    syncReadouts();
    const interval = window.setInterval(syncReadouts,500);
    window.addEventListener('pagehide', () => window.clearInterval(interval), {once:true});
    return true;
  }
  function boot() {
    if (init()) return;
    let frames = 0;
    const retry = () => { if (init() || ++frames > 180) return; requestAnimationFrame(retry); };
    requestAnimationFrame(retry);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
})();
