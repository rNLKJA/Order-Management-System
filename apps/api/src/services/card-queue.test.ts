import { describe, expect, it } from 'vitest';
import { activateQueuedCardAfterExhaust } from './card-queue.js';

describe('activateQueuedCardAfterExhaust', () => {
  it('activates queued card waiting on exhausted card', async () => {
    const updates: Array<{ id: number; status: string }> = [];
    const tx = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [
              {
                id: 20,
                member_id: 1,
                status: 'queued',
                queued_after_card_id: 10,
              },
            ],
          }),
        }),
      }),
      update: () => ({
        set: (patch: { status: string }) => ({
          where: () => ({
            returning: async () => [{ id: 20, status: patch.status }],
          }),
        }),
      }),
    };

    const activated = await activateQueuedCardAfterExhaust(tx as never, 1, 10);
    expect(activated?.id).toBe(20);
    expect(activated?.status).toBe('active');
  });
});
