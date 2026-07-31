import type { PrototypeState } from '../domain/models'

export const DEMO_STUDIO_ID = 'studio-demo'
export const DEMO_USER_ID = 'user-demo'
export const DEMO_ADMIN_ID = 'admin-demo'

export function createDemoState(): PrototypeState {
  return {
    studios: [
      {
        id: DEMO_STUDIO_ID,
        name: '演示工作室',
        registrationCode: 'demo-studio',
        accessToken: 'studio-demo-8f3c2a',
        enabled: true,
        createdAt: '2026-08-01T00:00:00.000Z',
      },
    ],
    users: [
      {
        id: DEMO_USER_ID,
        username: 'demo',
        password: 'Demo123!',
        studioId: DEMO_STUDIO_ID,
        enabled: true,
        createdAt: '2026-08-01T01:00:00.000Z',
      },
    ],
    admins: [
      {
        id: DEMO_ADMIN_ID,
        username: 'admin',
        password: 'Admin123!',
      },
    ],
    tasks: [
      {
        id: 'TASK-1001',
        url: 'https://example.com/queued',
        status: 'queued',
        userId: DEMO_USER_ID,
        studioId: DEMO_STUDIO_ID,
        submittedAt: '2026-08-01T02:00:00.000Z',
      },
      {
        id: 'TASK-1002',
        url: 'https://example.com/processing',
        status: 'processing',
        userId: DEMO_USER_ID,
        studioId: DEMO_STUDIO_ID,
        submittedAt: '2026-08-01T02:10:00.000Z',
        processingStartedAt: '2026-08-01T02:20:00.000Z',
      },
      {
        id: 'TASK-1003',
        url: 'https://example.com/success',
        status: 'success',
        userId: DEMO_USER_ID,
        studioId: DEMO_STUDIO_ID,
        submittedAt: '2026-08-01T02:30:00.000Z',
        processingStartedAt: '2026-08-01T02:40:00.000Z',
        completedAt: '2026-08-01T02:50:00.000Z',
      },
      {
        id: 'TASK-1004',
        url: 'https://example.com/failed',
        status: 'failed',
        userId: DEMO_USER_ID,
        studioId: DEMO_STUDIO_ID,
        submittedAt: '2026-08-01T03:00:00.000Z',
        processingStartedAt: '2026-08-01T03:10:00.000Z',
        completedAt: '2026-08-01T03:20:00.000Z',
      },
    ],
  }
}
