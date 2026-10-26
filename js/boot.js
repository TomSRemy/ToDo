// Start-up: phone version (?lite) and widget (?widget) switches, read before anything else (kept out of the page so the page can forbid inline scripts)
  // Phone version: index.html?lite (or mobile.html) — same data and sync, fewer features.
  // A phone opening the usual address gets the phone version too (cold audit: the boss opened the desktop layout from a Teams link);
  // ?full keeps the complete version on a phone.
  const narrowTouch=!/[?&](full|widget)\b/.test(location.search) && window.matchMedia && matchMedia('(max-width: 700px) and (pointer: coarse)').matches;
  window.TODO_LITE=/[?&]lite\b/.test(location.search) || narrowTouch;
  if(window.TODO_LITE){ document.getElementById('app-manifest').href='manifest-lite.json'; document.documentElement.classList.add('lite'); }
  // Widget: index.html?widget (widget.html redirects here) — a bubble and a small task panel, same code and data as the app;
  // ?widget&pip is the same panel inside the always-on-top mini window (Chrome/Edge).
  window.TODO_WIDGET=/[?&]widget\b/.test(location.search) && !window.TODO_LITE;
  window.TODO_PIP=window.TODO_WIDGET && /[?&]pip\b/.test(location.search);
  if(window.TODO_WIDGET){ document.documentElement.classList.add('widget'); if(window.TODO_PIP) document.documentElement.classList.add('pip'); }
