
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";

interface StatsCardProps {
    title: string;
    value: string | number;
    icon: LucideIcon;
    trend?: {
        value: number;
        label?: string;
        isPositive?: boolean;
    };
    description?: string;
    color?: string; // Hex or tailwind class for icon color
    className?: string;
}

export function StatsCard({
    title,
    value,
    icon: Icon,
    trend,
    description,
    color = "text-primary",
    className,
}: StatsCardProps) {
    return (
        <Card className={cn("border-none shadow-sm hover:shadow-md transition-shadow duration-200", className)}>
            <CardContent className="p-4 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                        <p className="text-sm font-medium text-muted-foreground truncate">{title}</p>
                        <div className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground truncate">
                            {value}
                        </div>
                        {description && (
                            <p className="text-xs sm:text-sm text-muted-foreground mt-1 truncate">{description}</p>
                        )}
                    </div>
                    <div
                        className={cn(
                            "p-2.5 sm:p-3 rounded-xl bg-opacity-10 flex items-center justify-center transition-colors shrink-0",
                            // Dynamic bg based on color for a premium feel
                            `bg-[${color}]/10`
                        )}
                        style={{
                            backgroundColor: color.startsWith("#") ? `${color}15` : undefined, // 15 = ~10% opacity hex
                            color: color.startsWith("#") ? color : undefined,
                        }}
                    >
                        <Icon className={cn("h-5 w-5 sm:h-6 sm:w-6", !color.startsWith("#") && color)} />
                    </div>
                </div>

                {trend && (
                    <div className="mt-4 flex items-center text-xs font-medium">
                        <span
                            className={cn(
                                "flex items-center gap-1 rounded-full px-2 py-0.5",
                                trend.isPositive
                                    ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-400"
                                    : "text-rose-600 bg-rose-50 dark:bg-rose-950/30 dark:text-rose-400"
                            )}
                        >
                            {trend.isPositive ? (
                                <TrendingUp className="h-3 w-3" />
                            ) : (
                                <TrendingDown className="h-3 w-3" />
                            )}
                            {trend.value}%
                        </span>
                        {trend.label && (
                            <span className="ml-2 text-muted-foreground">{trend.label}</span>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
