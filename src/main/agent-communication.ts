/**
 * Agent Communication Module
 * Provides HTTP endpoint for the menu bar agent to communicate with OpenType
 */

import { app } from 'electron';
import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';

const AGENT_HTTP_PORT = 37421; // "Type" on phone keypad + 1 for Electron
const STATUS_FILE_NAME = 'status.json';

interface ServerStatus {
  status: 'stopped' | 'starting' | 'running' | 'stopping' | 'error';
  pid: number;
  version: string;
  uptime: number;
  recording: boolean;
  recordingMode?: string;
  timestamp: string;
}

interface SessionEvent {
  type: 'session_start' | 'session_end';
  sessionId?: string;
  timestamp: string;
  duration?: number;
  wordCount?: number;
  provider?: string;
  mode?: string;
}

export class AgentCommunication {
  private server: http.Server | null = null;
  private statusFilePath: string;
  private startTime: number = Date.now();
  private currentSession: { id: string; startTime: number; provider?: string; mode?: string } | null = null;
  private isRecording: boolean = false;
  private recordingMode: string = 'default';

  constructor() {
    const agentSupportDir = path.join(os.homedir(), 'Library', 'Application Support', 'OpenTypeAgent');
    this.statusFilePath = path.join(agentSupportDir, STATUS_FILE_NAME);

    // Ensure directory exists
    if (!fs.existsSync(agentSupportDir)) {
      fs.mkdirSync(agentSupportDir, { recursive: true });
    }
  }

  /**
   * Start the HTTP server for agent communication
   */
  start(): void {
    if (this.server) {
      return;
    }

    this.server = http.createServer((req, res) => {
      // Enable CORS for local requests
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      const url = req.url || '/';
      const method = req.method || 'GET';

      try {
        if (url === '/status' && method === 'GET') {
          this.handleGetStatus(res);
        } else if (url === '/session/start' && method === 'POST') {
          this.handleSessionStart(req, res);
        } else if (url === '/session/end' && method === 'POST') {
          this.handleSessionEnd(req, res);
        } else if (url === '/health' && method === 'GET') {
          this.handleHealth(res);
        } else {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Not found' }));
        }
      } catch (error) {
        console.error('[AgentComm] Error handling request:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
      }
    });

    this.server.listen(AGENT_HTTP_PORT, '127.0.0.1', () => {
      console.log(`[AgentComm] HTTP server listening on port ${AGENT_HTTP_PORT}`);
    });

    this.server.on('error', (err) => {
      console.error('[AgentComm] Server error:', err);
    });

    // Write initial status
    this.updateStatus('running');
  }

  /**
   * Stop the HTTP server
   */
  stop(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
    this.updateStatus('stopped');
  }

  /**
   * Update the server status
   */
  updateStatus(status: ServerStatus['status'], message?: string): void {
    const statusData: ServerStatus = {
      status,
      pid: process.pid,
      version: app.getVersion(),
      uptime: Date.now() - this.startTime,
      recording: this.isRecording,
      recordingMode: this.recordingMode,
      timestamp: new Date().toISOString(),
    };

    // Write to file for file-based communication fallback
    try {
      fs.writeFileSync(this.statusFilePath, JSON.stringify(statusData, null, 2));
    } catch (err) {
      console.error('[AgentComm] Failed to write status file:', err);
    }

    // Store message separately if provided
    if (message) {
      try {
        const messagePath = this.statusFilePath.replace('.json', '_message.txt');
        fs.writeFileSync(messagePath, message);
      } catch (err) {
        // Ignore errors
      }
    }
  }

  /**
   * Set recording state
   */
  setRecordingState(isRecording: boolean, mode: string = 'default'): void {
    this.isRecording = isRecording;
    this.recordingMode = mode;
    this.updateStatus('running');
  }

  /**
   * Record session start
   */
  recordSessionStart(provider?: string, mode?: string): string {
    const sessionId = `session_${Date.now()}`;
    this.currentSession = {
      id: sessionId,
      startTime: Date.now(),
      provider,
      mode,
    };

    const event: SessionEvent = {
      type: 'session_start',
      sessionId,
      timestamp: new Date().toISOString(),
      provider,
      mode,
    };

    this.appendSessionEvent(event);
    return sessionId;
  }

  /**
   * Record session end
   */
  recordSessionEnd(wordCount: number = 0): void {
    if (!this.currentSession) {
      return;
    }

    const duration = Math.floor((Date.now() - this.currentSession.startTime) / 1000);

    const event: SessionEvent = {
      type: 'session_end',
      sessionId: this.currentSession.id,
      timestamp: new Date().toISOString(),
      duration,
      wordCount,
      provider: this.currentSession.provider,
      mode: this.currentSession.mode,
    };

    this.appendSessionEvent(event);
    this.currentSession = null;
  }

  /**
   * Record server start event
   */
  recordServerStart(): void {
    const event: SessionEvent = {
      type: 'session_start',
      sessionId: 'server_' + Date.now(),
      timestamp: new Date().toISOString(),
    };
    this.appendSessionEvent(event);
  }

  /**
   * Record server stop event
   */
  recordServerStop(): void {
    const event: SessionEvent = {
      type: 'session_end',
      sessionId: 'server_' + Date.now(),
      timestamp: new Date().toISOString(),
    };
    this.appendSessionEvent(event);
  }

  /**
   * Handle GET /status
   */
  private handleGetStatus(res: http.ServerResponse): void {
    const statusData: ServerStatus = {
      status: 'running',
      pid: process.pid,
      version: app.getVersion(),
      uptime: Date.now() - this.startTime,
      recording: this.isRecording,
      recordingMode: this.recordingMode,
      timestamp: new Date().toISOString(),
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(statusData));
  }

  /**
   * Handle POST /session/start
   */
  private handleSessionStart(req: http.IncomingMessage, res: http.ServerResponse): void {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const sessionId = this.recordSessionStart(data.provider, data.mode);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, sessionId }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
  }

  /**
   * Handle POST /session/end
   */
  private handleSessionEnd(req: http.IncomingMessage, res: http.ServerResponse): void {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        this.recordSessionEnd(data.wordCount);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
  }

  /**
   * Handle GET /health
   */
  private handleHealth(res: http.ServerResponse): void {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      pid: process.pid,
      uptime: Date.now() - this.startTime,
    }));
  }

  /**
   * Append session event to log file
   */
  private appendSessionEvent(event: SessionEvent): void {
    try {
      const logPath = this.statusFilePath.replace('status.json', 'sessions.log');
      const line = JSON.stringify(event) + '\n';
      fs.appendFileSync(logPath, line);
    } catch (err) {
      console.error('[AgentComm] Failed to append session event:', err);
    }
  }

  /**
   * Get the status file path for external use
   */
  getStatusFilePath(): string {
    return this.statusFilePath;
  }
}

// Export singleton instance
export const agentCommunication = new AgentCommunication();
