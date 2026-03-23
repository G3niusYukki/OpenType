import { useState } from 'react';
import { CheckCircle } from 'lucide-react';
import { Button } from '../ui';
import styles from './OnboardingWizard.module.css';

const STEPS = [
  {
    label: 'STEP 1',
    title: 'Microphone Permission',
    description: 'OpenType needs microphone access to record your voice. Please grant permission in System Settings.',
    hint: 'System Settings → Privacy & Security → Microphone → Enable OpenType',
    action: 'open-microphone' as const,
  },
  {
    label: 'STEP 2',
    title: 'Accessibility Permission',
    description: 'OpenType needs accessibility access for global hotkeys and text insertion.',
    hint: 'System Settings → Privacy & Security → Accessibility → Enable OpenType',
    action: 'open-accessibility' as const,
  },
  {
    label: 'STEP 3',
    title: 'Transcription Provider',
    description: 'Choose how OpenType transcribes your voice. Local mode is free and offline.',
    action: 'select-provider' as const,
  },
  {
    label: 'STEP 4',
    title: 'Ready to Dictate',
    description: "You're all set! Press ⌘⇧D anywhere to start dictating.",
    action: 'done' as const,
  },
];

export function OnboardingWizard({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const [selectedProvider, setSelectedProvider] = useState<'local' | 'cloud' | 'auto'>('auto');

  const current = STEPS[step];

  const handleNext = async () => {
    if (current.action === 'open-microphone') {
      await window.electronAPI.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone');
      setStep(1);
    } else if (current.action === 'open-accessibility') {
      await window.electronAPI.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility');
      setStep(2);
    } else if (current.action === 'select-provider') {
      await window.electronAPI.storeSet('preferredProvider', selectedProvider);
      setStep(3);
    } else if (current.action === 'done') {
      localStorage.setItem('onboardingCompleted', 'true');
      onComplete();
    }
  };

  const handleSkip = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
  };

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="OpenType setup wizard">
      <div className={styles.container}>
        {/* Progress bar */}
        <div className={styles.progress}>
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`${styles.progressStep} ${i <= step ? styles.done : ''}`}
            />
          ))}
        </div>

        {/* Step label */}
        <div className={styles.stepLabel}>{current.label}</div>

        {/* Step content */}
        {current.action === 'select-provider' ? (
          <>
            <h2 className={styles.title}>{current.title}</h2>
            <p className={styles.description}>{current.description}</p>
            <div className={styles.providerGrid}>
              {[
                { id: 'auto', name: 'Auto', desc: 'Local first, fallback to cloud' },
                { id: 'local', name: 'Local', desc: 'Free & offline (whisper.cpp)' },
                { id: 'cloud', name: 'Cloud', desc: 'Online API (requires key)' },
              ].map(p => (
                <button
                  key={p.id}
                  className={`${styles.providerCard} ${selectedProvider === p.id ? styles.selected : ''}`}
                  onClick={() => setSelectedProvider(p.id as any)}
                >
                  <div className={styles.providerName}>{p.name}</div>
                  <div className={styles.providerDesc}>{p.desc}</div>
                </button>
              ))}
            </div>
          </>
        ) : current.action === 'done' ? (
          <>
            <div className={styles.successIcon}>
              <CheckCircle size={28} color="var(--color-success)" />
            </div>
            <h2 className={styles.title}>{current.title}</h2>
            <p className={styles.description}>{current.description}</p>
          </>
        ) : (
          <>
            <h2 className={styles.title}>{current.title}</h2>
            <p className={styles.description}>{current.description}</p>
            {current.hint && <div className={styles.hint}>{current.hint}</div>}
          </>
        )}

        {/* Actions */}
        <div className={styles.actions}>
          <Button variant="ghost" onClick={handleSkip}>
            {step < STEPS.length - 1 ? 'Skip for now' : ''}
          </Button>
          <Button variant="primary" onClick={handleNext}>
            {current.action === 'open-microphone' || current.action === 'open-accessibility'
              ? 'Open System Settings'
              : current.action === 'done'
              ? "Let's go!"
              : 'Continue'}
          </Button>
        </div>
      </div>
    </div>
  );
}
