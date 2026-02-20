"use client";

import { SearchCommand } from "@/components/header/search-command";

export function Header() {
    return (
        <header className="hidden md:flex h-14 items-center gap-4 border-b border-border/60 bg-card/50 px-4 md:px-6 2xl:px-8 sticky top-0 z-10 backdrop-blur-sm">
            <div className="flex flex-1 items-center gap-4">
                <div className="ml-auto flex-1 sm:flex-initial hidden md:block">
                    <SearchCommand />
                </div>
            </div>
        </header>
    );
}
