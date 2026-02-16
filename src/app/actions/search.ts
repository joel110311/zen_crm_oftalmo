"use server";

import { prisma } from "@/lib/db";

export type SearchResult = {
    contacts: Array<{
        id: string;
        name: string | null;
        lastName: string | null;
        email: string | null;
        company: string | null;
        avatar?: string;
    }>;
    deals: Array<{
        id: string;
        title: string;
        value: number;
        stageName: string;
    }>;
};

export async function searchGlobal(term: string): Promise<SearchResult> {
    if (!term || term.length < 2) {
        return { contacts: [], deals: [] };
    }

    const normalizedTerm = term.trim();

    try {
        const [contacts, deals] = await Promise.all([
            prisma.contact.findMany({
                where: {
                    OR: [
                        { name: { contains: normalizedTerm, mode: "insensitive" } },
                        { lastName: { contains: normalizedTerm, mode: "insensitive" } },
                        { email: { contains: normalizedTerm, mode: "insensitive" } },
                        { company: { contains: normalizedTerm, mode: "insensitive" } },
                        { phone: { contains: normalizedTerm, mode: "insensitive" } },
                    ],
                },
                select: {
                    id: true,
                    name: true,
                    lastName: true,
                    email: true,
                    company: true,
                    // No avatar field in schema, so we'll omit it or handle default on frontend
                },
                take: 5,
            }),
            prisma.deal.findMany({
                where: {
                    title: { contains: normalizedTerm, mode: "insensitive" },
                },
                select: {
                    id: true,
                    title: true,
                    value: true,
                    stage: {
                        select: {
                            name: true,
                        },
                    },
                },
                take: 5,
            }),
        ]);

        return {
            contacts: contacts.map(c => ({
                ...c,
                avatar: undefined, // placeholder
            })),
            deals: deals.map(d => ({
                id: d.id,
                title: d.title,
                value: d.value,
                stageName: d.stage.name,
            })),
        };
    } catch (error) {
        console.error("Search error:", error);
        return { contacts: [], deals: [] };
    }
}
