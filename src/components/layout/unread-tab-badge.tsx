"use client";

import { useEffect } from "react";
import {
    INBOX_UNREAD_EVENT,
    applyUnreadBrowserBadge,
    readUnreadCounts,
} from "@/lib/inbox-browser-badge";

export function UnreadTabBadge() {
    useEffect(() => {
        const syncBadge = () => {
            applyUnreadBrowserBadge(readUnreadCounts());
        };

        syncBadge();

        window.addEventListener(INBOX_UNREAD_EVENT, syncBadge as EventListener);
        window.addEventListener("storage", syncBadge);
        document.addEventListener("visibilitychange", syncBadge);

        return () => {
            window.removeEventListener(INBOX_UNREAD_EVENT, syncBadge as EventListener);
            window.removeEventListener("storage", syncBadge);
            document.removeEventListener("visibilitychange", syncBadge);
        };
    }, []);

    return null;
}
