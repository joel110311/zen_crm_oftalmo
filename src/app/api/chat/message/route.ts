import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function DELETE(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: "No autorizado." }, { status: 401 });
        }

        const { messageId, conversationId } = await request.json();

        if (!messageId || !conversationId) {
            return NextResponse.json(
                { error: "messageId y conversationId son obligatorios." },
                { status: 400 },
            );
        }

        const message = await prisma.message.findUnique({
            where: { id: messageId },
            select: {
                id: true,
                conversationId: true,
            },
        });

        if (!message || message.conversationId !== conversationId) {
            return NextResponse.json({ error: "Mensaje no encontrado." }, { status: 404 });
        }

        await prisma.message.delete({
            where: { id: messageId },
        });

        return NextResponse.json({
            success: true,
            deletedMessageId: messageId,
        });
    } catch (error) {
        console.error("[API] Delete message error:", error);
        return NextResponse.json(
            { error: "No se pudo eliminar el mensaje." },
            { status: 500 },
        );
    }
}
