import { PipelineBoard } from "@/components/pipeline/pipeline-board";
import { getPipelineData } from "@/app/actions/pipeline";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
    let stages: any[] = [];
    let deals: any[] = [];

    try {
        const data = await getPipelineData();
        stages = data.stages;
        deals = data.deals.map((d: any) => ({
            ...d,
            createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : String(d.createdAt),
            updatedAt: d.updatedAt instanceof Date ? d.updatedAt.toISOString() : String(d.updatedAt),
        }));
    } catch (error) {
        console.warn("Failed to fetch pipeline data (likely during build):", error);
    }

    return (
        <PipelineBoard
            initialStages={stages}
            initialDeals={deals}
        />
    );
}
