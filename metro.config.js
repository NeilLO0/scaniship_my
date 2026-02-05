const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const defaultConfig = getDefaultConfig(__dirname);
const resolveRequest = defaultConfig.resolver.resolveRequest;
const config = {
  resolver: {
    resolveRequest: (context, moduleName, platform) => {
      if (resolveRequest) {
        return resolveRequest(context, moduleName, platform);
      }
      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

module.exports = mergeConfig(defaultConfig, config);
