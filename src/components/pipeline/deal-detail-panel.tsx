"use client";

import React, { useState, useTransition, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Phone, Mail, Building2, MessageSquare, Calendar, Pencil, Trash2, Save, Plus, Tag as TagIcon } from "lucide-react";
import { updateDeal, deleteDeal, getAllTags, createTag, addTagToDeal, removeTagFromDeal, deleteTag } from "@/app/actions/pipeline";
import type { DealData } from "./pipeline-board";

interface DealDetailPanelProps {
    deal: DealData;
    onClose: () => void;
    onUpdate: (deal: DealData) => void;
    onDelete: (dealId: string) => void;
}

interface TagData {
    id: string;
    name: string;
    color: string;
}

export function DealDetailPanel({ deal, onClose, onUpdate, onDelete }: DealDetailPanelProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(deal.title);
    const [editValue, setEditValue] = useState(deal.value.toString());
    const [editNotes, setEditNotes] = useState(deal.notes || "");
    const [editPriority, setEditPriority] = useState(deal.priority);
    const [isPending, startTransition] = useTransition();

    // Tags state
    const [allTags, setAllTags] = useState<TagData[]>([]);
    const [dealTagIds, setDealTagIds] = useState<string[]>(
        deal.dealTags?.map((dt) => dt.tag.id) || []
    );
    const [newTagName, setNewTagName] = useState("");
    const [showTagInput, setShowTagInput] = useState(false);

    const contactName = [deal.contact?.name, deal.contact?.lastName].filter(Boolean).join(" ") || "Sin nombre";
    const assignedTags = allTags.filter((t) => dealTagIds.includes(t.id));
    const availableTags = allTags.filter((t) => !dealTagIds.includes(t.id));

    // Fetch all tags on mount
    useEffect(() => {
        startTransition(async () => {
            const tags = await getAllTags();
            setAllTags(tags as TagData[]);
        });
    }, []);

    // Sync when deal changes
    useEffect(() => {
        setEditTitle(deal.title);
        setEditValue(deal.value.toString());
        setEditNotes(deal.notes || "");
        setEditPriority(deal.priority);
        setDealTagIds(deal.dealTags?.map((dt) => dt.tag.id) || []);
    }, [deal]);

    const handleSave = () => {
        startTransition(async () => {
            const result = await updateDeal(deal.id, {
                title: editTitle,
                value: parseFloat(editValue) || 0,
                notes: editNotes || undefined,
                priority: editPriority,
            });
            if (result.success && result.deal) {
                onUpdate({
                    ...deal,
                    title: editTitle,
                    value: parseFloat(editValue) || 0,
                    notes: editNotes,
                    priority: editPriority,
                });
                setIsEditing(false);
            }
        });
    };

    const handleDelete = async () => {
        if (!window.confirm("¿Estás seguro de eliminar este lead?")) return;
        try {
            const result = await deleteDeal(deal.id);
            if (result.success) {
                onDelete(deal.id);
                onClose();
            } else {
                alert("Error al eliminar: " + (result.error || "Error desconocido"));
            }
        } catch (err) {
            console.error("Delete failed:", err);
            alert("Error al eliminar el lead");
        }
    };

    const handleAddTag = (tagId: string) => {
        setDealTagIds((prev) => [...prev, tagId]);
        startTransition(async () => {
            await addTagToDeal(deal.id, tagId);
        });
    };

    const handleRemoveTag = (tagId: string) => {
        setDealTagIds((prev) => prev.filter((id) => id !== tagId));
        startTransition(async () => {
            await removeTagFromDeal(deal.id, tagId);
        });
    };

    const handleDeleteTag = async (tagId: string) => {
        if (!window.confirm("¿Seguro que deseas eliminar esta etiqueta del sistema? Se eliminará de todos los leads.")) return;

        // Optimistic update
        setAllTags((prev) => prev.filter((t) => t.id !== tagId));
        setDealTagIds((prev) => prev.filter((id) => id !== tagId));

        startTransition(async () => {
            const result = await deleteTag(tagId);
            if (!result.success) {
                alert("Error al eliminar etiqueta: " + result.error);
                // Revert fetch needed if failed, but for now simple alert
            }
        });
    };

    const handleCreateTag = () => {
        if (!newTagName.trim()) return;
        const colors = ["#2563EB", "#7C3AED", "#059669", "#D97706", "#DC2626", "#0891B2", "#4F46E5"];
        const color = colors[Math.floor(Math.random() * colors.length)];
        startTransition(async () => {
            const result = await createTag(newTagName.trim(), color);
            if (result.success && result.tag) {
                const tag = result.tag as TagData;
                setAllTags((prev) => [...prev, tag]);
                setDealTagIds((prev) => [...prev, tag.id]);
                await addTagToDeal(deal.id, tag.id);
                setNewTagName("");
                setShowTagInput(false);
            }
        });
    };

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-40"
                style={{ backgroundColor: "rgba(0,0,0,0.3)" }}
                onClick={onClose}
            />

            {/* Panel */}
            <div
                className="fixed right-0 top-0 h-full z-50 overflow-y-auto"
                style={{
                    width: "420px",
                    backgroundColor: "#FFFFFF",
                    boxShadow: "-4px 0 25px rgba(0,0,0,0.1)",
                    animation: "slideIn 0.2s ease-out",
                }}
            >
                {/* Header */}
                <div
                    className="flex items-center justify-between px-6 py-4 sticky top-0 z-10"
                    style={{
                        backgroundColor: "#FFFFFF",
                        borderBottom: "1px solid #E2E8F0",
                    }}
                >
                    <h2 className="text-lg font-bold" style={{ color: "#0F172A" }}>
                        Detalle del Lead
                    </h2>
                    <div className="flex items-center gap-2">
                        {!isEditing ? (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setIsEditing(true)}
                                className="h-8"
                            >
                                <Pencil className="h-3.5 w-3.5 mr-1" />
                                Editar
                            </Button>
                        ) : (
                            <Button
                                size="sm"
                                onClick={handleSave}
                                disabled={isPending}
                                className="h-8"
                                style={{ backgroundColor: "#2563EB", color: "#FFFFFF" }}
                            >
                                <Save className="h-3.5 w-3.5 mr-1" />
                                Guardar
                            </Button>
                        )}
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={onClose}
                            className="h-8 w-8 p-0"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                <div className="px-6 py-5 space-y-6">
                    {/* Title & Value */}
                    <div>
                        {isEditing ? (
                            <div className="space-y-3">
                                <div>
                                    <label className="text-xs font-medium" style={{ color: "#64748B" }}>Título</label>
                                    <Input
                                        value={editTitle}
                                        onChange={(e) => setEditTitle(e.target.value)}
                                        className="mt-1"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-medium" style={{ color: "#64748B" }}>Valor ($)</label>
                                    <Input
                                        type="number"
                                        value={editValue}
                                        onChange={(e) => setEditValue(e.target.value)}
                                        className="mt-1"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-medium" style={{ color: "#64748B" }}>Prioridad</label>
                                    <select
                                        value={editPriority}
                                        onChange={(e) => setEditPriority(e.target.value)}
                                        className="mt-1 w-full h-9 px-3 text-sm rounded-md border"
                                        style={{ borderColor: "#E2E8F0" }}
                                    >
                                        <option value="low">Baja</option>
                                        <option value="medium">Media</option>
                                        <option value="high">Alta</option>
                                    </select>
                                </div>
                            </div>
                        ) : (
                            <>
                                <h3 className="text-xl font-bold" style={{ color: "#0F172A" }}>
                                    {deal.title}
                                </h3>
                                {deal.value > 0 && (
                                    <p className="text-2xl font-bold mt-1" style={{ color: "#2563EB" }}>
                                        ${deal.value.toLocaleString("es-MX")}
                                    </p>
                                )}
                            </>
                        )}
                    </div>

                    {/* Stage */}
                    <div
                        className="flex items-center gap-3 p-3 rounded-lg"
                        style={{ backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0" }}
                    >
                        <div
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: deal.stage?.color || "#64748B" }}
                        />
                        <div>
                            <p className="text-xs" style={{ color: "#64748B" }}>Etapa actual</p>
                            <p className="text-sm font-semibold" style={{ color: "#0F172A" }}>
                                {deal.stage?.name || "Sin etapa"}
                            </p>
                        </div>
                    </div>

                    {/* Contact Info */}
                    <div>
                        <h4 className="text-sm font-semibold mb-3" style={{ color: "#0F172A" }}>
                            Información del Contacto
                        </h4>
                        <div
                            className="rounded-lg p-4 space-y-3"
                            style={{ backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0" }}
                        >
                            <div className="flex items-center gap-3">
                                <div
                                    className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold"
                                    style={{ backgroundColor: "#EFF6FF", color: "#2563EB" }}
                                >
                                    {contactName.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <p className="text-sm font-semibold" style={{ color: "#0F172A" }}>{contactName}</p>
                                    <p className="text-xs" style={{ color: "#64748B" }}>Contacto</p>
                                </div>
                            </div>

                            {deal.contact?.phone && (
                                <div className="flex items-center gap-2">
                                    <Phone className="h-4 w-4" style={{ color: "#64748B" }} />
                                    <span className="text-sm" style={{ color: "#334155" }}>+{deal.contact.phone}</span>
                                    <a
                                        href={`https://wa.me/${deal.contact.phone}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="ml-auto text-xs font-medium px-2 py-1 rounded"
                                        style={{ backgroundColor: "#25D36615", color: "#25D366" }}
                                    >
                                        <MessageSquare className="h-3 w-3 inline mr-1" />
                                        WhatsApp
                                    </a>
                                </div>
                            )}

                            {deal.contact?.email && (
                                <div className="flex items-center gap-2">
                                    <Mail className="h-4 w-4" style={{ color: "#64748B" }} />
                                    <span className="text-sm" style={{ color: "#334155" }}>{deal.contact.email}</span>
                                </div>
                            )}

                            {deal.contact?.company && (
                                <div className="flex items-center gap-2">
                                    <Building2 className="h-4 w-4" style={{ color: "#64748B" }} />
                                    <span className="text-sm" style={{ color: "#334155" }}>{deal.contact.company}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Etiquetas (Tags) */}
                    <div>
                        <h4 className="text-sm font-semibold mb-3" style={{ color: "#0F172A" }}>
                            Etiquetas
                        </h4>
                        <div
                            className="rounded-lg p-4 space-y-3"
                            style={{ backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0" }}
                        >
                            {/* Assigned tags */}
                            {assignedTags.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {assignedTags.map((tag) => (
                                        <span
                                            key={tag.id}
                                            className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full"
                                            style={{
                                                backgroundColor: tag.color + "15",
                                                color: tag.color,
                                                border: `1px solid ${tag.color}30`,
                                            }}
                                        >
                                            {tag.name}
                                            <button
                                                className="ml-0.5 hover:opacity-70"
                                                onClick={() => handleRemoveTag(tag.id)}
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs" style={{ color: "#94A3B8" }}>Sin etiquetas</p>
                            )}

                            {/* Available tags dropdown */}
                            {availableTags.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                    {availableTags.map((tag) => (
                                        <div
                                            key={tag.id}
                                            className="group flex items-center bg-gray-100 rounded-full pl-2 pr-1 py-0.5 hover:bg-gray-200 transition-colors"
                                        >
                                            <button
                                                className="text-[11px] font-medium text-gray-600 hover:text-gray-900"
                                                onClick={() => handleAddTag(tag.id)}
                                            >
                                                + {tag.name}
                                            </button>
                                            <button
                                                className="ml-1 p-0.5 text-gray-400 hover:text-red-500 rounded-full hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteTag(tag.id);
                                                }}
                                                title="Eliminar etiqueta del sistema"
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Create new tag */}
                            {showTagInput ? (
                                <div className="flex gap-2">
                                    <Input
                                        value={newTagName}
                                        onChange={(e) => setNewTagName(e.target.value)}
                                        placeholder="Nombre de etiqueta"
                                        className="h-8 text-xs"
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") handleCreateTag();
                                        }}
                                        autoFocus
                                    />
                                    <Button
                                        size="sm"
                                        className="h-8 px-3 text-xs"
                                        style={{ backgroundColor: "#2563EB", color: "#FFFFFF" }}
                                        onClick={handleCreateTag}
                                        disabled={isPending || !newTagName.trim()}
                                    >
                                        Crear
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-8 px-2"
                                        onClick={() => { setShowTagInput(false); setNewTagName(""); }}
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            ) : (
                                <button
                                    className="flex items-center gap-1 text-xs font-medium hover:opacity-80"
                                    style={{ color: "#2563EB" }}
                                    onClick={() => setShowTagInput(true)}
                                >
                                    <Plus className="h-3.5 w-3.5" />
                                    Nueva etiqueta
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Notes */}
                    <div>
                        <h4 className="text-sm font-semibold mb-2" style={{ color: "#0F172A" }}>
                            Notas
                        </h4>
                        {isEditing ? (
                            <textarea
                                value={editNotes}
                                onChange={(e) => setEditNotes(e.target.value)}
                                className="w-full h-24 p-3 text-sm rounded-lg resize-none"
                                style={{ border: "1px solid #E2E8F0" }}
                                placeholder="Agregar notas sobre este lead..."
                            />
                        ) : (
                            <div
                                className="p-3 rounded-lg text-sm min-h-[60px]"
                                style={{
                                    backgroundColor: "#F8FAFC",
                                    border: "1px solid #E2E8F0",
                                    color: deal.notes ? "#334155" : "#94A3B8",
                                }}
                            >
                                {deal.notes || "Sin notas"}
                            </div>
                        )}
                    </div>

                    {/* Metadata */}
                    <div
                        className="p-4 rounded-lg space-y-2"
                        style={{ backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0" }}
                    >
                        <div className="flex items-center gap-2">
                            <Calendar className="h-3.5 w-3.5" style={{ color: "#64748B" }} />
                            <span className="text-xs" style={{ color: "#64748B" }}>
                                Creado: {new Date(deal.createdAt).toLocaleDateString("es-MX", {
                                    day: "numeric",
                                    month: "long",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                })}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs" style={{ color: "#64748B" }}>
                                Fuente: <span className="font-medium">{deal.source === "whatsapp" ? "📱 WhatsApp" : "✏️ Manual"}</span>
                            </span>
                        </div>
                    </div>

                    {/* Delete Button */}
                    <Button
                        variant="outline"
                        className="w-full"
                        style={{ borderColor: "#FCA5A5", color: "#DC2626" }}
                        onClick={handleDelete}
                        disabled={isPending}
                    >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Eliminar Lead
                    </Button>
                </div>
            </div>

            <style jsx global>{`
                @keyframes slideIn {
                    from { transform: translateX(100%); }
                    to { transform: translateX(0); }
                }
            `}</style>
        </>
    );
}
