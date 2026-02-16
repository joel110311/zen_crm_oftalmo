"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Zap, Tag as TagIcon, Loader2 } from "lucide-react";
import {
    getAllAutomations, createStageAutomation, deleteStageAutomation, getAllTags, createTag
} from "@/app/actions/pipeline";
import type { PipelineStageData } from "./pipeline-board";

interface StageAutomationDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    stages: PipelineStageData[];
}

type AutomationRule = {
    id: string;
    stageId: string;
    trigger: string;
    action: string;
    tagId: string;
    tag: { id: string; name: string; color: string };
};

type TagData = { id: string; name: string; color: string };

export function StageAutomationDialog({ open, onOpenChange, stages }: StageAutomationDialogProps) {
    const [automations, setAutomations] = useState<AutomationRule[]>([]);
    const [tags, setTags] = useState<TagData[]>([]);
    const [isPending, startTransition] = useTransition();
    const [addingForStage, setAddingForStage] = useState<string | null>(null);
    const [newAction, setNewAction] = useState("add_tag");
    const [newTagId, setNewTagId] = useState("");
    const [newTagName, setNewTagName] = useState("");

    useEffect(() => {
        if (open) {
            startTransition(async () => {
                const [autos, allTags] = await Promise.all([getAllAutomations(), getAllTags()]);
                setAutomations(autos as AutomationRule[]);
                setTags(allTags as TagData[]);
            });
        }
    }, [open]);

    const handleCreate = async (stageId: string) => {
        let tagId = newTagId;

        // If creating a new tag
        if (newTagId === "__new__" && newTagName.trim()) {
            const result = await createTag(newTagName.trim());
            if (result.success && result.tag) {
                tagId = result.tag.id;
                setTags(prev => [...prev, result.tag!]);
            } else {
                return;
            }
        }

        if (!tagId || tagId === "__new__") return;

        const result = await createStageAutomation({
            stageId,
            action: newAction,
            tagId,
        });

        if (result.success && result.automation) {
            setAutomations(prev => [...prev, result.automation as AutomationRule]);
        }
        setAddingForStage(null);
        setNewAction("add_tag");
        setNewTagId("");
        setNewTagName("");
    };

    const handleDelete = async (id: string) => {
        const result = await deleteStageAutomation(id);
        if (result.success) {
            setAutomations(prev => prev.filter(a => a.id !== id));
        }
    };

    // Only show non-incoming, non-closed stages for automations
    const editableStages = stages.filter(s => !s.isClosedWon && !s.isClosedLost);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Zap className="h-5 w-5" style={{ color: "#2563EB" }} />
                        Automatización de Etapas
                    </DialogTitle>
                    <DialogDescription>
                        Configura acciones automáticas cuando un lead se mueve a una etapa.
                    </DialogDescription>
                </DialogHeader>

                {isPending ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-6 w-6 animate-spin" style={{ color: "#2563EB" }} />
                    </div>
                ) : (
                    <div className="space-y-4 mt-2">
                        {editableStages.map(stage => {
                            const stageAutos = automations.filter(a => a.stageId === stage.id);
                            return (
                                <div
                                    key={stage.id}
                                    className="rounded-lg border p-4"
                                    style={{ borderColor: "#E2E8F0" }}
                                >
                                    {/* Stage header */}
                                    <div className="flex items-center gap-2 mb-3">
                                        <div
                                            className="h-3 w-3 rounded-full"
                                            style={{ backgroundColor: stage.color }}
                                        />
                                        <h4 className="font-semibold text-sm" style={{ color: "#0F172A" }}>
                                            {stage.name}
                                        </h4>
                                        {stage.isIncoming && (
                                            <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: "#EFF6FF", color: "#2563EB" }}>
                                                Auto
                                            </span>
                                        )}
                                    </div>

                                    {/* Existing automations */}
                                    {stageAutos.length > 0 ? (
                                        <div className="space-y-2 mb-3">
                                            {stageAutos.map(auto => (
                                                <div
                                                    key={auto.id}
                                                    className="flex items-center justify-between px-3 py-2 rounded-md text-sm"
                                                    style={{ backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0" }}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <Zap className="h-3.5 w-3.5" style={{ color: "#F59E0B" }} />
                                                        <span style={{ color: "#64748B" }}>
                                                            Cuando es movido →
                                                        </span>
                                                        <span className="font-medium" style={{ color: "#0F172A" }}>
                                                            {auto.action === "add_tag" ? "Agregar" : "Eliminar"} etiqueta:
                                                        </span>
                                                        <span
                                                            className="text-xs px-1.5 py-0.5 rounded font-medium"
                                                            style={{
                                                                backgroundColor: auto.tag.color + "15",
                                                                color: auto.tag.color,
                                                                border: `1px solid ${auto.tag.color}30`,
                                                            }}
                                                        >
                                                            {auto.tag.name}
                                                        </span>
                                                    </div>
                                                    <Button
                                                        variant="ghost" size="icon"
                                                        className="h-7 w-7"
                                                        onClick={() => handleDelete(auto.id)}
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" style={{ color: "#DC2626" }} />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-xs mb-3" style={{ color: "#94A3B8" }}>
                                            Sin automatizaciones configuradas
                                        </p>
                                    )}

                                    {/* Add automation form */}
                                    {addingForStage === stage.id ? (
                                        <div
                                            className="p-3 rounded-lg space-y-3"
                                            style={{ backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0" }}
                                        >
                                            <p className="text-xs font-medium" style={{ color: "#64748B" }}>
                                                Ejecutar: Cuando es movido a esta etapa
                                            </p>
                                            <div className="flex gap-2">
                                                <select
                                                    value={newAction}
                                                    onChange={e => setNewAction(e.target.value)}
                                                    className="h-8 px-2 text-sm rounded-md border flex-1"
                                                    style={{ borderColor: "#E2E8F0" }}
                                                >
                                                    <option value="add_tag">Agregar etiqueta</option>
                                                    <option value="remove_tag">Eliminar etiqueta</option>
                                                </select>
                                                <select
                                                    value={newTagId}
                                                    onChange={e => setNewTagId(e.target.value)}
                                                    className="h-8 px-2 text-sm rounded-md border flex-1"
                                                    style={{ borderColor: "#E2E8F0" }}
                                                >
                                                    <option value="">Seleccionar etiqueta...</option>
                                                    {tags.map(t => (
                                                        <option key={t.id} value={t.id}>{t.name}</option>
                                                    ))}
                                                    <option value="__new__">+ Crear nueva etiqueta</option>
                                                </select>
                                            </div>
                                            {newTagId === "__new__" && (
                                                <input
                                                    value={newTagName}
                                                    onChange={e => setNewTagName(e.target.value)}
                                                    placeholder="Nombre de la etiqueta"
                                                    className="h-8 px-2 text-sm rounded-md border w-full"
                                                    style={{ borderColor: "#E2E8F0" }}
                                                />
                                            )}
                                            <div className="flex gap-2">
                                                <Button
                                                    size="sm"
                                                    className="h-7 text-xs"
                                                    style={{ backgroundColor: "#2563EB", color: "#fff" }}
                                                    onClick={() => handleCreate(stage.id)}
                                                    disabled={!newTagId || (newTagId === "__new__" && !newTagName.trim())}
                                                >
                                                    Finalizado
                                                </Button>
                                                <Button
                                                    size="sm" variant="ghost"
                                                    className="h-7 text-xs"
                                                    onClick={() => { setAddingForStage(null); setNewTagId(""); setNewTagName(""); }}
                                                >
                                                    Cancelar
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => { setAddingForStage(stage.id); setNewAction("add_tag"); setNewTagId(""); }}
                                            className="flex items-center gap-1.5 text-xs font-medium transition-colors hover:opacity-80"
                                            style={{ color: "#2563EB" }}
                                        >
                                            <Plus className="h-3.5 w-3.5" />
                                            Agregar disparador
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
