import { NativeModules } from 'react-native';

type AppInfoModule = {
  getAppVersion: () => Promise<{ versionName: string; versionCode: string }>;
};

const moduleRef: AppInfoModule | undefined = (NativeModules as any).AppInfo;

export const appInfo = {
  async getAppVersion() {
    if (!moduleRef?.getAppVersion) {
      return { versionName: '0', versionCode: '0' };
    }
    return moduleRef.getAppVersion();
  },
};
