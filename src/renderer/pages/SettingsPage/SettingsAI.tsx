import { useState, useEffect } from 'react';
import { Card, Toggle, Badge } from '../../components/ui';

export function SettingsAI() {
  const [aiSettings, setAiSettingsState] = useState({
    enabled: false,
    options: {
      removeFillerWords: true,
      removeRepetition: true,
      detectSelfCorrection: true,
      restorePunctuation: true,
    },
    showComparison: true,
  });
  const [aiAvailable, setAiAvailable] = useState(false);

  useEffect(() => {
    window.electronAPI.aiGetSettings().then((s: any) => {
      setAiSettingsState(s || aiSettings);
      checkAiAvailability(s);
    });
  }, []);

  const checkAiAvailability = async (settings?: typeof aiSettings) => {
    const aiSet = settings || aiSettings;
    const providers = await window.electronAPI.storeGet('providers') as any[];
    const hasAiProvider = providers?.some((p: any) => {
      const isEnabled = p.enabledForPostProcessing ?? p.enabled;
      return isEnabled && p.apiKey && ['openai', 'groq', 'anthropic', 'deepseek', 'zhipu', 'minimax', 'moonshot'].includes(p.id);
    });
    setAiAvailable(!!hasAiProvider);
  };

  const update = (u: any) => {
    setAiSettingsState((s: any) => ({ ...s, ...u }));
    window.electronAPI.aiSetSettings(u);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <Card glass padding="lg">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          <Toggle
            label="Enable AI Post-Processing"
            description="Automatically clean up and format your transcription"
            checked={aiSettings.enabled}
            onChange={v => update({ enabled: v })}
          />
          {aiSettings.enabled && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', paddingLeft: 'var(--space-4)', borderLeft: '2px solid var(--color-border-subtle)' }}>
              <Toggle
                label="Remove Filler Words"
                description='"um", "uh", "ah" etc.'
                checked={aiSettings.options.removeFillerWords}
                onChange={v => update({ options: { ...aiSettings.options, removeFillerWords: v } })}
              />
              <Toggle
                label="Remove Repetition"
                description="Remove repeated words and phrases"
                checked={aiSettings.options.removeRepetition}
                onChange={v => update({ options: { ...aiSettings.options, removeRepetition: v } })}
              />
              <Toggle
                label="Detect Self-Correction"
                description='Remove self-corrections like "I mean" or "that is"'
                checked={aiSettings.options.detectSelfCorrection}
                onChange={v => update({ options: { ...aiSettings.options, detectSelfCorrection: v } })}
              />
              <Toggle
                label="Restore Punctuation"
                description="Add proper punctuation and capitalization"
                checked={aiSettings.options.restorePunctuation ?? true}
                onChange={v => update({ options: { ...aiSettings.options, restorePunctuation: v } })}
              />
              <Toggle
                label="Show Comparison"
                description="Show before/after comparison in results"
                checked={aiSettings.showComparison}
                onChange={v => update({ showComparison: v })}
              />
              <Badge variant={aiAvailable ? 'success' : 'warning'}>
                {aiAvailable ? 'AI Provider Configured' : 'No AI Provider — configure in Transcription tab'}
              </Badge>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
