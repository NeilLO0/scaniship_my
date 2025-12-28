const HEX_REGEX = /^[0-9A-F]+$/i;
const PACKAGE_REGEX = /^[0-9A-Z]{11}$/;

const hexToAscii = (hex: string) => {
  let result = '';
  for (let i = 0; i < hex.length; i += 2) {
    const byte = parseInt(hex.slice(i, i + 2), 16);
    if (Number.isNaN(byte)) {
      throw new Error('EPC 轉碼失敗');
    }
    result += String.fromCharCode(byte);
  }
  return result;
};

export function convertEpcToPackage(epc: string): string {
  const normalized = epc.replace(/\s+/g, '').toUpperCase();
  if (normalized.length !== 24 || !HEX_REGEX.test(normalized)) {
    throw new Error('EPC 長度或格式錯誤，已記錄為無效標籤');
  }

  let hex = normalized;
  if (hex.startsWith('FF')) {
    hex = hex.slice(2);
  }

  let ascii = hexToAscii(hex);
  if (ascii.charCodeAt(0) === 0xff) {
    ascii = ascii.slice(1);
  }

  const filtered = ascii.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
  if (!PACKAGE_REGEX.test(filtered)) {
    throw new Error('EPC 轉碼內容不符合包裝編號，已記錄為無效標籤');
  }
  return filtered;
}

export function normalizeToPackageId(input: string): string {
  const normalized = input.replace(/\s+/g, '').toUpperCase();
  if (PACKAGE_REGEX.test(normalized)) {
    return normalized;
  }
  return convertEpcToPackage(normalized);
}
