const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://facebook.github.io/metro/docs/configuration
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = {
  resolver: {
    extraNodeModules: {
      // 이 부분을 추가했습니다.
      events: require.resolve('events'),
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);