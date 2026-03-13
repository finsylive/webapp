"use client";

import { useState, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Download, X, QrCode } from 'lucide-react';
import Image from 'next/image';

type StallQRCodeProps = {
  eventId: string;
  stallId: string;
  stallName: string;
  startupId?: string | null;
};

export function StallQRCode({ eventId, stallId, stallName, startupId }: StallQRCodeProps) {
  const [showModal, setShowModal] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '');
  // If startup is linked, QR points to startup profile with arena context; otherwise fallback to /invest page
  const investUrl = startupId
    ? `${baseUrl}/startups/${startupId}?fromArena=1&eventId=${encodeURIComponent(eventId)}&stallId=${encodeURIComponent(stallId)}`
    : `${baseUrl}/invest/${eventId}/${stallId}`;

  const handleDownload = async () => {
    if (!cardRef.current) return;
    try {
      const htmlToImage = await import('html-to-image');
      const dataUrl = await htmlToImage.toPng(cardRef.current, { quality: 1.0, pixelRatio: 2 });
      const link = document.createElement('a');
      link.download = `${stallName.replace(/\s+/g, '_')}_QR.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to download QR code card:', err);
    }
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
          <div className="relative w-full max-w-sm mx-4 rounded-2xl border border-border/60 bg-background shadow-2xl overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
              <h3 className="font-bold text-foreground">Investment QR Code</h3>
              <button onClick={() => setShowModal(false)} className="rounded-full p-1.5 hover:bg-muted/20 transition">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-5 py-6 space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                Audience can scan this QR code to invest virtual funds.
              </p>

              {/* The Card to be downloaded */}
              <div className="flex justify-center">
                <div 
                  ref={cardRef}
                  className="bg-white p-6 rounded-2xl flex flex-col items-center shadow-sm border border-gray-100 w-[280px]"
                >
                  <div className="mb-4 flex flex-col items-center">
                    {/* Placeholder for Ments Logo, or you can use your specific logo SVG */}
                    <div className="flex items-center gap-2">
                      <Image src="/logo/black_logo.svg" alt="Ments Logo" width={32} height={32} />
                      <span className="font-bold text-xl tracking-tight text-black">ments</span>
                    </div>
                  </div>
                  <QRCodeSVG
                    id="stall-qr-svg"
                    value={investUrl}
                    size={200}
                    level="H"
                    includeMargin={false}
                  />
                  <div className="mt-4 text-center w-full">
                    <p className="text-lg font-bold text-black truncate">{stallName}</p>
                    <p className="text-xs text-gray-500 mt-1">Scan to Invest</p>
                  </div>
                </div>
              </div>

              <p className="text-xs text-center text-muted-foreground break-all px-2 mt-2">
                {investUrl}
              </p>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleDownload}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-3 text-sm transition"
                >
                  <Download className="h-4 w-4" />
                  Download Card
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
