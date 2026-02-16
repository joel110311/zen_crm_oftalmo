"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

// ── Pipeline Stages ──

export async function getPipelineStages() {
    try {
        const stages = await prisma.pipelineStage.findMany({
            orderBy: { order: "asc" },
        });
        return stages;
    } catch (error) {
        console.error("Failed to fetch pipeline stages:", error);
        return [];
    }
}

export async function getIncomingStage() {
    try {
        const stage = await prisma.pipelineStage.findFirst({
            where: { isIncoming: true },
        });
        return stage;
    } catch (error) {
        console.error("Failed to fetch incoming stage:", error);
        return null;
    }
}

export async function getFirstRegularStage() {
    try {
        const stage = await prisma.pipelineStage.findFirst({
            where: { isIncoming: false, isClosedWon: false, isClosedLost: false },
            orderBy: { order: "asc" },
        });
        return stage;
    } catch (error) {
        console.error("Failed to fetch first regular stage:", error);
        return null;
    }
}

// ── Deals ──

export async function getDeals() {
    try {
        const deals = await prisma.deal.findMany({
            include: {
                contact: true,
                stage: true,
            },
            orderBy: { createdAt: "desc" },
        });
        return deals;
    } catch (error) {
        console.error("Failed to fetch deals:", error);
        return [];
    }
}

export async function getDealsByStage(stageId: string) {
    try {
        const deals = await prisma.deal.findMany({
            where: { stageId },
            include: {
                contact: true,
                stage: true,
            },
            orderBy: { createdAt: "desc" },
        });
        return deals;
    } catch (error) {
        console.error("Failed to fetch deals for stage:", error);
        return [];
    }
}

export async function getDealWithContact(dealId: string) {
    try {
        const deal = await prisma.deal.findUnique({
            where: { id: dealId },
            include: {
                contact: true,
                stage: true,
            },
        });
        return deal;
    } catch (error) {
        console.error("Failed to fetch deal:", error);
        return null;
    }
}

export async function createDeal(data: {
    title: string;
    value?: number;
    stageId: string;
    contactId?: string;
    source?: string;
    notes?: string;
    priority?: string;
}) {
    try {
        const deal = await prisma.deal.create({
            data: {
                title: data.title,
                value: data.value || 0,
                stageId: data.stageId,
                contactId: data.contactId || undefined,
                source: data.source || "manual",
                notes: data.notes || null,
                priority: data.priority || "medium",
            },
            include: { contact: true, stage: true },
        });
        revalidatePath("/dashboard/pipeline");
        return { success: true, deal };
    } catch (error) {
        console.error("Failed to create deal:", error);
        return { success: false, error: "Failed to create lead." };
    }
}

export async function updateDeal(id: string, data: {
    title?: string;
    value?: number;
    notes?: string;
    priority?: string;
    assignedTo?: string;
}) {
    try {
        const deal = await prisma.deal.update({
            where: { id },
            data,
            include: { contact: true, stage: true },
        });
        revalidatePath("/dashboard/pipeline");
        return { success: true, deal };
    } catch (error) {
        console.error("Failed to update deal:", error);
        return { success: false, error: "Failed to update deal." };
    }
}

export async function moveDealToStage(dealId: string, stageId: string) {
    try {
        await prisma.deal.update({
            where: { id: dealId },
            data: { stageId },
        });

        // Execute stage automations (on_enter)
        await executeStageAutomations(dealId, stageId);

        revalidatePath("/dashboard/pipeline");
        return { success: true };
    } catch (error) {
        console.error("Failed to move deal:", error);
        return { success: false, error: "Failed to move deal." };
    }
}

export async function acceptLead(dealId: string) {
    try {
        // Find the first regular stage (after incoming)
        const firstRegularStage = await prisma.pipelineStage.findFirst({
            where: { isIncoming: false, isClosedWon: false, isClosedLost: false },
            orderBy: { order: "asc" },
        });

        if (!firstRegularStage) {
            return { success: false, error: "No regular stage found." };
        }

        await prisma.deal.update({
            where: { id: dealId },
            data: { stageId: firstRegularStage.id },
        });
        revalidatePath("/dashboard/pipeline");
        return { success: true };
    } catch (error) {
        console.error("Failed to accept lead:", error);
        return { success: false, error: "Failed to accept lead." };
    }
}

export async function rejectLead(dealId: string) {
    try {
        // Find the "closed lost" stage
        const closedLostStage = await prisma.pipelineStage.findFirst({
            where: { isClosedLost: true },
        });

        if (closedLostStage) {
            await prisma.deal.update({
                where: { id: dealId },
                data: { stageId: closedLostStage.id },
            });
        } else {
            // If no closed-lost stage, delete the deal
            await prisma.deal.delete({ where: { id: dealId } });
        }

        revalidatePath("/dashboard/pipeline");
        return { success: true };
    } catch (error) {
        console.error("Failed to reject lead:", error);
        return { success: false, error: "Failed to reject lead." };
    }
}

export async function deleteDeal(id: string) {
    try {
        // Delete related DealTags first, then the deal itself
        await prisma.$transaction([
            prisma.dealTag.deleteMany({ where: { dealId: id } }),
            prisma.deal.delete({ where: { id } }),
        ]);
        revalidatePath("/dashboard/pipeline");
        return { success: true };
    } catch (error) {
        console.error("Failed to delete deal:", error);
        return { success: false, error: String(error) };
    }
}

// ── Pipeline Data (all-in-one for the board) ──

export async function getPipelineData() {
    try {
        const [stages, deals] = await Promise.all([
            prisma.pipelineStage.findMany({ orderBy: { order: "asc" } }),
            prisma.deal.findMany({
                include: {
                    contact: true,
                    stage: true,
                    dealTags: { include: { tag: true } },
                },
                orderBy: { createdAt: "desc" },
            }),
        ]);

        // Fetch last message for each deal's contact
        const dealsWithMessage = await Promise.all(
            deals.map(async (deal: any) => {
                let lastMessage: string | null = null;
                if (deal.contactId) {
                    const conv = await prisma.conversation.findFirst({
                        where: { contactId: deal.contactId },
                        include: {
                            messages: {
                                where: { direction: "inbound" },
                                orderBy: { createdAt: "desc" },
                                take: 1,
                            },
                        },
                    });
                    lastMessage = conv?.messages?.[0]?.content || null;
                }
                return { ...deal, lastMessage };
            })
        );

        return { stages, deals: dealsWithMessage };
    } catch (error) {
        console.error("Failed to fetch pipeline data:", error);
        return { stages: [], deals: [] };
    }
}

// ── Tags ──

export async function getAllTags() {
    try {
        return await prisma.tag.findMany({ orderBy: { name: "asc" } });
    } catch (error) {
        console.error("Failed to fetch tags:", error);
        return [];
    }
}

export async function createTag(name: string, color?: string) {
    try {
        const tag = await prisma.tag.create({
            data: { name, color: color || "#64748B" },
        });
        return { success: true, tag };
    } catch (error) {
        console.error("Failed to create tag:", error);
        return { success: false, error: "Failed to create tag." };
    }
}

export async function deleteTag(id: string) {
    try {
        await prisma.tag.delete({ where: { id } });
        revalidatePath("/dashboard/pipeline");
        return { success: true };
    } catch (error) {
        console.error("Failed to delete tag:", error);
        return { success: false, error: "Failed to delete tag." };
    }
}

export async function addTagToDeal(dealId: string, tagId: string) {
    try {
        await prisma.dealTag.create({
            data: { dealId, tagId },
        });
        revalidatePath("/dashboard/pipeline");
        return { success: true };
    } catch (error) {
        // Might be duplicate — ignore
        return { success: true };
    }
}

export async function removeTagFromDeal(dealId: string, tagId: string) {
    try {
        await prisma.dealTag.deleteMany({
            where: { dealId, tagId },
        });
        revalidatePath("/dashboard/pipeline");
        return { success: true };
    } catch (error) {
        console.error("Failed to remove tag:", error);
        return { success: false };
    }
}

// ── Stage Automations ──

async function executeStageAutomations(dealId: string, stageId: string) {
    try {
        const automations = await prisma.stageAutomation.findMany({
            where: { stageId, trigger: "on_enter" },
            include: { tag: true },
        });

        for (const auto of automations) {
            if (auto.action === "add_tag") {
                await prisma.dealTag.upsert({
                    where: { dealId_tagId: { dealId, tagId: auto.tagId } },
                    update: {},
                    create: { dealId, tagId: auto.tagId },
                });
                console.log(`[Automation] Added tag "${auto.tag.name}" to deal ${dealId}`);
            } else if (auto.action === "remove_tag") {
                await prisma.dealTag.deleteMany({
                    where: { dealId, tagId: auto.tagId },
                });
                console.log(`[Automation] Removed tag "${auto.tag.name}" from deal ${dealId}`);
            }
        }
    } catch (error) {
        console.error("[Automation] Failed to execute:", error);
    }
}

export async function getStageAutomations(stageId: string) {
    try {
        return await prisma.stageAutomation.findMany({
            where: { stageId },
            include: { tag: true },
            orderBy: { createdAt: "asc" },
        });
    } catch (error) {
        console.error("Failed to fetch stage automations:", error);
        return [];
    }
}

export async function getAllAutomations() {
    try {
        return await prisma.stageAutomation.findMany({
            include: { tag: true, stage: true },
            orderBy: { createdAt: "asc" },
        });
    } catch (error) {
        console.error("Failed to fetch all automations:", error);
        return [];
    }
}

export async function createStageAutomation(data: {
    stageId: string;
    action: string;
    tagId: string;
}) {
    try {
        const automation = await prisma.stageAutomation.create({
            data: {
                stageId: data.stageId,
                trigger: "on_enter",
                action: data.action,
                tagId: data.tagId,
            },
            include: { tag: true },
        });
        revalidatePath("/dashboard/pipeline");
        return { success: true, automation };
    } catch (error) {
        console.error("Failed to create automation:", error);
        return { success: false, error: "Failed to create automation." };
    }
}

export async function deleteStageAutomation(id: string) {
    try {
        await prisma.stageAutomation.delete({ where: { id } });
        revalidatePath("/dashboard/pipeline");
        return { success: true };
    } catch (error) {
        console.error("Failed to delete automation:", error);
        return { success: false, error: "Failed to delete automation." };
    }
}

// ── Funnel Editor (Stage Management) ──

export async function createPipelineStage(data: {
    name: string;
    color?: string;
}) {
    try {
        // Get the max order (before closed stages)
        const closedStages = await prisma.pipelineStage.findMany({
            where: { OR: [{ isClosedWon: true }, { isClosedLost: true }] },
            orderBy: { order: "asc" },
        });
        const nonClosedStages = await prisma.pipelineStage.findMany({
            where: { isClosedWon: false, isClosedLost: false },
            orderBy: { order: "desc" },
            take: 1,
        });
        const newOrder = (nonClosedStages[0]?.order ?? 0) + 1;

        // Push closed stages down
        for (const cs of closedStages) {
            await prisma.pipelineStage.update({
                where: { id: cs.id },
                data: { order: cs.order + 1 },
            });
        }

        const stage = await prisma.pipelineStage.create({
            data: {
                name: data.name,
                color: data.color || "#64748B",
                order: newOrder,
            },
        });
        revalidatePath("/dashboard/pipeline");
        return { success: true, stage };
    } catch (error) {
        console.error("Failed to create stage:", error);
        return { success: false, error: "Failed to create stage." };
    }
}

export async function updatePipelineStage(id: string, data: {
    name?: string;
    color?: string;
}) {
    try {
        const stage = await prisma.pipelineStage.findUnique({ where: { id } });
        if (!stage) return { success: false, error: "Stage not found." };
        if (stage.isIncoming) return { success: false, error: "Cannot modify the incoming stage." };

        const updated = await prisma.pipelineStage.update({
            where: { id },
            data: {
                ...(data.name && { name: data.name }),
                ...(data.color && { color: data.color }),
            },
        });
        revalidatePath("/dashboard/pipeline");
        return { success: true, stage: updated };
    } catch (error) {
        console.error("Failed to update stage:", error);
        return { success: false, error: "Failed to update stage." };
    }
}

export async function deletePipelineStage(id: string) {
    try {
        const stage = await prisma.pipelineStage.findUnique({ where: { id } });
        if (!stage) return { success: false, error: "Stage not found." };
        if (stage.isIncoming) return { success: false, error: "Cannot delete the incoming stage." };
        if (stage.isClosedWon || stage.isClosedLost) return { success: false, error: "Cannot delete closed stages." };

        // Move deals to the incoming stage
        const incomingStage = await prisma.pipelineStage.findFirst({ where: { isIncoming: true } });
        if (incomingStage) {
            await prisma.deal.updateMany({
                where: { stageId: id },
                data: { stageId: incomingStage.id },
            });
        }

        await prisma.pipelineStage.delete({ where: { id } });

        // Reorder remaining stages
        const remaining = await prisma.pipelineStage.findMany({ orderBy: { order: "asc" } });
        for (let i = 0; i < remaining.length; i++) {
            await prisma.pipelineStage.update({
                where: { id: remaining[i].id },
                data: { order: i },
            });
        }

        revalidatePath("/dashboard/pipeline");
        return { success: true };
    } catch (error) {
        console.error("Failed to delete stage:", error);
        return { success: false, error: "Failed to delete stage." };
    }
}

export async function reorderPipelineStages(orderedIds: string[]) {
    try {
        for (let i = 0; i < orderedIds.length; i++) {
            await prisma.pipelineStage.update({
                where: { id: orderedIds[i] },
                data: { order: i },
            });
        }
        revalidatePath("/dashboard/pipeline");
        return { success: true };
    } catch (error) {
        console.error("Failed to reorder stages:", error);
        return { success: false, error: "Failed to reorder stages." };
    }
}
