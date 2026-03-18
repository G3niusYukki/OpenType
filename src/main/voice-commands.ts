/**
 * Voice Command Parser
 *
 * Parses transcribed voice input to distinguish editing commands from content.
 * Commands are matched by prefix patterns (case-insensitive, supports Chinese & English).
 */

export type VoiceCommandType =
  | 'translate'
  | 'insert-line'
  | 'delete-sentence'
  | 'undo'
  | 'add-heading'
  | 'summarize'
  | 'make-formal'
  | 'make-casual'
  | 'content';

export interface ParsedVoiceInput {
  type: VoiceCommandType;
  command?: string;
  content?: string;
  targetLang?: string;
}

// Command prefix patterns — order matters (more specific first)
const COMMAND_PATTERNS: Array<{
  type: VoiceCommandType;
  patterns: RegExp[];
  targetLang?: string;
}> = [
  // Translate to English
  {
    type: 'translate',
    patterns: [
      /^翻译(成|为)?(英文|英语)/i,
      /^translate to english/i,
    ],
    targetLang: 'en',
  },
  // Translate to Chinese
  {
    type: 'translate',
    patterns: [
      /^翻译(成|为)?(中文|汉语)/i,
      /^translate to chinese/i,
    ],
    targetLang: 'zh',
  },
  // Translate to Japanese
  {
    type: 'translate',
    patterns: [
      /^翻译(成|为)?(日文|日语)/i,
      /^translate to japanese/i,
    ],
    targetLang: 'ja',
  },
  // Translate to Korean
  {
    type: 'translate',
    patterns: [
      /^翻译(成|为)?(韩文|韩语)/i,
      /^translate to korean/i,
    ],
    targetLang: 'ko',
  },
  // New line
  {
    type: 'insert-line',
    patterns: [/^新(增)?行$/i, /^newline$/i, /^new line$/i],
  },
  // Delete last sentence
  {
    type: 'delete-sentence',
    patterns: [/^删[除]?(最后|上一)(句|句?话)/i, /^delete last sentence$/i],
  },
  // Undo
  {
    type: 'undo',
    patterns: [/^撤销$/i, /^undo$/i],
  },
  // Add heading
  {
    type: 'add-heading',
    patterns: [/^加(|上|个)标题$/i, /^add heading$/i],
  },
  // Summarize
  {
    type: 'summarize',
    patterns: [/^总结$/i, /^summarize$/i],
  },
  // Make formal
  {
    type: 'make-formal',
    patterns: [/^改(|成)(正式|书面)/i, /^make formal$/i],
  },
  // Make casual
  {
    type: 'make-casual',
    patterns: [/^改(|成)(口语|随意)/i, /^make casual$/i],
  },
];

/**
 * Parse transcribed voice input text and determine the command type.
 * If no command prefix matches, treat the entire text as content to insert.
 */
export function parseVoiceInput(
  text: string,
  _mode: string
): ParsedVoiceInput {
  const trimmed = text.trim();

  if (!trimmed) {
    return { type: 'content', content: '' };
  }

  for (const { type, patterns, targetLang } of COMMAND_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(trimmed)) {
        if (type === 'translate') {
          return { type, targetLang };
        }
        return { type, command: trimmed };
      }
    }
  }

  // No command prefix matched — treat as content
  return { type: 'content', content: trimmed };
}

/**
 * Remove the last sentence from a block of text.
 * Sentences are split by common sentence-ending punctuation.
 */
export function removeLastSentence(text: string): string {
  // Match common sentence endings: 。！？.!? followed by whitespace or end
  const sentences = text.split(/(?<=[。！？.!?])\s*/);
  if (sentences.length <= 1) {
    return '';
  }
  return sentences.slice(0, -1).join(' ').trim();
}
