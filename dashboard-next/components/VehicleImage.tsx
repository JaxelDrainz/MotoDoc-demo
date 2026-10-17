'use client';

import { useState } from 'react';
import { CarFront } from 'lucide-react';

export default function VehicleImage({
  name,
  src,
  credit,
}: {
  name: string;
  src?: string;
  credit?: { label: string; href: string };
}) {
  const [failedSource, setFailedSource] = useState<string>();
  const visible = src && failedSource !== src;
  return (
    <div className="md-vehicle-art relative m-4 min-h-[220px] overflow-hidden rounded-2xl border border-[#e3e8e6] bg-[#eef3f1] md:m-6 md:min-h-[304px]">
      {visible ? (
        <>
          <img
            src={src}
            alt={`${name}, model image`}
            onError={() => setFailedSource(src)}
            className="absolute inset-0 h-full w-full object-contain p-5 pb-10"
          />
          {credit && (
            <a
              href={credit.href}
              target="_blank"
              rel="noreferrer"
              className="absolute bottom-2 right-3 max-w-[85%] truncate rounded-full bg-black/70 px-2.5 py-1 text-[11px] text-white focus-visible:outline-2 focus-visible:outline-white"
            >
              Photo: {credit.label}
            </a>
          )}
        </>
      ) : (
        <div className="flex min-h-[240px] h-full flex-col items-center justify-center gap-3 p-6 text-[#087658]">
          <CarFront size={96} strokeWidth={1} aria-hidden="true" />
          <span className="text-sm text-[#626a72]">{name}</span>
          <span className="text-xs text-[#626a72]">Vehicle image unavailable</span>
        </div>
      )}
    </div>
  );
}
