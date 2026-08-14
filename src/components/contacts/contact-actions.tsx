"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Pencil, Trash } from "lucide-react";
import { deleteContact } from "@/app/actions/contacts";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/use-toast";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface ContactActionsProps {
    contactId: string;
}

export function ContactActions({ contactId }: ContactActionsProps) {
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();
    const router = useRouter();

    const handleDelete = () => {
        if (!confirm("¿Estás seguro de que quieres eliminar este contacto?")) return;

        startTransition(async () => {
            const result = await deleteContact(contactId);
            if (result.success) {
                toast({ title: "Contacto eliminado", description: "El contacto se ha eliminado correctamente." });
                router.refresh();
            } else {
                toast({ title: "Error", description: result.error || "No se pudo eliminar el contacto.", variant: "destructive" });
            }
        });
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-gray-900">
                    <MoreHorizontal className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                    <Link href={`/dashboard/contacts/${contactId}`} className="cursor-pointer">
                        <Pencil className="mr-2 h-4 w-4 text-gray-500" />
                        Editar
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleDelete} className="text-red-600 focus:text-red-600 cursor-pointer">
                    <Trash className="mr-2 h-4 w-4" />
                    Eliminar
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
