
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    const contact = await prisma.contact.findFirst()
    if (contact) {
        console.log(`CONTACT_ID:${contact.id}`)
    } else {
        console.log('NO_CONTACTS')
    }
}

main()
    .catch(e => {
        throw e
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
