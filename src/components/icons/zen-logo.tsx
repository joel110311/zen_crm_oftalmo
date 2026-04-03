"use client";

import { cn } from "@/lib/utils";

interface ZenLogoProps {
    className?: string;
}

export function ZenLogo({ className }: ZenLogoProps) {
    // Brand mark: inverted palette (dark base + light candles)
    return (
        <svg
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={cn("h-auto w-auto", className)}
        >
            {/* Dark tile */}
            <rect x="8" y="8" width="84" height="84" rx="22" fill="#0B0D12" />

            {/* Background Grid Hint */}
            <path d="M24 22 L24 78 L78 78" stroke="#2E3442" strokeWidth="2" strokeLinecap="round" />

            {/* Candle 1 (Low) */}
            <line x1="36" y1="63" x2="36" y2="80" stroke="#7B8597" strokeWidth="1.4" />
            <rect x="31" y="63" width="10" height="13" rx="2" fill="#7B8597" />
            <line x1="36" y1="63" x2="36" y2="57" stroke="#7B8597" strokeWidth="1.4" />

            {/* Candle 2 (Mid) */}
            <line x1="54" y1="46" x2="54" y2="68" stroke="#B2BDCC" strokeWidth="1.4" />
            <rect x="49" y="46" width="10" height="17" rx="2" fill="#B2BDCC" />
            <line x1="54" y1="46" x2="54" y2="37" stroke="#B2BDCC" strokeWidth="1.4" />

            {/* Candle 3 (High) */}
            <line x1="71" y1="30" x2="71" y2="56" stroke="#F1F5F9" strokeWidth="1.6" />
            <rect x="65.5" y="30" width="11" height="20" rx="2" fill="#F1F5F9" />
            <line x1="71" y1="30" x2="71" y2="22" stroke="#F1F5F9" strokeWidth="1.6" />
        </svg>
    );
}
