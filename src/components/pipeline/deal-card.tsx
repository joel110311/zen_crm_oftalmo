"use client";

import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Phone } from "lucide-react";
import type { DealData } from "./pipeline-board";

interface DealCardProps {
    deal: DealData;
    onDealClick: (deal: DealData) => void;
    isOverlay?: boolean;
}

export function DealCard({ deal, onDealClick, isOverlay }: DealCardProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: deal.id,
        disabled: isOverlay,
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    const contactName = [deal.contact?.name, deal.contact?.lastName]
        .filter(Boolean)
        .join(" ") || "Sin nombre";
    const contactPhone = deal.contact?.phone || "";
    const messagePreview = deal.lastMessage?.trim() || "";

    // When this card is being dragged, show a dashed placeholder in its original spot
    if (isDragging) {
        return (
            <div
                ref={setNodeRef}
                style={style}
                className="h-[56px] rounded-lg border-2 border-dashed border-primary/30 bg-primary/5"
            />
        );
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className="cursor-pointer group"
            suppressHydrationWarning
            onClick={() => onDealClick(deal)}
        >
            <div
                className={`h-[82px] min-h-[82px] max-h-[82px] overflow-hidden rounded-lg border border-border/75 bg-card px-2 py-1.5 transition-all duration-150 ${isOverlay ? "scale-105 rotate-[2deg] shadow-soft-hover" : "shadow-soft group-hover:border-primary/35 group-hover:shadow-soft-hover"
                    }`}
            >
                {/* Contact row: avatar + name/phone + value */}
                <div className="flex items-center gap-1.5">
                    <div
                        className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary/12 text-[10px] font-semibold text-primary"
                    >
                        {contactName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold leading-tight text-foreground">
                            {contactName}
                        </p>
                        {contactPhone && (
                            <p className="truncate text-[11px] leading-tight text-muted-foreground">
                                <Phone className="h-2.5 w-2.5 inline mr-0.5" />
                                +{contactPhone}
                            </p>
                        )}
                    </div>
                    {deal.value > 0 && (
                        <span className="text-xs font-bold flex-shrink-0 text-foreground">
                            ${deal.value.toLocaleString("es-MX")}
                        </span>
                    )}
                </div>

                {/* Message preview */}
                <p
                    className="mt-0.5 truncate whitespace-nowrap text-[12px] leading-5 text-muted-foreground"
                    title={messagePreview || undefined}
                >
                    {messagePreview || "\u00A0"}
                </p>
            </div>
        </div>
    );
}
