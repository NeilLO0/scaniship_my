import HmacSHA256 from 'crypto-js/hmac-sha256';
import { apiConfig, endpoints } from '../config/api';
import { Session } from '../storage/session';

type LoginResponse = {
  success: boolean;
  message?: string;
  data?: {
    user: {
      id: number;
      account: string;
      name: string;
      node: number;
      branch: number;
    };
    token: string;
  };
};

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days per spec

const buildSignature = (timestamp: number, method: string, payload: string) => {
  const message = `${timestamp}${method.toUpperCase()}${payload}`;
  return HmacSHA256(message, apiConfig.apiSecret).toString();
};

export async function login(account: string, password: string): Promise<Session> {
  const payload = JSON.stringify({ account, password });
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = buildSignature(timestamp, 'POST', payload);
  const url = `${apiConfig.baseUrl}${endpoints.login}`;

  if (__DEV__) {
    console.log('[RF100] request', { url, env: 'staging' });
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'X-Timestamp': String(timestamp),
      'X-API-Key': apiConfig.apiKey,
      'X-Signature': signature,
    },
    body: payload,
  });

  let json: LoginResponse | null = null;
  try {
    json = (await response.json()) as LoginResponse;
    if (__DEV__) {
      console.log('[RF100] login response', {
        status: response.status,
        success: json?.success,
        message: json?.message,
        user: json?.data?.user,
        tokenPreview: json?.data?.token?.slice(0, 12),
      });
    }
  } catch (error) {
    // 解析失敗時嘗試讀取文字，方便診斷
    const clone = response.clone();
    const text = await clone.text().catch(() => null);
    if (__DEV__) {
      console.warn('[RF100] parse error', {
        status: response.status,
        rawText: text,
      });
    }
    throw new Error('登入回應解析失敗，請稍後重試');
  }

  if (!response.ok || !json?.success || !json?.data) {
    const message = json?.message || `登入失敗 (${response.status})`;
    throw new Error(message);
  }

  return {
    token: json.data.token,
    user: json.data.user,
    expiresAt: Date.now() + TOKEN_TTL_MS,
  };
}
