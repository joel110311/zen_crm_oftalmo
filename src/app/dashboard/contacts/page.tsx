import { getContacts } from "@/app/actions/contacts";
import { ContactsTable } from "@/components/contacts/contacts-table";

export const dynamic = "force-dynamic";

export default async function ContactsPage({
    searchParams,
}: {
    searchParams: { query?: string };
}) {
    const query = searchParams?.query || "";
    const contacts = await getContacts(query);

    return (
        <div className="h-[calc(100vh-8rem)]">
            <ContactsTable contacts={contacts} />
        </div>
    );
}
