import { Store } from './store';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface DictationProfile {
  id: string;
  name: string;
  appIdentifiers: string[];
  settings: {
    language: string;
    preferredProvider: 'local' | 'cloud' | 'auto';
    aiPostProcessing: {
      enabled: boolean;
      providerId?: string;
      options: {
        removeFillerWords: boolean;
        removeRepetition: boolean;
        detectSelfCorrection: boolean;
      };
    };
    dictionary: string[];
  };
  isDefault: boolean;
}

export interface AppInfo {
  bundleId: string;
  name: string;
  processId: number;
}

export class ProfileManager {
  private store: Store;
  private currentProfile: DictationProfile | null = null;
  private lastAppBundleId: string | null = null;
  private checkInterval: NodeJS.Timeout | null = null;

  constructor(store: Store) {
    this.store = store;
  }

  startMonitoring(intervalMs: number = 2000): void {
    if (this.checkInterval) return;
    
    this.checkInterval = setInterval(() => {
      this.checkForegroundApp();
    }, intervalMs);
  }

  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  private async checkForegroundApp(): Promise<void> {
    try {
      const app = await this.getForegroundApp();
      if (!app) return;
      
      if (app.bundleId !== this.lastAppBundleId) {
        this.lastAppBundleId = app.bundleId;
        await this.applyProfileForApp(app);
      }
    } catch (error) {
      console.error('[ProfileManager] Failed to check foreground app:', error);
    }
  }

  private async getForegroundApp(): Promise<AppInfo | null> {
    if (process.platform !== 'darwin') return null;
    
    try {
      const script = `
        tell application "System Events"
          set frontApp to first application process whose frontmost is true
          set frontAppName to name of frontApp
          set frontAppId to bundle identifier of frontApp
          set frontAppPID to unix id of frontApp
          return frontAppName & "|" & frontAppId & "|" & frontAppPID
        end tell
      `;
      
      const { stdout } = await execAsync(`osascript -e '${script}'`);
      const [name, bundleId, processId] = stdout.trim().split('|');
      
      return {
        name,
        bundleId,
        processId: parseInt(processId, 10)
      };
    } catch (error) {
      console.error('[ProfileManager] Failed to get foreground app:', error);
      return null;
    }
  }

  private async applyProfileForApp(app: AppInfo): Promise<void> {
    const profile = await this.findProfileForApp(app);
    
    if (profile) {
      this.currentProfile = profile;
      console.log(`[ProfileManager] Applied profile "${profile.name}" for ${app.name}`);
    } else {
      this.currentProfile = null;
      console.log(`[ProfileManager] No profile found for ${app.name}, using defaults`);
    }
  }

  private async findProfileForApp(app: AppInfo): Promise<DictationProfile | null> {
    const profiles = await this.getProfiles();
    
    const matchingProfile = profiles.find(p => 
      p.appIdentifiers.some(id => 
        id === app.bundleId || 
        id.toLowerCase() === app.name.toLowerCase()
      )
    );
    
    if (matchingProfile) return matchingProfile;
    
    return profiles.find(p => p.isDefault) || null;
  }

  async getProfiles(): Promise<DictationProfile[]> {
    return this.store.getAny<DictationProfile[]>('profiles') || [];
  }

  async saveProfile(profile: DictationProfile): Promise<void> {
    const profiles = await this.getProfiles();
    const existingIndex = profiles.findIndex(p => p.id === profile.id);
    
    if (existingIndex >= 0) {
      profiles[existingIndex] = profile;
    } else {
      profiles.push(profile);
    }
    
    this.store.setAny('profiles', profiles);
  }

  async deleteProfile(profileId: string): Promise<void> {
    const profiles = await this.getProfiles();
    this.store.setAny('profiles', profiles.filter(p => p.id !== profileId));
  }

  getCurrentProfile(): DictationProfile | null {
    return this.currentProfile;
  }
}
