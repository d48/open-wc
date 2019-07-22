import path from 'path';
import { toBrowserPath } from './utils/utils.js';
import { compatibilityModes } from './constants.js';

/**
 * @typedef {object} Config
 * @property {number} [port]
 * @property {string} [hostname]
 * @property {string} [rootDir]
 * @property {string} [appIndex]
 * @property {string} [appIndexDir]
 * @property {string[]} [moduleDirectories]
 * @property {boolean} [nodeResolve]
 * @property {boolean} [readUserBabelConfig]
 * @property {boolean} [watch]
 * @property {boolean} [openBrowser]
 * @property {string} [openPath]
 * @property {boolean} [logStartup]
 * @property {boolean} [http2]
 * @property {string} [compatibilityMode]
 * @property {string[]} [watchExcludes]
 * @property {number} [watchDebounce]
 * @property {object} [customBabelConfig]
 * @property {string[]} [extraFileExtensions]
 * @property {string[]} [babelExclude]
 * @property {string[]} [babelModernExclude]
 * @property {import('koa').Middleware[]} [customMiddlewares]
 */

/**
 * Creates dev server config with default settings
 * @param {Partial<Config>} config
 */
export function createConfig(config) {
  const {
    port = 8080,
    hostname = '127.0.0.1',
    rootDir = process.cwd(),
    moduleDirectories = ['node_modules'],
    nodeResolve = false,
    readUserBabelConfig = false,
    customBabelConfig = null,
    watch = false,
    openBrowser = false,
    openPath = null,
    logStartup = false,
    http2 = false,
    extraFileExtensions = [],
    compatibilityMode = compatibilityModes.NONE,
    babelExclude = [],
    babelModernExclude = [],
    watchExcludes = ['node_modules/**'],
    watchDebounce = 1000,
    customMiddlewares = null,
  } = config;

  let { appIndex } = config;
  let appIndexDir;

  // resolve appIndex relative to rootDir and transform it to a browser path
  if (appIndex) {
    if (path.isAbsolute(appIndex)) {
      appIndex = `/${toBrowserPath(path.relative(rootDir, appIndex))}`;
    } else if (!appIndex.startsWith('/')) {
      appIndex = `/${toBrowserPath(appIndex)}`;
    } else {
      appIndex = toBrowserPath(appIndex);
    }

    appIndexDir = `${appIndex.substring(0, appIndex.lastIndexOf('/'))}`;
  }

  return {
    port,
    hostname,
    rootDir,
    appIndexDir,
    appIndex,
    moduleDirectories,
    nodeResolve,
    readUserBabelConfig,
    customBabelConfig,
    watch,
    openBrowser,
    openPath,
    logStartup,
    http2,
    extraFileExtensions,
    compatibilityMode,
    babelExclude,
    babelModernExclude,
    watchExcludes,
    watchDebounce,
    customMiddlewares,
  };
}
