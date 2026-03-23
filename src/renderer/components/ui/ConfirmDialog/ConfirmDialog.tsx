import { useState } from 'react';
import { Modal } from '../Modal/Modal';
import { Button } from '../Button/Button';
import styles from './ConfirmDialog.module.css';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
  confirmRequired?: string;
}

export function ConfirmDialog({
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  danger = false,
  confirmRequired,
}: ConfirmDialogProps) {
  const [input, setInput] = useState('');

  const canConfirm = !confirmRequired || input === confirmRequired;

  return (
    <Modal title={title} onClose={onCancel} showClose={false} size="sm">
      <p className={styles.message}>{message}</p>
      {confirmRequired && (
        <div className={styles.confirmInput}>
          <p className={styles.confirmLabel}>
            Type <strong>{confirmRequired}</strong> to confirm:
          </p>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={confirmRequired}
            className={styles.input}
            autoFocus
          />
        </div>
      )}
      <div className={styles.actions}>
        <Button variant="secondary" onClick={onCancel}>
          {cancelText}
        </Button>
        <Button
          variant={danger ? 'danger' : 'primary'}
          onClick={onConfirm}
          disabled={!canConfirm}
        >
          {confirmText}
        </Button>
      </div>
    </Modal>
  );
}
