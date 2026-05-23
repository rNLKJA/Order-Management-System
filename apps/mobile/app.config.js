/** @type {import('expo/config').ExpoConfig} */
const app = require('./app.json');

const THERMAL_PLUGIN = [
  'react-native-thermal-printer-driver',
  {
    bluetoothAlwaysPermission: '用于连接厨房蓝牙热敏打印机，打印餐盒标签。',
  },
];

module.exports = () => {
  const plugins = ['expo-router', 'expo-secure-store'];

  // Expo 51 local web dev cannot load this plugin; enable for EAS / prebuild only.
  if (process.env.EAS_BUILD === 'true' || process.env.EXPO_INCLUDE_THERMAL_PLUGIN === '1') {
    plugins.push(THERMAL_PLUGIN);
  }

  return {
    ...app.expo,
    plugins,
  };
};
