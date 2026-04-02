"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { maybePlayNotification } from "@/lib/notificationSounds";
import { incrementUnreadCounts } from "@/lib/inbox-browser-badge";

type ConversationSnapshot = {
    id: string;
    lastMessageTime?: string | Date;
    updatedAt?: string | Date;
    lastMessageDirection?: string;
    isMuted?: boolean;
};

function toIsoTimestamp(value: string | Date | undefined) {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return null;
    }
    return parsed.toISOString();
}

export function InboxNotifier() {
    const pathname = usePathname();
    const isFirstFetchRef = useRef(true);
    const previousTimestampsRef = useRef<Record<string, string>>({});

    useEffect(() => {
        if (pathname === "/dashboard/inbox") {
            return;
        }

        const poll = async () => {
            try {
                const response = await fetch("/api/chat", { cache: "no-store" });
                const conversations = (await response.json()) as ConversationSnapshot[];
                if (!Array.isArray(conversations)) {
                    return;
                }

                const nextTimestamps: Record<string, string> = {};
                let playedSound = false;
                const changedInboundConversationIds: string[] = [];

                for (const conversation of conversations) {
                    const timestamp =
                        toIsoTimestamp(conversation.lastMessageTime) ||
                        toIsoTimestamp(conversation.updatedAt) ||
                        new Date().toISOString();
                    nextTimestamps[conversation.id] = timestamp;

                    if (isFirstFetchRef.current) {
                        continue;
                    }

                    if (
                        previousTimestampsRef.current[conversation.id] &&
                        previousTimestampsRef.current[conversation.id] !== timestamp &&
                        conversation.lastMessageDirection === "inbound"
                    ) {
                        changedInboundConversationIds.push(conversation.id);

                        if (!playedSound) {
                            maybePlayNotification(Boolean(conversation.isMuted));
                            playedSound = true;
                        }
                    }
                }

                if (changedInboundConversationIds.length > 0) {
                    incrementUnreadCounts(changedInboundConversationIds);
                }

                previousTimestampsRef.current = nextTimestamps;
                isFirstFetchRef.current = false;
            } catch (error) {
                console.error("Failed to poll inbox notifications:", error);
            }
        };

        void poll();
        const interval = setInterval(() => {
            void poll();
        }, 4000);

        return () => clearInterval(interval);
    }, [pathname]);

    return null;
}
