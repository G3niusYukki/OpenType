import { AudioCapture } from './audio-capture';
import { Store } from './store';

export interface AudioDevice {
  id: string;
  name: string;
  isDefault: boolean;
  isAvailable: boolean;
}

export interface DeviceSelectionResult {
  success: boolean;
  device?: AudioDevice;
  error?: string;
  fallbackToDefault?: boolean;
}

export class AudioDeviceManager {
  private audioCapture: AudioCapture;
  private store: Store;

  constructor(audioCapture: AudioCapture, store: Store) {
    this.audioCapture = audioCapture;
    this.store = store;
  }

  async getDevices(): Promise<AudioDevice[]> {
    const devices = await this.audioCapture.getAudioDevices();
    return devices.map((device, index) => ({
      id: device.index,
      name: device.name,
      isDefault: index === 0 || device.index === '0',
      isAvailable: true
    }));
  }

  async getSelectedDevice(): Promise<DeviceSelectionResult> {
    const devices = await this.getDevices();
    
    if (devices.length === 0) {
      return { success: false, error: 'No audio input devices found' };
    }

    const storedDevice = this.store.getAudioInputDevice();
    
    if (storedDevice) {
      const deviceExists = devices.find(d => d.id === storedDevice.index);
      
      if (deviceExists) {
        return { success: true, device: deviceExists };
      } else {
        const defaultDevice = devices.find(d => d.isDefault) || devices[0];
        return {
          success: true,
          device: defaultDevice,
          fallbackToDefault: true,
          error: `Previously selected device "${storedDevice.name}" is no longer available`
        };
      }
    }

    const defaultDevice = devices.find(d => d.isDefault) || devices[0];
    return { success: true, device: defaultDevice };
  }

  async selectDevice(deviceId: string): Promise<DeviceSelectionResult> {
    const devices = await this.getDevices();
    const device = devices.find(d => d.id === deviceId);
    
    if (!device) {
      return { success: false, error: `Device with ID ${deviceId} not found` };
    }

    this.store.setAudioInputDevice({
      index: device.id,
      name: device.name,
      selectedAt: Date.now()
    });

    return { success: true, device };
  }

  async validateDevice(deviceId: string): Promise<boolean> {
    const devices = await this.getDevices();
    return devices.some(d => d.id === deviceId);
  }

  getFfmpegDeviceString(device: AudioDevice): string {
    return `:${device.id}`;
  }

  async getCurrentFfmpegDeviceString(): Promise<string> {
    const result = await this.getSelectedDevice();
    if (!result.success || !result.device) {
      return ':0';
    }
    return this.getFfmpegDeviceString(result.device);
  }
}
