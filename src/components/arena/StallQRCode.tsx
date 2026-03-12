"use client";

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Download, X, QrCode } from 'lucide-react';

type StallQRCodeProps = {
  eventId: string;
  stallId: string;
  stallName: string;
  startupId?: string | null;
};

export function StallQRCode({ eventId, stallId, stallName, startupId }: StallQRCodeProps) {
  const [showModal, setShowModal] = useState(false);

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '');
  // If startup is linked, QR points to startup profile with arena context; otherwise fallback to /invest page
  const investUrl = startupId
    ? `${baseUrl}/startups/${startupId}?fromArena=1&eventId=${encodeURIComponent(eventId)}&stallId=${encodeURIComponent(stallId)}`
    : `${baseUrl}/invest/${eventId}/${stallId}`;

  const handleDownload = () => {
    const svg = document.getElementById('stall-qr-svg');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = 512;
      canvas.height = 512;
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 512, 512);
        ctx.drawImage(img, 0, 0, 512, 512);
      }
      const pngUrl = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.href = pngUrl;
      downloadLink.download = `${stallName.replace(/\s+/g, '_')}_QR.png`;
      downloadLink.click();
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold px-4 py-2.5 text-sm transition hover:bg-emerald-500/20"
      >
        <QrCode className="h-4 w-4" />
        Show QR Code
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative w-full max-w-sm mx-4 rounded-2xl border border-border/60 bg-background shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
              <h3 className="font-bold text-foreground">Investment QR Code</h3>
              <button onClick={() => setShowModal(false)} className="rounded-full p-1.5 hover:bg-muted/20 transition">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-5 py-6 space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                Audience can scan this QR code to invest virtual funds in <strong>{stallName}</strong>.
              </p>

              {/* QR Code */}
              <div className="flex justify-center">
                <div className="bg-white p-4 rounded-xl">
                  <QRCodeSVG
                    id="stall-qr-svg"
                    value={investUrl}
                    size={220}
                    level="H"
                    includeMargin={false}
                  />
                </div>
              </div>

              <p className="text-xs text-center text-muted-foreground break-all px-2">
                {investUrl}
              </p>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={handleDownload}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-3 text-sm transition"
                >
                  <Download className="h-4 w-4" />
                  Download QR
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(investUrl).catch(() => {});
                    setShowModal(false);
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-border/60 bg-card/70 hover:bg-accent/60 text-foreground font-semibold px-4 py-3 text-sm transition"
                >
                  Copy Link
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
