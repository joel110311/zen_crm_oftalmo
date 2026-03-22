"use client";

import { useTransition, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Plus, MoreHorizontal, Filter, Download } from "lucide-react";
import { NewContactDialog } from "@/components/contacts/new-contact-dialog";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";
import { useDebouncedCallback } from "use-debounce";
import { ContactTableTags } from "@/components/contacts/contact-table-tags";
import { ContactActions } from "@/components/contacts/contact-actions";
import { getContactFullName, getContactInitial } from "@/lib/contact-name";

interface ContactsPageProps {
    contacts: any[]; // Prisma type
}

export function ContactsTable({ contacts }: ContactsPageProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();

    const handleSearch = useDebouncedCallback((term: string) => {
        const params = new URLSearchParams(searchParams);
        if (term) {
            params.set("query", term);
        } else {
            params.delete("query");
        }
        startTransition(() => {
            router.replace(`/dashboard/contacts?${params.toString()}`);
        });
    }, 300);

    return (
        <div className="flex flex-col h-full bg-card rounded-lg border border-border shadow-sm">
            {/* Header / Toolbar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border-b border-border gap-3">
                <div className="flex items-center gap-2">
                    <h1 className="text-xl font-bold text-foreground">Contactos</h1>
                    <span className="bg-muted text-muted-foreground px-2 py-0.5 rounded-full text-xs font-medium">
                        {contacts.length}
                    </span>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar..."
                            className="pl-9 h-9 w-full sm:w-[250px] bg-background border-input focus:bg-background transition-colors"
                            defaultValue={searchParams.get("query")?.toString()}
                            onChange={(e) => handleSearch(e.target.value)}
                        />
                    </div>

                    <NewContactDialog />

                    <Button variant="outline" size="icon" className="h-9 w-9">
                        <Download className="h-4 w-4 text-muted-foreground" />
                    </Button>
                </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto bg-card">
                <Table>
                    <TableHeader className="bg-muted/50 sticky top-0 z-10">
                        <TableRow className="hover:bg-transparent border-b border-border">
                            <TableHead className="w-[40px]">
                                <Checkbox />
                            </TableHead>
                            <TableHead className="text-muted-foreground">Nombre</TableHead>
                            <TableHead className="text-muted-foreground hidden md:table-cell">Compañía</TableHead>
                            <TableHead className="text-muted-foreground">Teléfono</TableHead>
                            <TableHead className="text-muted-foreground hidden lg:table-cell">Email</TableHead>
                            <TableHead className="text-muted-foreground hidden lg:table-cell">Etiquetas</TableHead>
                            <TableHead className="text-right text-muted-foreground">Creado</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {contacts.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                                    No se encontraron contactos.
                                </TableCell>
                            </TableRow>
                        ) : (
                            contacts.map((contact) => {
                                const fullName = getContactFullName(contact);
                                return (
                                <TableRow key={contact.id} className="group hover:bg-muted/50 transition-colors border-b border-border">
                                    <TableCell>
                                        <Checkbox />
                                    </TableCell>
                                    <TableCell>
                                        <Link href={`/dashboard/contacts/${contact.id}`} className="flex items-center gap-3">
                                            <Avatar className="h-8 w-8">
                                                <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                                                    {getContactInitial(contact)}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <div className="font-medium text-foreground group-hover:text-primary transition-colors">
                                                    {fullName}
                                                </div>
                                            </div>
                                        </Link>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground hidden md:table-cell">
                                        {contact.company || "-"}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground font-mono text-xs">
                                        {contact.phone}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-sm hidden lg:table-cell">
                                        {contact.email || "-"}
                                    </TableCell>
                                    <TableCell className="hidden lg:table-cell">
                                        <ContactTableTags contactId={contact.id} tags={contact.tags || []} />
                                    </TableCell>
                                    <TableCell className="text-right text-muted-foreground text-xs whitespace-nowrap">
                                        {formatDistanceToNow(new Date(contact.createdAt), { addSuffix: true, locale: es })}
                                    </TableCell>
                                    <TableCell>
                                        <ContactActions contactId={contact.id} />
                                    </TableCell>
                                </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
