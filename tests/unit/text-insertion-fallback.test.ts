import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TextInserter } from '../../src/main/text-inserter';

vi.mock('electron', () => ({
  clipboard: {
    writeText: vi.fn()
  }
}));

describe('Text Insertion Fallback Flows', () => {
  let inserter: TextInserter;

  beforeEach(() => {
    inserter = new TextInserter();
  });

  it('should be defined', () => {
    expect(inserter).toBeDefined();
    expect(typeof inserter.insert).toBe('function');
  });

  it('should handle text insertion attempts', async () => {
    const result = await inserter.insert('Hello world');
    expect(result).toBeDefined();
    expect(result.text).toBe('Hello world');
    expect(typeof result.success).toBe('boolean');
  });

  it('should handle empty text', async () => {
    const result = await inserter.insert('');
    expect(result.text).toBe('');
  });

  it('should handle very long text', async () => {
    const longText = 'a'.repeat(10000);
    const result = await inserter.insert(longText);
    expect(result.text).toBe(longText);
  });

  it('should handle special characters', async () => {
    const specialText = 'Hello! @#$%^&*()_+ {}[]|\\:;"<> ,./?';
    const result = await inserter.insert(specialText);
    expect(result.text).toBe(specialText);
  });

  it('should handle unicode text', async () => {
    const unicodeText = 'Hello 世界 🌍 Привет';
    const result = await inserter.insert(unicodeText);
    expect(result.text).toBe(unicodeText);
  });

  it('should handle multiline text', async () => {
    const multilineText = 'Line 1\nLine 2\nLine 3';
    const result = await inserter.insert(multilineText);
    expect(result.text).toBe(multilineText);
  });
});
