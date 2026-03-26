import crypto from "crypto";
import type {
    BulkCampaign,
    BulkCampaignVariant,
    Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import {
    businessBoundsForDate,
    getNextOpenDate,
    normalizeBusinessHours,
} from "@/lib/calendar/business-hours";
import {
    findOrCreateActiveConversationForContact,
    type OutboundMessageType,
    sendOutboundConversationMessage,
} from "@/lib/outbound-messages";
import { getSystemSettingsOrDefaults } from "@/lib/system-settings";
import { listTemplateVariableKeys, renderTemplateContent } from "@/lib/templates";

const DEFAULT_VARIANT_LABELS = ["A", "B", "C", "D", "E"];
const MAX_AUDIENCE_LIMIT = 5000;
const WORKER_LOCK_TTL_MS = 60_000;
const ALLOWED_CAMPAIGN_TYPES = new Set<OutboundMessageType>(["text", "image", "document"]);

export type BulkCampaignAudienceFilters = {
    statuses: string[];
    tags: string[];
    query: string;
    limit: number | null;
};

export type BulkCampaignVariantInput = {
    label: string;
    content: string;
    weight: number;
    sortOrder: number;
    isActive: boolean;
};

export type BulkCampaignUpsertInput = {
    name: string;
    description: string;
    type: OutboundMessageType;
    mediaUrl: string | null;
    mediaType: string | null;
    mediaFileName: string | null;
    batchSize: number;
    batchDelayMinutes: number;
    respectBusinessHours: boolean;
    stopOnReply: boolean;
    audienceFilters: BulkCampaignAudienceFilters;
    variants: BulkCampaignVariantInput[];
};

export type BulkCampaignRecord = BulkCampaign & {
    variants: BulkCampaignVariant[];
};

function clampInteger(value: unknown, fallback: number, min: number, max: number) {
    const parsed = Number.parseInt(String(value ?? ""), 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(Math.max(parsed, min), max);
}

function normalizeStringList(value: unknown) {
    if (!Array.isArray(value)) return [];

    return value
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter(Boolean)
        .filter((entry, index, array) => array.indexOf(entry) === index);
}

function normalizeCampaignType(value: unknown): OutboundMessageType {
    const normalized = typeof value === "string" ? value.trim().toLowerCase() : "text";
    if (ALLOWED_CAMPAIGN_TYPES.has(normalized as OutboundMessageType)) {
        return normalized as OutboundMessageType;
    }
    return "text";
}

function buildDefaultVariant(index = 0): BulkCampaignVariantInput {
    return {
        label: DEFAULT_VARIANT_LABELS[index] || `Variante ${index + 1}`,
        content: "",
        weight: 1,
        sortOrder: index,
        isActive: true,
    };
}

export function normalizeBulkCampaignAudienceFilters(value: unknown): BulkCampaignAudienceFilters {
    const record = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
    const statuses = normalizeStringList(record.statuses).map((entry) => entry.toLowerCase());
    const tags = normalizeStringList(record.tags);
    const query = typeof record.query === "string" ? record.query.trim() : "";
    const limitRaw = clampInteger(record.limit, 0, 0, MAX_AUDIENCE_LIMIT);

    return {
        statuses,
        tags,
        query,
        limit: limitRaw > 0 ? limitRaw : null,
    };
}

export function normalizeBulkCampaignVariants(
    value: unknown,
    type: OutboundMessageType,
): BulkCampaignVariantInput[] {
    if (!Array.isArray(value) || value.length === 0) {
        return [buildDefaultVariant()];
    }

    const normalized = value
        .map((entry, index) => {
            const record = typeof entry === "object" && entry !== null
                ? (entry as Record<string, unknown>)
                : {};
            const label = typeof record.label === "string" && record.label.trim()
                ? record.label.trim()
                : DEFAULT_VARIANT_LABELS[index] || `Variante ${index + 1}`;
            const content = typeof record.content === "string" ? record.content : "";

            return {
                label,
                content,
                weight: clampInteger(record.weight, 1, 1, 20),
                sortOrder: index,
                isActive: record.isActive !== false,
            } satisfies BulkCampaignVariantInput;
        })
        .filter((variant) => variant.isActive || variant.content.trim() || type !== "text");

    return normalized.length > 0 ? normalized : [buildDefaultVariant()];
}

export function normalizeBulkCampaignPayload(value: unknown): BulkCampaignUpsertInput {
    const record = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
    const type = normalizeCampaignType(record.type);

    return {
        name: typeof record.name === "string" ? record.name.trim() : "",
        description: typeof record.description === "string" ? record.description.trim() : "",
        type,
        mediaUrl: typeof record.mediaUrl === "string" && record.mediaUrl.trim() ? record.mediaUrl.trim() : null,
        mediaType: typeof record.mediaType === "string" && record.mediaType.trim() ? record.mediaType.trim() : null,
        mediaFileName: typeof record.mediaFileName === "string" && record.mediaFileName.trim() ? record.mediaFileName.trim() : null,
        batchSize: clampInteger(record.batchSize, 3, 1, 100),
        batchDelayMinutes: clampInteger(record.batchDelayMinutes, 5, 1, 24 * 60),
        respectBusinessHours: record.respectBusinessHours !== false,
        stopOnReply: record.stopOnReply !== false,
        audienceFilters: normalizeBulkCampaignAudienceFilters(record.audienceFilters),
        variants: normalizeBulkCampaignVariants(record.variants, type),
    };
}

function ensureCampaignDraftIsValid(input: BulkCampaignUpsertInput) {
    if (!input.name) {
        throw new Error("El nombre de la campaña es obligatorio");
    }

    if (input.type !== "text" && !input.mediaUrl) {
        throw new Error("La campaña requiere un archivo adjunto");
    }
}

function ensureCampaignCanLaunch(campaign: BulkCampaignRecord) {
    if (!campaign.name.trim()) {
        throw new Error("La campaña no tiene nombre");
    }

    if (campaign.type !== "text" && !campaign.mediaUrl) {
        throw new Error("La campaña necesita un adjunto antes de iniciarse");
    }

    const activeVariants = campaign.variants.filter((variant) => variant.isActive);
    if (activeVariants.length === 0) {
        throw new Error("Agrega al menos una variante activa");
    }

    if (campaign.type === "text" && !activeVariants.some((variant) => variant.content.trim())) {
        throw new Error("Agrega contenido a por lo menos una variante antes de iniciar");
    }
}

function buildAudienceWhere(filters: BulkCampaignAudienceFilters): Prisma.ContactWhereInput {
    const query = filters.query.trim();

    return {
        phone: {
            not: "",
        },
        ...(filters.statuses.length > 0 ? { status: { in: filters.statuses } } : {}),
        ...(filters.tags.length > 0 ? { tags: { hasEvery: filters.tags } } : {}),
        ...(query
            ? {
                OR: [
                    { name: { contains: query, mode: "insensitive" } },
                    { lastName: { contains: query, mode: "insensitive" } },
                    { company: { contains: query, mode: "insensitive" } },
                    { email: { contains: query, mode: "insensitive" } },
                    { phone: { contains: query, mode: "insensitive" } },
                ],
            }
            : {}),
    };
}

async function loadAudienceContacts(filters: BulkCampaignAudienceFilters) {
    return prisma.contact.findMany({
        where: buildAudienceWhere(filters),
        orderBy: [
            { updatedAt: "desc" },
            { createdAt: "desc" },
        ],
        take: filters.limit ?? MAX_AUDIENCE_LIMIT,
        select: {
            id: true,
            name: true,
            company: true,
            phone: true,
        },
    });
}

async function countAudienceContacts(filters: BulkCampaignAudienceFilters) {
    return prisma.contact.count({
        where: buildAudienceWhere(filters),
    });
}

export async function refreshBulkCampaignStats(campaignId: string) {
    const [campaign, totalRecipients, sentCount, failedCount, repliedCount, skippedCount, queuedCount] = await prisma.$transaction([
        prisma.bulkCampaign.findUnique({
            where: { id: campaignId },
            select: {
                id: true,
                status: true,
                completedAt: true,
            },
        }),
        prisma.bulkCampaignRecipient.count({ where: { campaignId } }),
        prisma.bulkCampaignRecipient.count({ where: { campaignId, sentAt: { not: null } } }),
        prisma.bulkCampaignRecipient.count({ where: { campaignId, status: "failed" } }),
        prisma.bulkCampaignRecipient.count({ where: { campaignId, repliedAt: { not: null } } }),
        prisma.bulkCampaignRecipient.count({
            where: {
                campaignId,
                status: {
                    in: ["skipped", "cancelled"],
                },
            },
        }),
        prisma.bulkCampaignRecipient.count({ where: { campaignId, status: "queued" } }),
    ]);

    if (!campaign) {
        return null;
    }

    const shouldMarkCompleted = campaign.status === "running" && queuedCount === 0;

    return prisma.bulkCampaign.update({
        where: { id: campaignId },
        data: {
            totalRecipients,
            sentCount,
            failedCount,
            repliedCount,
            skippedCount,
            ...(shouldMarkCompleted
                ? {
                    status: "completed",
                    completedAt: campaign.completedAt || new Date(),
                    nextRunAt: null,
                }
                : {}),
        },
        include: {
            variants: {
                orderBy: { sortOrder: "asc" },
            },
        },
    });
}

export async function listBulkCampaigns() {
    return prisma.bulkCampaign.findMany({
        include: {
            variants: {
                orderBy: { sortOrder: "asc" },
            },
        },
        orderBy: [
            { updatedAt: "desc" },
            { createdAt: "desc" },
        ],
    });
}

export async function getBulkCampaignById(id: string) {
    return prisma.bulkCampaign.findUnique({
        where: { id },
        include: {
            variants: {
                orderBy: { sortOrder: "asc" },
            },
        },
    });
}

export async function createBulkCampaign(input: BulkCampaignUpsertInput, createdById?: string | null) {
    ensureCampaignDraftIsValid(input);
    const estimatedRecipients = await countAudienceContacts(input.audienceFilters);

    return prisma.bulkCampaign.create({
        data: {
            name: input.name,
            description: input.description || null,
            type: input.type,
            mediaUrl: input.mediaUrl,
            mediaType: input.mediaType,
            mediaFileName: input.mediaFileName,
            batchSize: input.batchSize,
            batchDelayMinutes: input.batchDelayMinutes,
            respectBusinessHours: input.respectBusinessHours,
            stopOnReply: input.stopOnReply,
            audienceFilters: input.audienceFilters,
            totalRecipients: estimatedRecipients,
            createdById: createdById || null,
            variants: {
                create: input.variants.map((variant) => ({
                    label: variant.label,
                    content: variant.content,
                    weight: variant.weight,
                    sortOrder: variant.sortOrder,
                    isActive: variant.isActive,
                    variables: listTemplateVariableKeys(variant.content),
                })),
            },
        },
        include: {
            variants: {
                orderBy: { sortOrder: "asc" },
            },
        },
    });
}

export async function updateBulkCampaign(id: string, input: BulkCampaignUpsertInput) {
    ensureCampaignDraftIsValid(input);
    const existing = await prisma.bulkCampaign.findUnique({
        where: { id },
        include: {
            variants: true,
        },
    });

    if (!existing) {
        throw new Error("Campaña no encontrada");
    }

    if (existing.status === "running" || existing.status === "paused") {
        throw new Error("Pausa o termina la campaña antes de editar su configuración");
    }

    const estimatedRecipients = await countAudienceContacts(input.audienceFilters);

    await prisma.$transaction(async (tx) => {
        await tx.bulkCampaign.update({
            where: { id },
            data: {
                name: input.name,
                description: input.description || null,
                type: input.type,
                mediaUrl: input.mediaUrl,
                mediaType: input.mediaType,
                mediaFileName: input.mediaFileName,
                batchSize: input.batchSize,
                batchDelayMinutes: input.batchDelayMinutes,
                respectBusinessHours: input.respectBusinessHours,
                stopOnReply: input.stopOnReply,
                audienceFilters: input.audienceFilters,
                totalRecipients: estimatedRecipients,
                completedAt: null,
            },
        });

        await tx.bulkCampaignVariant.deleteMany({
            where: { campaignId: id },
        });

        if (input.variants.length > 0) {
            await tx.bulkCampaignVariant.createMany({
                data: input.variants.map((variant) => ({
                    campaignId: id,
                    label: variant.label,
                    content: variant.content,
                    weight: variant.weight,
                    sortOrder: variant.sortOrder,
                    isActive: variant.isActive,
                    variables: listTemplateVariableKeys(variant.content),
                })),
            });
        }
    });

    return getBulkCampaignById(id);
}

export async function startBulkCampaign(id: string) {
    const campaign = await prisma.bulkCampaign.findUnique({
        where: { id },
        include: {
            variants: {
                orderBy: { sortOrder: "asc" },
            },
        },
    });

    if (!campaign) {
        throw new Error("Campaña no encontrada");
    }

    ensureCampaignCanLaunch(campaign);

    const filters = normalizeBulkCampaignAudienceFilters(campaign.audienceFilters);
    const contacts = await loadAudienceContacts(filters);

    if (contacts.length === 0) {
        throw new Error("No hay contactos que coincidan con la audiencia seleccionada");
    }

    const now = new Date();

    await prisma.$transaction(async (tx) => {
        await tx.bulkCampaignRecipient.deleteMany({
            where: { campaignId: id },
        });

        await tx.bulkCampaignRecipient.createMany({
            data: contacts.map((contact, index) => ({
                campaignId: id,
                contactId: contact.id,
                status: "queued",
                sequenceIndex: index,
            })),
        });

        await tx.bulkCampaign.update({
            where: { id },
            data: {
                status: "running",
                totalRecipients: contacts.length,
                sentCount: 0,
                failedCount: 0,
                repliedCount: 0,
                skippedCount: 0,
                startedAt: now,
                completedAt: null,
                lastProcessedAt: null,
                nextRunAt: now,
                workerLockId: null,
                workerLockExpiresAt: null,
            },
        });
    });

    return getBulkCampaignById(id);
}

export async function pauseBulkCampaign(id: string) {
    return prisma.bulkCampaign.update({
        where: { id },
        data: {
            status: "paused",
            nextRunAt: null,
            workerLockId: null,
            workerLockExpiresAt: null,
        },
        include: {
            variants: {
                orderBy: { sortOrder: "asc" },
            },
        },
    });
}

export async function resumeBulkCampaign(id: string) {
    const existing = await prisma.bulkCampaign.findUnique({
        where: { id },
        select: { status: true },
    });

    if (!existing) {
        throw new Error("Campaña no encontrada");
    }

    if (existing.status === "draft") {
        return startBulkCampaign(id);
    }

    return prisma.bulkCampaign.update({
        where: { id },
        data: {
            status: "running",
            completedAt: null,
            nextRunAt: new Date(),
            workerLockId: null,
            workerLockExpiresAt: null,
        },
        include: {
            variants: {
                orderBy: { sortOrder: "asc" },
            },
        },
    });
}

export async function cancelBulkCampaign(id: string) {
    await prisma.$transaction(async (tx) => {
        await tx.bulkCampaignRecipient.updateMany({
            where: {
                campaignId: id,
                status: "queued",
            },
            data: {
                status: "cancelled",
            },
        });

        await tx.bulkCampaign.update({
            where: { id },
            data: {
                status: "cancelled",
                nextRunAt: null,
                workerLockId: null,
                workerLockExpiresAt: null,
                completedAt: new Date(),
            },
        });
    });

    return getBulkCampaignById(id);
}

export async function deleteBulkCampaign(id: string) {
    await prisma.bulkCampaign.delete({
        where: { id },
    });
}

function chooseVariant(variants: BulkCampaignVariant[], campaignType: OutboundMessageType) {
    const activeVariants = variants.filter((variant) =>
        variant.isActive && (campaignType !== "text" || variant.content.trim()),
    );
    const totalWeight = activeVariants.reduce((sum, variant) => sum + Math.max(1, variant.weight), 0);
    if (totalWeight <= 0) {
        return activeVariants[0] || null;
    }

    let cursor = Math.random() * totalWeight;

    for (const variant of activeVariants) {
        cursor -= Math.max(1, variant.weight);
        if (cursor <= 0) {
            return variant;
        }
    }

    return activeVariants[0] || null;
}

async function releaseCampaignLock(campaignId: string, lockId: string, data?: Prisma.BulkCampaignUpdateInput) {
    await prisma.bulkCampaign.updateMany({
        where: {
            id: campaignId,
            workerLockId: lockId,
        },
        data: {
            workerLockId: null,
            workerLockExpiresAt: null,
            ...(data || {}),
        },
    });
}

async function resolveNextCampaignRunAt(campaign: Pick<BulkCampaign, "respectBusinessHours">, now: Date) {
    if (!campaign.respectBusinessHours) {
        return now;
    }

    const settings = await getSystemSettingsOrDefaults();
    const config = normalizeBusinessHours(settings);
    const bounds = businessBoundsForDate(now, config);

    if (!bounds.isOpen) {
        const nextOpenDate = getNextOpenDate(now, config);
        return businessBoundsForDate(nextOpenDate, config).start;
    }

    if (now < bounds.start) {
        return bounds.start;
    }

    if (now >= bounds.end) {
        const tomorrow = new Date(now);
        tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
        const nextOpenDate = getNextOpenDate(tomorrow, config);
        return businessBoundsForDate(nextOpenDate, config).start;
    }

    return now;
}

async function processClaimedCampaign(campaignId: string, lockId: string) {
    const campaign = await prisma.bulkCampaign.findUnique({
        where: { id: campaignId },
        include: {
            variants: {
                where: {
                    isActive: true,
                },
                orderBy: { sortOrder: "asc" },
            },
        },
    });

    if (!campaign || campaign.workerLockId !== lockId || campaign.status !== "running") {
        return;
    }

    try {
        if (campaign.variants.length === 0) {
            await releaseCampaignLock(campaignId, lockId, {
                status: "failed",
                nextRunAt: null,
                lastProcessedAt: new Date(),
            });
            return;
        }

        const now = new Date();
        const nextAllowedRunAt = await resolveNextCampaignRunAt(campaign, now);
        if (nextAllowedRunAt.getTime() > now.getTime()) {
            await releaseCampaignLock(campaignId, lockId, {
                nextRunAt: nextAllowedRunAt,
                lastProcessedAt: now,
            });
            return;
        }

        const recipients = await prisma.bulkCampaignRecipient.findMany({
            where: {
                campaignId,
                status: "queued",
            },
            include: {
                contact: true,
            },
            orderBy: { sequenceIndex: "asc" },
            take: Math.max(1, campaign.batchSize),
        });

        if (recipients.length === 0) {
            await refreshBulkCampaignStats(campaignId);
            await releaseCampaignLock(campaignId, lockId, {
                status: "completed",
                completedAt: new Date(),
                nextRunAt: null,
                lastProcessedAt: now,
            });
            return;
        }

        const settings = await getSystemSettingsOrDefaults();

        for (const recipient of recipients) {
            const variant = chooseVariant(campaign.variants, campaign.type as OutboundMessageType);

            if (!variant) {
                await prisma.bulkCampaignRecipient.update({
                    where: { id: recipient.id },
                    data: {
                        status: "failed",
                        lastError: "No hay variantes activas disponibles",
                    },
                });
                continue;
            }

            try {
                const conversation = recipient.conversationId
                    ? await prisma.conversation.findUnique({ where: { id: recipient.conversationId } })
                    : await findOrCreateActiveConversationForContact(recipient.contactId);
                const activeConversation = conversation || await findOrCreateActiveConversationForContact(recipient.contactId);
                const renderedContent = renderTemplateContent(variant.content || "", {
                    contact: {
                        name: recipient.contact.name,
                        company: recipient.contact.company,
                        phone: recipient.contact.phone,
                    },
                    agentName: settings.agentName,
                });

                const result = await sendOutboundConversationMessage({
                    conversationId: activeConversation.id,
                    content: renderedContent,
                    type: campaign.type as OutboundMessageType,
                    mediaUrl: campaign.type === "text" ? null : campaign.mediaUrl,
                    mediaType: campaign.type === "text" ? null : campaign.mediaType,
                    mediaFileName: campaign.type === "text" ? null : campaign.mediaFileName,
                    senderType: "human",
                });

                await prisma.bulkCampaignRecipient.update({
                    where: { id: recipient.id },
                    data: {
                        status: "sent",
                        conversationId: activeConversation.id,
                        variantId: variant.id,
                        renderedContent,
                        providerMessageId: result.message.providerMessageId || null,
                        sentAt: new Date(),
                        lastError: null,
                    },
                });
            } catch (error) {
                await prisma.bulkCampaignRecipient.update({
                    where: { id: recipient.id },
                    data: {
                        status: "failed",
                        lastError: error instanceof Error ? error.message : "No se pudo enviar el mensaje",
                    },
                });
            }
        }

        const refreshed = await refreshBulkCampaignStats(campaignId);
        const remainingQueued = await prisma.bulkCampaignRecipient.count({
            where: {
                campaignId,
                status: "queued",
            },
        });

        if (remainingQueued === 0) {
            await releaseCampaignLock(campaignId, lockId, {
                status: "completed",
                completedAt: refreshed?.completedAt || new Date(),
                nextRunAt: null,
                lastProcessedAt: new Date(),
            });
            return;
        }

        const nextRunAt = new Date(Date.now() + Math.max(1, campaign.batchDelayMinutes) * 60_000);
        await releaseCampaignLock(campaignId, lockId, {
            nextRunAt,
            lastProcessedAt: new Date(),
        });
    } catch (error) {
        console.error("[BulkCampaigns] Failed to process campaign", campaignId, error);
        await releaseCampaignLock(campaignId, lockId, {
            status: "failed",
            nextRunAt: null,
            lastProcessedAt: new Date(),
        });
    }
}

export async function processDueBulkCampaigns(limit = 3) {
    const now = new Date();
    const candidates = await prisma.bulkCampaign.findMany({
        where: {
            status: "running",
            nextRunAt: {
                lte: now,
            },
            OR: [
                { workerLockExpiresAt: null },
                { workerLockExpiresAt: { lt: now } },
            ],
        },
        orderBy: { nextRunAt: "asc" },
        take: Math.max(1, limit),
    });

    for (const campaign of candidates) {
        const lockId = crypto.randomUUID();
        const claimed = await prisma.bulkCampaign.updateMany({
            where: {
                id: campaign.id,
                status: "running",
                OR: [
                    { workerLockExpiresAt: null },
                    { workerLockExpiresAt: { lt: now } },
                ],
            },
            data: {
                workerLockId: lockId,
                workerLockExpiresAt: new Date(Date.now() + WORKER_LOCK_TTL_MS),
            },
        });

        if (claimed.count === 1) {
            await processClaimedCampaign(campaign.id, lockId);
        }
    }
}

export async function markBulkCampaignReplyForContact(
    contactId: string,
    conversationId: string | null,
    repliedAt = new Date(),
) {
    const recipients = await prisma.bulkCampaignRecipient.findMany({
        where: {
            contactId,
            sentAt: { not: null },
            repliedAt: null,
            campaign: {
                stopOnReply: true,
            },
        },
        select: {
            id: true,
            campaignId: true,
        },
    });

    if (recipients.length === 0) {
        return;
    }

    await prisma.bulkCampaignRecipient.updateMany({
        where: {
            id: {
                in: recipients.map((recipient) => recipient.id),
            },
        },
        data: {
            status: "replied",
            repliedAt,
            lastInboundAt: repliedAt,
            conversationId: conversationId || undefined,
        },
    });

    const campaignIds = recipients
        .map((recipient) => recipient.campaignId)
        .filter((campaignId, index, array) => array.indexOf(campaignId) === index);

    for (const campaignId of campaignIds) {
        await refreshBulkCampaignStats(campaignId);
    }
}
