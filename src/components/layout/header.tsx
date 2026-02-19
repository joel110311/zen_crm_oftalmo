"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

import { SearchCommand } from "@/components/header/search-command";

export function Header() {
    return (
        <header className="hidden md:flex h-16 items-center gap-4 border-b bg-card px-4 md:px-6 2xl:px-8 sticky top-0 z-10">
            <div className="flex flex-1 items-center gap-4">
                <div className="ml-auto flex-1 sm:flex-initial hidden md:block">
                    <SearchCommand />
                </div>
            </div>
            <div className="flex items-center gap-4">
            </div>
        </header>
    );
}
