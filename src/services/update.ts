import { appInfo } from '../native/appInfo';

type ReleaseAsset = { name: string; browser_download_url: string };
type ReleaseInfo = {
  tag_name: string;
  name?: string;
  body?: string;
  assets?: ReleaseAsset[];
};

const GITHUB_OWNER = 'NeilLO0';
const GITHUB_REPO = 'scaniship_my';
const RELEASE_API = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;

const parseTag = (tag: string) => {
  const cleaned = tag.trim().replace(/^v/i, '');
  const parts = cleaned.split('-');
  const versionName = parts[0] || '0';
  const versionCode = parts.length > 1 ? parts[parts.length - 1] : '0';
  return { versionName, versionCode };
};

const compareVersionCode = (a: string, b: string) => {
  const na = Number(a);
  const nb = Number(b);
  if (!Number.isFinite(na) || !Number.isFinite(nb)) return 0;
  return na - nb;
};

const compareVersionName = (a: string, b: string) => {
  const pa = a.split('.').map((v) => Number(v));
  const pb = b.split('.').map((v) => Number(v));
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i += 1) {
    const av = pa[i] || 0;
    const bv = pb[i] || 0;
    if (av !== bv) return av - bv;
  }
  return 0;
};

const pickApkAsset = (assets: ReleaseAsset[] = []) => {
  const apk = assets.find((a) => a.name.toLowerCase().endsWith('.apk'));
  return apk ?? null;
};

export type UpdateCheckResult =
  | { status: 'up-to-date' }
  | {
      status: 'update-available';
      versionName: string;
      versionCode: string;
      downloadUrl: string;
      releaseNotes?: string;
    }
  | { status: 'error'; message: string };

export const getSuggestedTag = (versionName: string, versionCode: string) =>
  `v${versionName}-${versionCode}`;

export const checkForUpdate = async (): Promise<UpdateCheckResult> => {
  if (GITHUB_OWNER === 'REPLACE_OWNER' || GITHUB_REPO === 'REPLACE_REPO') {
    return { status: 'error', message: 'GitHub repo not configured.' };
  }

  try {
    const [local, resp] = await Promise.all([appInfo.getAppVersion(), fetch(RELEASE_API)]);
    if (!resp.ok) {
      return { status: 'error', message: `Update check failed: ${resp.status}` };
    }
    const release = (await resp.json()) as ReleaseInfo;
    const tagInfo = parseTag(release.tag_name || '');
    const latestName = tagInfo.versionName;
    const latestCode = tagInfo.versionCode;

    const byCode = compareVersionCode(latestCode, local.versionCode);
    const byName = compareVersionName(latestName, local.versionName);
    const hasUpdate = byCode > 0 || (byCode === 0 && byName > 0);
    if (!hasUpdate) return { status: 'up-to-date' };

    const asset = pickApkAsset(release.assets);
    if (!asset) {
      return { status: 'error', message: 'No APK asset found in latest release.' };
    }

    return {
      status: 'update-available',
      versionName: latestName,
      versionCode: latestCode,
      downloadUrl: asset.browser_download_url,
      releaseNotes: release.body,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown update error';
    return { status: 'error', message };
  }
};
