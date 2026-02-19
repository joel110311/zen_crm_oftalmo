import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

// Force all dashboard pages to be server-rendered at request time (not during build)
// This is required for Docker builds where no database is available
export const dynamic = 'force-dynamic';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex h-screen overflow-hidden bg-background max-w-[2560px] mx-auto w-full">
            <Sidebar />
            <div className="flex flex-col flex-1 overflow-hidden pt-14 md:pt-0">
                <Header />
                <main className="flex-1 overflow-auto p-3 md:p-6 lg:p-8 2xl:p-10 min-h-0">
                    {children}
                </main>
            </div>
        </div>
    );
}
