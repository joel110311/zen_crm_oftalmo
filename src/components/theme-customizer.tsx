"use client"

import * as React from "react"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

export function ThemeCustomizer() {
    // The Nexus dark theme is the only theme now — 
    // this component is kept for future theme expansion.
    const [mounted, setMounted] = React.useState(false)

    React.useEffect(() => {
        setMounted(true)
        // Remove any legacy theme classes
        document.body.classList.remove("theme-lime")
    }, [])

    if (!mounted) {
        return null
    }

    return (
        <div className="grid grid-cols-1 gap-4">
            <div className="cursor-default rounded-xl border-2 border-primary p-1">
                <div className="flex items-center space-x-3 rounded-lg bg-secondary p-3">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#3B82F6] to-[#1a1f37] shadow-md" />
                    <div className="space-y-0.5">
                        <p className="text-sm font-semibold text-foreground">Nexus Dark</p>
                        <p className="text-xs text-muted-foreground">Tema único — oscuro y profesional</p>
                    </div>
                    <Check className="ml-auto h-4 w-4 text-primary" />
                </div>
            </div>
        </div>
    )
}
