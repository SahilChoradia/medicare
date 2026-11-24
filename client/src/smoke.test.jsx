import { describe, it, expect } from 'vitest'; import { addDays } from './api';
describe('date helper', () => { it('adds days across month end', () => expect(addDays('2026-11-30', 1)).toBe('2026-12-01')); });
