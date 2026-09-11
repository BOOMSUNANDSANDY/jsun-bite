const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');

const projectDirectory = path.resolve(__dirname, '..');
const localHome = path.join(projectDirectory, '.expo-home');
const localEasDirectory = path.join(localHome, 'eas-cli-nodejs');

const originalUserInfo = os.userInfo.bind(os);
os.userInfo = (options) => {
  try {
    return originalUserInfo(options);
  } catch {
    const encoding = options?.encoding;
    const username = process.env.USERNAME || 'sun';
    const homedir = process.env.USERPROFILE || 'C:\\Users\\sun';
    if (encoding === 'buffer') {
      return {
        uid: -1,
        gid: -1,
        username: Buffer.from(username),
        homedir: Buffer.from(homedir),
        shell: null,
      };
    }
    return { uid: -1, gid: -1, username, homedir, shell: null };
  }
};

os.homedir = () => localHome;

const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === 'env-paths') {
    return (name) => ({
      data: path.join(localEasDirectory, 'data', name),
      config: path.join(localEasDirectory, 'config', name),
      cache: path.join(localEasDirectory, 'cache', name),
      log: path.join(localEasDirectory, 'log', name),
      temp: path.join(localEasDirectory, 'temp', name),
    });
  }
  return originalLoad.call(this, request, parent, isMain);
};
