import { setTimeout } from 'node:timers/promises';

export const delay = (ms: number): Promise<void> => setTimeout(ms);
