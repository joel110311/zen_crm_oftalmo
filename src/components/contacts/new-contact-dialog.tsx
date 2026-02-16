"use client";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { createContact } from "@/app/actions/contacts";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { useToast } from "@/components/ui/use-toast";

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? "Saving..." : "Save Contact"}
        </Button>
    );
}

export function NewContactDialog() {
    const [open, setOpen] = useState(false);

    const { toast } = useToast();

    async function handleSubmit(formData: FormData) {
        const result = await createContact(formData);
        if (result && result.success) {
            toast({ title: "Success", description: "Contact created successfully." });
            setOpen(false);
        } else {
            // @ts-ignore
            toast({ title: "Error", description: result?.error || "Failed to create contact.", variant: "destructive" });
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <Plus className="mr-2 h-4 w-4" /> Add Contact
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Add New Contact</DialogTitle>
                    <DialogDescription>
                        Create a new contact in your CRM.
                    </DialogDescription>
                </DialogHeader>
                <form action={handleSubmit}>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="name" className="text-right">
                                Name
                            </Label>
                            <Input id="name" name="name" placeholder="John Doe" className="col-span-3" required />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="email" className="text-right">
                                Email
                            </Label>
                            <Input id="email" name="email" type="email" placeholder="john@example.com" className="col-span-3" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="phone" className="text-right">
                                Phone
                            </Label>
                            <Input id="phone" name="phone" placeholder="+1234567890" className="col-span-3" required />
                        </div>
                    </div>
                    <DialogFooter>
                        <SubmitButton />
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
