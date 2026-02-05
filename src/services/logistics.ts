import { apiConfig, endpoints } from '../config/api';
import { reportApiError } from './sentryReport';

export type LogisticBranch = {
  label: string;
  id: number;
  branch_id: number;
};

type BranchResponse = {
  success: boolean;
  message?: string;
  data?: LogisticBranch[];
};

export async function fetchLogisticBranches(userId: number, token: string): Promise<LogisticBranch[]> {
  const url = `${apiConfig.baseUrl}${endpoints.logisticBranch}?id=${userId}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  let json: BranchResponse;
  try {
    json = (await response.json()) as BranchResponse;
    if (__DEV__) {
      console.log('[RF200] branch response', {
        status: response.status,
        success: json?.success,
        message: json?.message,
        count: json?.data?.length ?? 0,
      });
    }
  } catch (error) {
    reportApiError('logistics:parse', error, { status: response.status });
    throw new Error('Failed to parse branch list');
  }

  if (!response.ok || !json.success || !json.data) {
    reportApiError('logistics:response', json?.message || 'failed', { status: response.status });
    throw new Error(json?.message || `Failed to load branches (${response.status})`);
  }
  return json.data;
}
