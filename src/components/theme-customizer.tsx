"use client"

import * as React from "react"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

export function ThemeCustomizer() {
    const [mounted, setMounted] = React.useState(false)
    const [activeTheme, setActiveTheme] = React.useState<"default" | "lime">("default")

    React.useEffect(() => {
        setMounted(true)
        // Check initial class
        if (document.body.classList.contains("theme-lime")) {
            setActiveTheme("lime")
        }
    }, [])

    const toggleTheme = (theme: "default" | "lime") => {
        setActiveTheme(theme)
        if (theme === "lime") {
            document.body.classList.add("theme-lime")
        } else {
            document.body.classList.remove("theme-lime")
        }
    }

    if (!mounted) {
        return null
    }

    return (
        <div className="grid grid-cols-2 gap-4">
            <div
                className={cn(
                    "cursor-pointer rounded-lg border-2 p-1 hover:border-primary",
                    activeTheme === "default" ? "border-primary" : "border-muted"
                )}
                onClick={() => toggleTheme("default")}
            >
                <div className="flex items-center space-x-2 rounded-md bg-background p-2">
                    <div className="h-10 w-10 rounded-full bg-[#0F172A]" /> {/* Minimalist Black */}
                    <div className="space-y-1">
                        <p className="text-sm font-medium">Black Minimalist</p>
                        <p className="text-xs text-muted-foreground">Original Zen CRM</p>
                    </div>
                    {activeTheme === "default" && <Check className="ml-auto h-4 w-4 text-primary" />}
                </div>
            </div>

            <div
                className={cn(
                    "cursor-pointer rounded-lg border-2 p-1 hover:border-primary",
                    activeTheme === "lime" ? "border-primary" : "border-muted"
                )}
                onClick={() => toggleTheme("lime")}
            >
                <div className="flex items-center space-x-2 rounded-md bg-background p-2">
                    <div className="h-10 w-10 rounded-full bg-[#84CC16]" /> {/* Lime 500 */}
                    <div className="space-y-1">
                        <p className="text-sm font-medium">Fintech Lime</p>
                        <p className="text-xs text-muted-foreground">Premium Style</p>
                    </div>
                    {activeTheme === "lime" && <Check className="ml-auto h-4 w-4 text-[#84CC16]" />}
                </div>
            </div>
        </div>
    )
}
