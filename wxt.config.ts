import { defineConfig } from 'wxt';

// Manifest is deliberately minimal: `activeTab` instead of host permissions means
// no "read your data on all websites" warning at install. All-sites access is an
// optional permission the user can grant from the side panel (auto-scan).
export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: '__MSG_extName__',
    description: '__MSG_extDescription__',
    default_locale: 'en',
    minimum_chrome_version: '116',
    permissions: ['activeTab', 'scripting', 'storage', 'sidePanel'],
    optional_host_permissions: ['<all_urls>'],
    action: { default_title: '__MSG_actionTitle__' },
    commands: {
      'pick-color': {
        suggested_key: { default: 'Alt+Shift+C' },
        description: 'Pick a colour from the page',
      },
      'inspect-font': {
        suggested_key: { default: 'Alt+Shift+F' },
        description: 'Inspect fonts on the page',
      },
    },
  },
});
