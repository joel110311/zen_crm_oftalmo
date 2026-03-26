export async function register() {
    if (process.env.NEXT_RUNTIME !== "nodejs") {
        return;
    }

    if (process.env.BULK_CAMPAIGN_WORKER_DISABLED === "true") {
        return;
    }

    const { startBulkCampaignWorker } = await import("@/lib/bulk-campaign-worker");
    startBulkCampaignWorker();
}
