// AI Office — local server (หลายโปรเจกต์ = หลายห้อง)
// รัน: node .office/server.js   แล้วเปิด http://localhost:3010
// รายชื่อห้องอยู่ใน .office/projects.json
// ไม่มี dependency เพิ่ม อ่านอย่างเดียวจาก <โปรเจกต์>/.review/, git log และ <โปรเจกต์>/.office/status/*.json
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const PORT = Number(process.env.OFFICE_PORT || 3010);
// projects.json = โปรเจกต์จริงของคุณ (ไม่ขึ้น git) · ถ้าไม่มี จะใช้ projects.example.json (เดโม)
const PROJECTS_FILE = process.env.OFFICE_PROJECTS || (fs.existsSync(path.join(__dirname, 'projects.json')) ? path.join(__dirname, 'projects.json') : path.join(__dirname, 'projects.example.json'));
function loadProjects() {
  let list = [];
  try { list = JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf8').replace(/^\uFEFF/, '')); } catch {}
  if (!Array.isArray(list) || !list.length) list = [{ id: 'main', name: path.basename(path.resolve(__dirname, '..')), root: '..' }];
  return list.map(p => ({ id: String(p.id), name: String(p.name || p.id), theme: p.theme ? String(p.theme) : '', short: p.short ? String(p.short) : '', demo: !!p.demo, root: path.resolve(__dirname, p.root || '..') }));
}
const STALE_MIN = 20; // ไม่อัปเดตเกินกี่นาทีถือว่าว่าง

function readText(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
function mtime(p) { try { return fs.statSync(p).mtimeMs; } catch { return 0; } }

function parseTasks(md) {
  const tasks = [];
  const re = /^##\s*(TASK-\d+)\s*(?:\[([^\]]+)\])?\s*(.*?)\s*[—–-]+\s*สถานะ\s*:\s*(.+)$/;
  const lines = md.split(/\r?\n/);
  let cur = null;
  for (const line of lines) {
    const m = line.match(re);
    if (m) {
      const raw = m[4].trim();
      const st = raw.toUpperCase();
      let status = 'TODO';
      for (const s of ['IN PROGRESS', 'IN REVIEW', 'DONE', 'BLOCKED', 'DEFERRED', 'TODO']) if (st.startsWith(s)) { status = s; break; }
      const note = (raw.match(/\(([^)]*)\)/) || [])[1] || '';
      cur = { id: m[1], priority: (m[2] || '').trim(), title: m[3].trim(), status, note, owner: '' };
      tasks.push(cur);
    } else if (cur) {
      if (/^#{1,2}\s/.test(line) || /^-{10,}/.test(line)) { cur = null; continue; }
      const o = line.match(/ผู้รับผิดชอบ\s*:\s*(\w+)/i);
      if (o && !cur.owner) cur.owner = o[1].toLowerCase();
    }
  }
  return tasks;
}
function field(md, label) {
  const m = md.match(new RegExp('^##\\s*' + label + '\\s*:\\s*(.+)$', 'm'));
  return m ? m[1].trim() : '';
}
function parseReview(md) {
  const head = md.match(/^#\s*REVIEW\s*[—–-]\s*(.+?)(?:\(|$)/m);
  return { time: head ? head[1].trim() : '', round: field(md, 'รอบที่ตรวจ'), verdict: field(md, 'ผลตรวจ') };
}
function parseHandoff(md) {
  const head = md.match(/^#\s*HANDOFF\s*[—–-]\s*(.+)$/m);
  return { time: head ? head[1].trim() : '', task: field(md, 'งาน'), status: field(md, 'สถานะ'), commit: field(md, 'Commit') };
}
function readAgents(STATUS_DIR, demo) {
  const out = {};
  let files = [];
  try { files = fs.readdirSync(STATUS_DIR).filter(f => f.endsWith('.json')); } catch { return out; }
  for (const f of files) {
    const p = path.join(STATUS_DIR, f);
    try {
      const j = JSON.parse(readText(p).replace(/^﻿/, ''));
      const id = String(j.agent || path.basename(f, '.json')).toLowerCase();
      const fileTime = mtime(p);
      const upd = demo ? Date.now() - 60000 : (Date.parse(j.updated || '') || fileTime); // เดโม: ไม่หมดอายุ
      const ageMin = (Date.now() - Math.max(upd, 0)) / 60000;
      let state = String(j.state || 'idle').toLowerCase();
      const stale = state !== 'idle' && state !== 'blocked' && ageMin > STALE_MIN;
      out[id] = { ...j, agent: id, state: stale ? 'idle' : state, stale, updatedMs: upd, ageMin: Math.round(ageMin) };
    } catch (e) {
      out[path.basename(f, '.json')] = { agent: path.basename(f, '.json'), state: 'idle', error: 'อ่าน JSON ไม่ได้: ' + e.message };
    }
  }
  return out;
}
function gitLog(ROOT) {
  return new Promise(resolve => {
    execFile('git', ['log', '-20', '--pretty=format:%h|%ad|%an|%s', '--date=iso-strict'], { cwd: ROOT, windowsHide: true, timeout: 5000 }, (err, stdout) => {
      if (err) return resolve([]);
      resolve(stdout.split(/\r?\n/).filter(Boolean).map(l => { const [hash, date, author, ...rest] = l.split('|'); return { hash, date, author, subject: rest.join('|') }; }));
    });
  });
}

async function state(proj) {
  const ROOT = proj.root, REVIEW_DIR = path.join(ROOT, '.review'), STATUS_DIR = path.join(ROOT, '.office', 'status');
  const testPath = path.join(REVIEW_DIR, 'TEST_REPORT.md');
  const testMd = readText(testPath);
  const tasksPath = path.join(REVIEW_DIR, 'TASKS.md'), reviewPath = path.join(REVIEW_DIR, 'REVIEW.md'), handoffPath = path.join(REVIEW_DIR, 'HANDOFF.md');
  return {
    now: Date.now(),
    project: proj.name,
    projectId: proj.id,
    test: { task: field(testMd, 'งาน'), result: field(testMd, 'ผล'), mtime: mtime(testPath) },
    tasks: parseTasks(readText(tasksPath)),
    review: { ...parseReview(readText(reviewPath)), mtime: mtime(reviewPath) },
    handoff: { ...parseHandoff(readText(handoffPath)), mtime: mtime(handoffPath) },
    tasksMtime: mtime(tasksPath),
    agents: readAgents(STATUS_DIR, proj.demo),
    commits: await gitLog(ROOT),
  };
}

const server = http.createServer(async (req, res) => {
  try {
    const [url, qs] = req.url.split('?');
    const projects = loadProjects();
    if (url === '/api/projects') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(JSON.stringify(projects.map(p => ({ id: p.id, name: p.name, theme: p.theme, short: p.short }))));
    }
    if (url === '/api/state') {
      const want = new URLSearchParams(qs || '').get('p');
      const proj = projects.find(p => p.id === want) || projects[0];
      const body = JSON.stringify(await state(proj));
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(body);
    }
    if (url === '/' || url === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(readText(path.join(__dirname, 'office.html')));
    }
    res.writeHead(404); res.end('not found');
  } catch (e) { res.writeHead(500); res.end(String(e && e.message)); }
});
server.listen(PORT, '127.0.0.1', () => console.log(`AI Office พร้อมแล้ว → http://localhost:${PORT}  ห้อง: ${loadProjects().map(p => p.name + ' (' + p.root + ')').join(', ')}`));
