const DEFAULT_CERTIFICATE_OPENS_AT = '2026-10-01T08:00:00+08:00';

export const CERTIFICATE_OPENS_AT =
  process.env.CERTIFICATE_OPENS_AT ?? DEFAULT_CERTIFICATE_OPENS_AT;

export function isCertificateOpen(now = Date.now()): boolean {
  if (process.env.BYPASS_CERTIFICATE_OPEN === 'true') {
    return true;
  }

  const opensAt = Date.parse(CERTIFICATE_OPENS_AT);

  if (Number.isNaN(opensAt)) {
    throw new Error('CERTIFICATE_OPENS_AT harus berupa tanggal ISO yang valid.');
  }

  return now >= opensAt;
}

export function getCertificateOpeningLabel(): string {
  const opensAt = Date.parse(CERTIFICATE_OPENS_AT);

  if (Number.isNaN(opensAt)) {
    throw new Error('CERTIFICATE_OPENS_AT harus berupa tanggal ISO yang valid.');
  }

  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Asia/Makassar',
  }).format(opensAt);
}