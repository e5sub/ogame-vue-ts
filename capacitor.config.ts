import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'games.wenzi.ogame',
  appName: 'OGame Vue Ts',
  webDir: 'docs',
  server: {
    androidScheme: 'https'
  },
  android: {
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined
    },
    // 启用 WebView 调试，方便排查问题
    webContentsDebuggingEnabled: true,
    allowMixedContent: false
  },
  plugins: {
    // 禁用键盘自动调整视口
    Keyboard: {
      resize: 'none'
    }
  }
}

export default config
