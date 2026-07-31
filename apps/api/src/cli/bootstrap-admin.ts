import { prisma } from '../db.js'
import { bootstrapAdmin } from '../services/admin-bootstrap.js'

try {
  const result = await bootstrapAdmin({
    username: process.env.ADMIN_BOOTSTRAP_USERNAME,
    password: process.env.ADMIN_BOOTSTRAP_PASSWORD,
  })

  if (result.status === 'disabled') {
    console.log('Administrator bootstrap disabled.')
  } else if (result.status === 'skipped') {
    console.log(`Administrator bootstrap skipped; ${result.username} already exists.`)
  } else {
    console.log(`Administrator ${result.username} created from bootstrap configuration.`)
  }
} finally {
  await prisma.$disconnect()
}
