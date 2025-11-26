import { apiConfig, endpoints } from '../config/api';

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
  } catch (error) {
    throw new Error('節點清單解析失敗');
  }

  if (!response.ok || !json.success || !json.data) {
    throw new Error(json?.message || `節點清單讀取失敗 (${response.status})`);
  }
  return json.data;
}
