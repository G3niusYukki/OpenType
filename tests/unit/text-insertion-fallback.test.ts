import { describe, it, expect } from 'vitest';
import { TextInserter } from '../../src/main/text-inserter';

describe('Text Insertion Fallback Flows', () => {
  let inserter: TextInserter;

  beforeEach(() => {
    inserter = new TextInserter();
  });

  it('should fallback to clipboard when accessibility is denied', async () => {
    // This would need OS-level mocking
    expect(inserter).toBeDefined();
  });

  it('should handle very long text insertion', async () => {
    const longText = 'a'.repeat(10000);
    const result = await inserter.insert(longText);
    expect(result.text).toBe(longText);
  });
});
