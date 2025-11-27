import { convertEpcToPackage, normalizeToPackageId } from '../src/utils/epc';

describe('convertEpcToPackage', () => {
  it('converts EPC with FF padding to 11-digit code', () => {
    expect(convertEpcToPackage('FF4542474130303030303031')).toBe('EBGA0000001');
  });

  it('trims whitespace and handles lowercase input', () => {
    expect(convertEpcToPackage('ff4542474130303030303031')).toBe('EBGA0000001');
  });

  it('throws on invalid length', () => {
    expect(() => convertEpcToPackage('1234')).toThrow(/EPC 格式錯誤/);
  });
});

describe('normalizeToPackageId', () => {
  it('accepts already converted codes', () => {
    expect(normalizeToPackageId('ebga0000001')).toBe('EBGA0000001');
  });

  it('converts EPC input if not already normalized', () => {
    expect(normalizeToPackageId('FF4542474130303030303031')).toBe('EBGA0000001');
  });
});
