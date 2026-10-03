import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

const statePath = path.join(config.paths.sessionsRoot, 'bot-state.json');

function readState() {
  try {
    if (!fs.existsSync(statePath)) return { running: false };
    const data = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    return {
      running: Boolean(data?.running),
      updatedAt: data?.updatedAt || null,
    };
  } catch {
    return { running: false };
  }
}

function writeState(running) {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  const payload = {
    running: Boolean(running),
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(statePath, JSON.stringify(payload, null, 2));
  return payload;
}

export function isBotRunning() {
  return readState().running;
}

export function startBot() {
  return writeState(true);
}

export function stopBot() {
  return writeState(false);
}

export function getBotState() {
  return readState();
}
