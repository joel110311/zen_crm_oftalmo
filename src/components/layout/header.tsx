"use client";

import { SearchCommand } from "@/components/header/search-command";

export function Header() {
    return (
        <header className="sticky top-0 z-10 hidden px-4 pt-3.5 md:block lg:px-5 xl:px-6">
            <div className="flex min-h-12 items-center rounded-xl border bg-card px-4 shadow-[0_14px_28px_-22px_rgba(15,23,42,0.35)] backdrop-blur-sm">
                <div className="flex flex-1 items-center gap-4">
                    <div className="w-full max-w-[420px]">
                        <SearchCommand />
                    </div>
                </div>
            </div>
        </header>
    );
}
