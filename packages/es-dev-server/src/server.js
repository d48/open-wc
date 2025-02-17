import Koa from 'koa';
import koaStatic from 'koa-static';
import koaEtag from 'koa-etag';
import chokidar from 'chokidar';
import path from 'path';
import { createHistoryAPIFallbackMiddleware } from './middleware/history-api-fallback.js';
import { createBabelMiddleware } from './middleware/babel.js';
import { createReloadBrowserMiddleware } from './middleware/reload-browser.js';
import { createTransformIndexHTMLMiddleware } from './middleware/transform-index-html.js';
import { createMessageChannelMiddleware } from './middleware/message-channel.js';
import { createCacheMiddleware } from './middleware/cache.js';
import { compatibilityModes } from './constants.js';
import { openBrowserAndLogStartup } from './open-browser.js';
import { createHTTPServer } from './utils/create-http-server.js';
import { toBrowserPath } from './utils/utils.js';

/**
 * @typedef {object} EsDevServerConfig
 * @property {number} [port]
 * @property {string} [hostname]
 * @property {string} [rootDir]
 * @property {string} [appIndex]
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

/** @param {EsDevServerConfig} config */
export function startServer(config) {
  const {
    port = 8080,
    hostname = '127.0.0.1',
    rootDir = process.cwd(),
    moduleDirectories = ['node_modules'],
    nodeResolve = false,
    readUserBabelConfig = false,
    customBabelConfig,
    watch = false,
    openBrowser = false,
    openPath,
    logStartup = false,
    http2 = false,
    extraFileExtensions = [],
    compatibilityMode = compatibilityModes.NONE,
    babelExclude = [],
    babelModernExclude = [],
    watchExcludes = ['node_modules/**'],
    watchDebounce = 1000,
    customMiddlewares,
  } = config;

  let { appIndex } = config;
  let appIndexDir;

  // resolve appIndex relative to rootDir and a browser path
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

  if (!Object.values(compatibilityModes).includes(compatibilityMode)) {
    throw new Error(
      `Unknown compatibility mode: ${compatibilityMode}. Must be one of: ${Object.values(
        compatibilityModes,
      )}`,
    );
  }

  const setupBabel =
    customBabelConfig ||
    nodeResolve ||
    [compatibilityModes.ALL, compatibilityModes.MODERN].includes(compatibilityMode) ||
    readUserBabelConfig;
  const setupCompatibility = compatibilityMode && compatibilityMode !== compatibilityModes.NONE;
  const setupTransformIndexHTML = setupBabel || setupCompatibility;
  const setupHistoryFallback = appIndex;
  const setupMessageChanel = watch || setupBabel;

  const app = new Koa();
  /** @type {import('chokidar').FSWatcher | null} */
  const fileWatcher = watch ? chokidar.watch([]) : null;

  // add custom user's middlewares
  if (customMiddlewares && customMiddlewares.length > 0) {
    customMiddlewares.forEach(customMiddleware => {
      app.use(customMiddleware);
    });
  }

  // serves 304 responses if resource hasn't changed
  app.use(createCacheMiddleware());
  // adds etag headers for caching
  app.use(koaEtag());

  // communicate with browser for reload or logging
  if (setupMessageChanel) {
    app.use(createMessageChannelMiddleware({ rootDir, appIndex }));
  }

  // watch files and reload browser
  if (watch) {
    app.use(
      createReloadBrowserMiddleware({
        rootDir,
        fileWatcher,
        watchExcludes,
        watchDebounce,
      }),
    );
  }

  // run code through babel for compatibility with older browsers
  if (setupBabel) {
    app.use(
      createBabelMiddleware({
        rootDir,
        moduleDirectories,
        nodeResolve,
        readUserBabelConfig,
        compatibilityMode,
        extraFileExtensions,
        customBabelConfig,
        babelExclude,
        babelModernExclude,
      }),
    );
  }

  // inject polyfills and shims for compatibility with older browsers
  if (setupTransformIndexHTML) {
    app.use(createTransformIndexHTMLMiddleware({ compatibilityMode, appIndex, appIndexDir }));
  }

  // serve index.html for non-file requests for SPA routing
  if (setupHistoryFallback) {
    app.use(createHistoryAPIFallbackMiddleware({ appIndex, appIndexDir }));
  }

  // serve ststic files
  app.use(
    koaStatic(rootDir, {
      setHeaders(res) {
        res.setHeader('cache-control', 'no-cache');
      },
    }),
  );

  // create http or https/http2 server
  const server = createHTTPServer(app.callback(), http2);

  // start the server, open the browser and log messages
  server.listen({ port, host: hostname }, () => {
    openBrowserAndLogStartup({
      appIndex,
      openBrowser,
      openPath,
      hostname,
      port,
      rootDir,
      logStartup,
      http2,
    });
  });

  // cleanup after quit
  server.addListener('close', () => {
    if (fileWatcher) {
      fileWatcher.close();
    }
  });

  return {
    server,
    app,
  };
}
