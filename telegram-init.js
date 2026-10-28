// Telegram Mini App support for pre-built / static-only distribution.
// No bot token or backend. Works as a normal website outside Telegram.
window.addEventListener('DOMContentLoaded', () => {
  const app = window.Telegram?.WebApp;
  if (!app || !app.platform || app.platform === 'unknown') return;

  document.documentElement.classList.add('telegram-miniapp');
  document.querySelector('.keyboard-help')?.removeAttribute('open');
  try { app.setHeaderColor?.('#191c18'); } catch {}
  try { app.setBackgroundColor?.('#191c18'); } catch {}
  try { app.expand(); } catch {}
  try { app.disableVerticalSwipes?.(); } catch {}
  try { app.ready(); } catch {}
});
