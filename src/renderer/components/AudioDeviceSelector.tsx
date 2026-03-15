import { useState, useEffect } from 'react';
import { Mic, Check, Loader2 } from 'lucide-react';

interface AudioDevice {
  index: string;
  name: string;
}

interface AudioInputDevice {
  index: string;
  name: string;
  selectedAt: number;
}

interface AudioDeviceSelectorProps {
  onSave?: () => void;
}

export function AudioDeviceSelector({ onSave }: AudioDeviceSelectorProps) {
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<AudioInputDevice | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadDevices();
  }, []);

  const loadDevices = async () => {
    try {
      const [deviceList, savedDevice] = await Promise.all([
        window.electronAPI.audioGetDevices(),
        window.electronAPI.audioGetSelectedDevice(),
      ]);
      setDevices(deviceList);
      setSelectedDevice(savedDevice || null);
    } catch (error) {
      console.error('Failed to load audio devices:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeviceSelect = async (deviceIndex: string) => {
    const device = devices.find(d => d.index === deviceIndex);
    if (!device) return;

    setSaving(true);
    try {
      const deviceData: AudioInputDevice = {
        index: device.index,
        name: device.name,
        selectedAt: Date.now(),
      };
      await window.electronAPI.audioSetSelectedDevice(deviceData);
      setSelectedDevice(deviceData);
      onSave?.();
    } catch (error) {
      console.error('Failed to save audio device:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleUseDefault = async () => {
    setSaving(true);
    try {
      await window.electronAPI.audioSetSelectedDevice({
        index: '0',
        name: 'Default Device',
        selectedAt: Date.now(),
      });
      setSelectedDevice({
        index: '0',
        name: 'Default Device',
        selectedAt: Date.now(),
      });
      onSave?.();
    } catch (error) {
      console.error('Failed to set default device:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        padding: '16px',
        background: '#161616',
        border: '1px solid #222',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        color: '#666',
      }}>
        <Loader2 size={18} className="animate-spin" />
        <span>Loading audio devices...</span>
      </div>
    );
  }

  if (devices.length === 0) {
    return (
      <div style={{
        padding: '16px',
        background: 'rgba(239, 68, 68, 0.1)',
        border: '1px solid rgba(239, 68, 68, 0.2)',
        borderRadius: '8px',
        color: '#ef4444',
        fontSize: '13px',
      }}>
        No audio input devices found. Please check your microphone connection.
      </div>
    );
  }

  return (
    <div style={{
      background: '#161616',
      border: '1px solid #222',
      borderRadius: '8px',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid #222',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        color: '#888',
        fontSize: '13px',
      }}>
        <Mic size={16} />
        Audio Input Device
      </div>

      <div style={{ padding: '8px' }}>
        {/* Default option */}
        <button
          onClick={handleUseDefault}
          disabled={saving}
          style={{
            width: '100%',
            padding: '12px 16px',
            background: selectedDevice?.index === '0' ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
            border: 'none',
            borderRadius: '6px',
            textAlign: 'left',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            color: selectedDevice?.index === '0' ? '#6366f1' : '#ccc',
            fontSize: '14px',
            fontWeight: selectedDevice?.index === '0' ? 500 : 400,
          }}
        >
          <span>Default Device (System Default)</span>
          {selectedDevice?.index === '0' && <Check size={16} />}
        </button>

        {/* Device list */}
        {devices.map((device) => (
          <button
            key={device.index}
            onClick={() => handleDeviceSelect(device.index)}
            disabled={saving}
            style={{
              width: '100%',
              padding: '12px 16px',
              background: selectedDevice?.index === device.index ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
              border: 'none',
              borderRadius: '6px',
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: selectedDevice?.index === device.index ? '#6366f1' : '#ccc',
              fontSize: '14px',
              fontWeight: selectedDevice?.index === device.index ? 500 : 400,
            }}
          >
            <span>{device.name}</span>
            {selectedDevice?.index === device.index && <Check size={16} />}
          </button>
        ))}
      </div>

      {selectedDevice && (
        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid #222',
          background: 'rgba(34, 197, 94, 0.05)',
          color: '#22c55e',
          fontSize: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <Check size={14} />
          Using: {selectedDevice.name}
        </div>
      )}
    </div>
  );
}
