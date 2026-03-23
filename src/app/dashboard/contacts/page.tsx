import { getContacts } from "@/app/actions/contacts";
import { ContactsTable } from "@/components/contacts/contacts-table";

export const dynamic = "force-dynamic";

export default async function ContactsPage({
    searchParams,
}: {
    searchParams?: Promise<{ query?: string | string[] }>;
}) {
    const resolvedSearchParams = await searchParams;
    const queryValue = resolvedSearchParams?.query;
    const query = Array.isArray(queryValue) ? queryValue[0] || "" : queryValue || "";
    const contacts = await getContacts(query);

    return (
        <div className="h-full">
            <ContactsTable contacts={contacts} />
        </div>
    );
}
