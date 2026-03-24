"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { maybePlayNotification } from "@/lib/notificationSounds";
import { incrementUnreadCounts } from "@/lib/inbox-browser-badge";

type ConversationSnapshot = {
    id: string;
    updatedAt?: string | Date;
    lastMessageDirection?: string;
    isMuted?: boolean;
};

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
                    const timestamp = new Date(conversation.updatedAt || Date.now()).toISOString();
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
