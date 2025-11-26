export type ApiEnvironment = 'production' | 'staging';

type ApiCredential = {
  baseUrl: string;
  apiKey: string;
  apiSecret: string;
};

const CREDENTIALS: Record<ApiEnvironment, ApiCredential> = {
  production: {
    baseUrl: 'https://packageplus.space',
    apiKey: 'Np1g2MpvB37Mmn68G1O5eHafP',
    apiSecret: 'wWx98ChAAAKa87V9o44Jhd71',
  },
  staging: {
    baseUrl: 'https://carartbon.com',
    apiKey: 'Mj09CEBmIyVnMW4MNGEHdlXFx',
    apiSecret: 'g6B18AL0NouX50mFYPRxX5RP',
  },
};

/**
 * Force the app to use the staging (測試) environment so we can validate
 * against the test API keys without touching production data.
 */
const ACTIVE_ENV: ApiEnvironment = 'staging';

export const apiConfig = CREDENTIALS[ACTIVE_ENV];

export const endpoints = {
  login: '/api/rfid/login',
  logisticBranch: '/api/rfid/getLogisticBranch',
  insert: '/api/rfid/rfidInsert',
} as const;
