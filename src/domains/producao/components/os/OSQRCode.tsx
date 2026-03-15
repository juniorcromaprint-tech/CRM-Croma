import { QRCodeSVG } from 'qrcode.react';

interface OSQRCodeProps {
  url: string;
  size?: number;
}

export function OSQRCode({ url, size = 80 }: OSQRCodeProps) {
  return (
    <div className="flex flex-col items-center gap-1">
      <QRCodeSVG value={url} size={size} level="M" />
      <span className="text-xs text-slate-400">Abrir no sistema</span>
    </div>
  );
}
