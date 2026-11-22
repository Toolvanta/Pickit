// Stand-in for the chrome.* extension APIs, used only by scripts/preview.mjs.
(() => {
  const KEY = 'pickkit-preview';
  const now = Date.now();
  const color = (hex, i, extra = {}) => ({ id: `c${i}`, hex, ts: now - i * 600000, origin: 'example.com', ...extra });
  const font = (id, family, extra) => ({
    id,
    ts: now - 120000,
    origin: 'example.com',
    family,
    certain: true,
    stack: `${family}, sans-serif`,
    size: 16,
    weight: 400,
    style: 'normal',
    lineHeight: '1.5',
    letterSpacing: 'normal',
    color: '#17171F',
    source: 'google',
    sourceLabel: 'Google Fonts',
    link: `https://fonts.google.com/specimen/${family}`,
    ...extra,
  });
  const seed = {
    colors: ['#0F7A55', '#17794A', '#FBBF24', '#FB7185', '#38BDF8', '#17171F', '#F6F6F9', '#C2343F', '#6A5ACD', '#34D399'].map(
      (hex, i) => color(hex, i, i === 0 ? { token: '--brand-600' } : {}),
    ),
    fonts: [
      font('f1', 'Inter', { weight: 600, size: 32, lineHeight: '1.2', letterSpacing: '-0.02em' }),
      font('f2', 'Georgia', { certain: false, source: 'system', sourceLabel: 'Installed on this device', link: undefined }),
    ],
    savedFonts: [font('f3', 'Roboto')],
    palettes: [{ id: 'p1', name: 'Brand', colors: ['#5548E0', '#17794A', '#FBBF24', '#FB7185'], ts: now }],
    stats: { picks: 3, ratingDismissed: false },
  };
  const scan = {
    title: 'Example Domain: a sample page',
    host: 'example.com',
    truncated: false,
    colors: [
      { hex: '#17171F', text: 120, background: 2, border: 0 },
      { hex: '#FFFFFF', text: 14, background: 40, border: 0 },
      { hex: '#5548E0', text: 22, background: 9, border: 4 },
      { hex: '#5A5A6B', text: 60, background: 0, border: 0 },
      { hex: '#E2E2EA', text: 0, background: 3, border: 31 },
      { hex: '#F6F6F9', text: 0, background: 18, border: 0 },
      { hex: '#17794A', text: 5, background: 2, border: 0 },
      { hex: '#C2343F', text: 3, background: 1, border: 1 },
    ],
    fonts: [
      {
        family: 'Inter',
        certain: true,
        source: 'google',
        sourceLabel: 'Google Fonts',
        link: 'https://fonts.google.com/specimen/Inter',
        count: 184,
        sizes: [12, 13, 14, 16, 20, 24, 32, 48],
        weights: [400, 500, 600, 700],
      },
      {
        family: 'Cascadia Code',
        certain: false,
        source: 'system',
        sourceLabel: 'Installed on this device',
        count: 12,
        sizes: [13],
        weights: [400],
      },
    ],
  };

  const read = () => JSON.parse(localStorage.getItem(KEY) ?? 'null') ?? structuredClone(seed);
  const write = (data) => localStorage.setItem(KEY, JSON.stringify(data));
  const messageListeners = [];
  const changeListeners = new Set();
  const event = () => ({ addListener() {}, removeListener() {} });

  window.chrome = {
    runtime: {
      id: 'preview',
      getURL: (path) => path,
      getManifest: () => ({ version: '1.0.0' }),
      openOptionsPage: async () => void (location.href = '/options.html'),
      setUninstallURL: async () => {},
      onInstalled: event(),
      onMessage: { addListener: (fn) => messageListeners.push(fn), removeListener() {} },
      sendMessage: async (message) => {
        if (message.t === 'capture') return { ok: true, dataUrl: window.__capture() };
        if (message.t === 'scan') return { ok: true, result: scan };
        return { ok: true };
      },
    },
    storage: {
      local: {
        get: async (key) => {
          const data = read();
          return typeof key === 'string' ? (key in data ? { [key]: data[key] } : {}) : data;
        },
        set: async (items) => {
          const data = read();
          const changes = {};
          for (const [key, value] of Object.entries(items)) {
            changes[key] = { oldValue: data[key], newValue: value };
            data[key] = value;
          }
          write(data);
          changeListeners.forEach((fn) => fn(changes, 'local'));
        },
        clear: async () => write({}),
      },
      onChanged: { addListener: (fn) => changeListeners.add(fn), removeListener: (fn) => changeListeners.delete(fn) },
    },
    tabs: {
      query: async () => [{ id: 1, url: 'https://example.com/', windowId: 1, active: true }],
      create: async () => {},
      onActivated: event(),
      onUpdated: event(),
    },
    windows: { getCurrent: async () => ({ id: 1 }) },
    sidePanel: { open: async () => void (location.href = '/sidepanel.html'), setPanelBehavior: async () => {} },
    permissions: { contains: async () => false, request: async () => true, remove: async () => true },
    commands: {
      getAll: async () => [
        { name: 'pick-color', shortcut: 'Alt+Shift+C' },
        { name: 'inspect-font', shortcut: 'Alt+Shift+F' },
      ],
    },
  };

  // Lets the harness page talk to the overlay as the background worker would.
  window.__pkSend = (message) => new Promise((resolve) => messageListeners.forEach((fn) => fn(message, {}, resolve)));
  window.__pkStore = read;
})();
