const os = require('node:os');
const path = require('node:path');

// Keep Expo's local state inside the project in restricted desktop environments.
const expoHome = path.resolve(__dirname, '..', '.expo-home');
os.homedir = () => expoHome;
os.userInfo = () => ({
  uid: -1,
  gid: -1,
  username: 'jsun-bite-local',
  homedir: expoHome,
  shell: null,
});

require('../node_modules/expo/bin/cli');
