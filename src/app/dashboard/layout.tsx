import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex h-screen overflow-hidden bg-background">
            <Sidebar />
            <div className="flex flex-col flex-1 overflow-hidden">
                <Header />
                <main className="flex-1 overflow-auto p-6 md:p-8">
                    {children}
                </main>
            </div>
        </div>
    );
}
