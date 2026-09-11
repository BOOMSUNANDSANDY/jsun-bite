const os = require('node:os');
const path = require('node:path');

// This sandbox cannot read the Windows account profile through libuv.
// Give EAS a project-local, gitignored profile without changing system HOME.
const expoHome = path.resolve(__dirname, '..', '.expo-home');
const userInfoShim = path.resolve(__dirname, 'os-userinfo-shim.cjs');
process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS || ''} --require=${userInfoShim}`.trim();
process.env.Path = `${path.dirname(process.execPath)};${process.env.Path || process.env.PATH || ''}`;
process.env.__UNSAFE_EXPO_HOME_DIRECTORY = path.join(expoHome, '.expo');
const easPackage = require.resolve('../node_modules/eas-cli/package.json');
const envPathsModule = require.resolve('env-paths', { paths: [path.dirname(easPackage)] });
const easPaths = {
  data: path.join(expoHome, 'data'),
  config: path.join(expoHome, 'config'),
  cache: path.join(expoHome, 'cache'),
  log: path.join(expoHome, 'log'),
  temp: path.join(expoHome, 'temp'),
};

require.cache[envPathsModule] = {
  id: envPathsModule,
  filename: envPathsModule,
  loaded: true,
  exports: () => easPaths,
};

os.homedir = () => expoHome;
os.userInfo = () => ({
  uid: -1,
  gid: -1,
  username: 'jsun-bite-local',
  homedir: expoHome,
  shell: null,
});

require('../node_modules/eas-cli/bin/run');
