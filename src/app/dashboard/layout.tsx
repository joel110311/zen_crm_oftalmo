import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { InboxNotifier } from "@/components/layout/inbox-notifier";
import { UnreadTabBadge } from "@/components/layout/unread-tab-badge";
import { SessionProvider } from "@/components/providers/session-provider";
import { auth } from "@/lib/auth";

// Force all dashboard pages to be server-rendered at request time (not during build)
// This is required for Docker builds where no database is available
export const dynamic = 'force-dynamic';

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await auth();

    return (
        <SessionProvider session={session}>
            <div className="flex h-screen overflow-hidden bg-background w-full">
                <InboxNotifier />
                <UnreadTabBadge />
                <Sidebar />
                <div className="flex flex-col flex-1 overflow-hidden pt-14 md:pt-0">
                    <Header />
                    <main className="flex-1 overflow-auto p-4 md:p-6 min-h-0">
                        {children}
                    </main>
                </div>
            </div>
        </SessionProvider>
    );
}
