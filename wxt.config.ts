import { defineConfig } from 'wxt';

// Manifest is deliberately minimal: `activeTab` instead of host permissions means
// no "read your data on all websites" warning at install. Pickers only run when invoked.
export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: '__MSG_extName__',
    description: '__MSG_extDescription__',
    default_locale: 'en',
    minimum_chrome_version: '116',
    permissions: ['activeTab', 'scripting', 'storage', 'sidePanel'],
    action: { default_title: '__MSG_actionTitle__' },
    commands: {
      'pick-color': {
        suggested_key: { default: 'Alt+Shift+C' },
        description: 'Pick a colour',
      },
      'inspect-font': {
        suggested_key: { default: 'Alt+Shift+F' },
        description: 'Inspect a font',
      },
    },
  },
});
