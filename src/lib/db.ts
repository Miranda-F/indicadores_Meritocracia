import { PrismaClient } from '@prisma/client'

// Sempre criar uma nova instância para garantir que temos os modelos mais recentes
// Ignorar cache global para evitar problemas com novos modelos
export const db = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
})

// Log para depuração - mostrar modelos disponíveis
if (process.env.NODE_ENV !== 'production') {
  const modelNames = Object.keys(db).filter(k => !k.startsWith('_') && !k.startsWith('$'))
  console.log('✅ Prisma Client initialized with models:', modelNames.join(', '))
}