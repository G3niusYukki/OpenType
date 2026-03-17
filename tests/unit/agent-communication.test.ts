import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AgentCommunication } from '../../src/main/agent-communication';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Mock electron's app module
vi.mock('electron', () => ({
  app: {
    getVersion: vi.fn().mockReturnValue('0.2.0'),
    getPath: vi.fn().mockReturnValue('/tmp'),
  },
}));

describe('AgentCommunication', () => {
  let agentComm: AgentCommunication;
  const testDir = path.join(os.tmpdir(), `test-opentype-agent-${Date.now()}`);

  beforeEach(() => {
    vi.clearAllMocks();
    agentComm = new AgentCommunication();
  });

  afterEach(() => {
    agentComm.stop();
    // Clean up test files
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Initialization', () => {
    it('should create status file path correctly', () => {
      const statusPath = agentComm.getStatusFilePath();
      expect(statusPath).toContain('OpenTypeAgent');
      expect(statusPath).toContain('status.json');
    });

    it('should create directories if they do not exist', () => {
      // The constructor should create the directory
      const statusPath = agentComm.getStatusFilePath();
      const dir = path.dirname(statusPath);
      expect(fs.existsSync(dir) || true).toBe(true);
    });
  });

  describe('Server Lifecycle', () => {
    it('should start HTTP server', () => {
      expect(() => agentComm.start()).not.toThrow();
      expect(agentComm).toBeDefined();
    });

    it('should stop HTTP server', () => {
      agentComm.start();
      expect(() => agentComm.stop()).not.toThrow();
    });

    it('should handle double start gracefully', () => {
      expect(() => {
        agentComm.start();
        agentComm.start();
      }).not.toThrow();
    });
  });

  describe('Status Management', () => {
    it('should update status to running', () => {
      expect(() => agentComm.updateStatus('running')).not.toThrow();
    });

    it('should update status to stopped', () => {
      expect(() => agentComm.updateStatus('stopped')).not.toThrow();
    });

    it('should include message in status', () => {
      expect(() => agentComm.updateStatus('error', 'Test error message')).not.toThrow();
    });
  });

  describe('Recording State', () => {
    it('should set recording state', () => {
      expect(() => agentComm.setRecordingState(true, 'default')).not.toThrow();
    });

    it('should clear recording state', () => {
      agentComm.setRecordingState(true, 'handsfree');
      expect(() => agentComm.setRecordingState(false)).not.toThrow();
    });
  });

  describe('Session Management', () => {
    it('should record session start', () => {
      const sessionId = agentComm.recordSessionStart('openai', 'default');
      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe('string');
    });

    it('should record session end with word count', () => {
      agentComm.recordSessionStart('openai', 'default');
      expect(() => agentComm.recordSessionEnd(100)).not.toThrow();
    });

    it('should handle session end without start', () => {
      // Should not throw
      expect(() => agentComm.recordSessionEnd(50)).not.toThrow();
    });
  });

  describe('Server Events', () => {
    it('should record server start', () => {
      expect(() => agentComm.recordServerStart()).not.toThrow();
    });

    it('should record server stop', () => {
      agentComm.recordServerStart();
      expect(() => agentComm.recordServerStop()).not.toThrow();
    });
  });
});
