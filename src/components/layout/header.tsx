"use client";

import { SearchCommand } from "@/components/header/search-command";

export function Header() {
    return (
        <header className="sticky top-0 z-10 hidden px-5 pt-5 md:block lg:px-6 xl:px-7">
            <div className="flex min-h-16 items-center rounded-[1.6rem] border bg-card px-4 shadow-[0_18px_44px_-34px_rgba(15,23,42,0.42)] backdrop-blur-sm lg:px-5">
                <div className="flex flex-1 items-center gap-4">
                    <div className="w-full max-w-md">
                        <SearchCommand />
                    </div>
                </div>
            </div>
        </header>
    );
}
