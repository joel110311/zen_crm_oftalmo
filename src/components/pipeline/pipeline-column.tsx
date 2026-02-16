"use client";

import React from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { DealCard } from "./deal-card";
import type { PipelineStageData, DealData } from "./pipeline-board";
import { MessageSquare } from "lucide-react";

interface PipelineColumnProps {
    stage: PipelineStageData;
    deals: DealData[];
    onDealClick: (deal: DealData) => void;
}

const isClosed = (stage: PipelineStageData) => stage.isClosedWon || stage.isClosedLost;

export function PipelineColumn({ stage, deals, onDealClick }: PipelineColumnProps) {
    const { isOver, setNodeRef } = useDroppable({
        id: stage.id,
    });

    const totalValue = deals.reduce((sum, deal) => sum + deal.value, 0);

    return (
        <div
            ref={setNodeRef}
            className={`flex flex-col h-full transition-all duration-200 rounded-xl border ${isOver ? "border-dashed ring-2 ring-primary/20 bg-accent/50" : "border-border bg-card/50"
                }`}
            style={{
                width: "300px",
                minWidth: "300px",
                borderColor: isOver ? stage.color : undefined,
            }}
        >
            {/* Column Header */}
            <div
                className="px-4 py-3 border-b border-border rounded-t-xl bg-card"
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div
                            className="h-3 w-3 rounded-full flex-shrink-0"
                            style={{
                                backgroundColor: stage.color,
                                boxShadow: `0 0 6px ${stage.color}40`,
                            }}
                        />
                        <h3
                            className="font-semibold text-sm truncate text-foreground"
                            style={{ maxWidth: "140px" }}
                        >
                            {stage.name}
                        </h3>
                        <span
                            className="text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0"
                            style={{
                                backgroundColor: `${stage.color}15`,
                                color: stage.color,
                            }}
                        >
                            {deals.length}
                        </span>
                    </div>
                    {stage.isIncoming && (
                        <div className="flex items-center gap-1 text-xs text-primary font-medium">
                            <MessageSquare className="h-3.5 w-3.5" />
                            <span>Auto</span>
                        </div>
                    )}
                </div>
                {/* Kommo-style summary */}
                <p className="text-xs mt-1 text-muted-foreground">
                    {isClosed(stage)
                        ? `${deals.length} ${deals.length === 1 ? "Lead cerrado" : "Leads cerrados"}`
                        : `${deals.length} ${deals.length === 1 ? "Cliente potencial" : "Clientes potenciales"}: $${totalValue.toLocaleString("es-MX")}`
                    }
                </p>
            </div>

            {/* Cards Area */}
            <SortableContext items={deals.map((d) => d.id)} strategy={verticalListSortingStrategy}>
                <div
                    className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5"
                    style={{ minHeight: "100px" }}
                >
                    {deals.length === 0 ? null : (
                        deals.map((deal) => (
                            <DealCard
                                key={deal.id}
                                deal={deal}
                                onDealClick={onDealClick}
                            />
                        ))
                    )}
                </div>
            </SortableContext>
        </div>
    );
}
