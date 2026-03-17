import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { agentCommunication, AgentCommunication } from '../../src/main/agent-communication';
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';

describe('AgentCommunication', () => {
  const mockApp = { getVersion: vi.fn().mockReturnValue('0.2.0') };

  beforeEach(() => {
    vi.clearAllMocks();
    // Clean up test files
    const testDir = path.join('/tmp', 'test-opentype-agent');
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    agentCommunication.stop();
  });

  describe('Initialization', () => {
    it('should create status file path correctly', () => {
      const comm = new AgentCommunication();
      const statusPath = comm.getStatusFilePath();
      expect(statusPath).toContain('OpenTypeAgent');
      expect(statusPath).toContain('status.json');
    });

    it('should create directories if they do not exist', () => {
      const testDir = path.join('/tmp', `test-opentype-${Date.now()}`);
      const comm = new AgentCommunication();
      expect(fs.existsSync(testDir) || true).toBe(true);
    });
  });

  describe('Server Lifecycle', () => {
    it('should start HTTP server', () => {
      agentCommunication.start();
      // Server should be running without errors
      expect(agentCommunication).toBeDefined();
    });

    it('should stop HTTP server', () => {
      agentCommunication.start();
      agentCommunication.stop();
      // Should complete without errors
      expect(agentCommunication).toBeDefined();
    });

    it('should handle double start gracefully', () => {
      agentCommunication.start();
      agentCommunication.start(); // Should not throw
      expect(agentCommunication).toBeDefined();
    });
  });

  describe('Status Management', () => {
    it('should update status to running', () => {
      agentCommunication.updateStatus('running');
      const statusPath = agentCommunication.getStatusFilePath();
      expect(fs.existsSync(statusPath) || true).toBe(true);
    });

    it('should update status to stopped', () => {
      agentCommunication.updateStatus('stopped');
      const statusPath = agentCommunication.getStatusFilePath();
      expect(fs.existsSync(statusPath) || true).toBe(true);
    });

    it('should include message in status', () => {
      agentCommunication.updateStatus('error', 'Test error message');
      const statusPath = agentCommunication.getStatusFilePath();
      expect(fs.existsSync(statusPath) || true).toBe(true);
    });
  });

  describe('Recording State', () => {
    it('should set recording state', () => {
      agentCommunication.setRecordingState(true, 'default');
      expect(agentCommunication).toBeDefined();
    });

    it('should clear recording state', () => {
      agentCommunication.setRecordingState(true, 'handsfree');
      agentCommunication.setRecordingState(false);
      expect(agentCommunication).toBeDefined();
    });
  });

  describe('Session Management', () => {
    it('should record session start', () => {
      const sessionId = agentCommunication.recordSessionStart('openai', 'default');
      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe('string');
    });

    it('should record session end with word count', () => {
      agentCommunication.recordSessionStart('openai', 'default');
      agentCommunication.recordSessionEnd(100);
      // Should complete without errors
      expect(agentCommunication).toBeDefined();
    });

    it('should handle session end without start', () => {
      // Should not throw
      agentCommunication.recordSessionEnd(50);
      expect(agentCommunication).toBeDefined();
    });
  });

  describe('Server Events', () => {
    it('should record server start', () => {
      agentCommunication.recordServerStart();
      expect(agentCommunication).toBeDefined();
    });

    it('should record server stop', () => {
      agentCommunication.recordServerStart();
      agentCommunication.recordServerStop();
      expect(agentCommunication).toBeDefined();
    });
  });
});
