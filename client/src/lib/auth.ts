// ── Client-side auth (localStorage) ─────────────────────────────────────────────
// This is access-control UX, NOT real security — like the rest of the app, all
// data lives in the browser. Passwords are bcrypt-hashed in localStorage (never
// stored in plaintext) and the role gates nav/routes/costs. A determined user
// with devtools can bypass it; for true enforcement you'd need a backend.

import bcrypt from 'bcryptjs';
import { pushTable } from './db';
import type { AuthUser, UserRole } from '../types';

const USERS_KEY = 'packflow_auth_users';
const SESSION_KEY = 'packflow_session';
const ROUNDS = 8; // keep low — bcrypt runs in the browser

export interface StoredUser {
  id: string;
  name: string;
  username: string;
  role: UserRole;
  passwordHash: string;
  active: boolean;
  createdAt: string;
}

function readUsers(): StoredUser[] {
  try { const raw = localStorage.getItem(USERS_KEY); return raw ? JSON.parse(raw) : []; }
  catch { return []; }
}
// Accounts are shared: mirror to localStorage and push to the server so logins
// work across devices. (`auth_users` == USERS_KEY without the prefix.)
function writeUsers(u: StoredUser[]): void {
  localStorage.setItem(USERS_KEY, JSON.stringify(u));
  pushTable('auth_users', u);
}
function genId(): string { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function toAuthUser(u: StoredUser): AuthUser {
  return { id: u.id, name: u.name, username: u.username, role: u.role, active: u.active, createdAt: u.createdAt };
}

// Seed the hidden developer + a few demo logins on first load (idempotent).
// ⚠️ Client-side seed: these credentials ship in the browser. Change them in
// Users & Roles for any real use.
function ensureSeed(): void {
  if (readUsers().length > 0) return;
  const mk = (name: string, username: string, role: UserRole, password: string): StoredUser => ({
    id: genId(), name, username, role, passwordHash: bcrypt.hashSync(password, ROUNDS),
    active: true, createdAt: new Date().toISOString(),
  });
  writeUsers([
    mk('Aryan Bodkhe', 'aryanbodkhe', 'DEVELOPER', 'aryandeveloper'),
    mk('Rajesh Kumar', 'rajeshkumar', 'OWNER', 'rajeshkumarowner'),
    mk('Priya Sharma', 'priyasharma', 'MANAGER', 'priyasharmamanager'),
    mk('Amit Singh', 'amitsingh', 'STAFF', 'amitsinghstaff'),
  ]);
}

// ── Session ────────────────────────────────────────────────────────────────────
export function currentUser(): AuthUser | null {
  ensureSeed();
  const id = localStorage.getItem(SESSION_KEY);
  if (!id) return null;
  const u = readUsers().find((x) => x.id === id);
  if (!u || !u.active) { localStorage.removeItem(SESSION_KEY); return null; }
  return toAuthUser(u);
}

export function login(username: string, password: string): AuthUser {
  ensureSeed();
  const u = readUsers().find((x) => x.username === username.trim().toLowerCase());
  if (!u || !u.active || !bcrypt.compareSync(password, u.passwordHash)) {
    throw new Error('Invalid username or password');
  }
  localStorage.setItem(SESSION_KEY, u.id);
  return toAuthUser(u);
}

export function logout(): void { localStorage.removeItem(SESSION_KEY); }

// ── User management (Developer/Owner only — also guarded in the UI) ──────────────
export function listUsers(): AuthUser[] {
  ensureSeed();
  return readUsers()
    .filter((u) => u.role !== 'DEVELOPER')
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    .map(toAuthUser);
}

function generateUsername(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]/g, '') || 'user';
  const taken = new Set(readUsers().map((u) => u.username));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}${n}`)) n += 1;
  return `${base}${n}`;
}

export interface Credentials { username: string; password: string; }

export function createUser(name: string, role: UserRole, customPassword?: string): { user: AuthUser; credentials: Credentials } {
  if (role === 'DEVELOPER') throw new Error('Developer is not an assignable role');
  const username = generateUsername(name.trim());
  const password = customPassword && customPassword.length > 0 ? customPassword : `${username}${role.toLowerCase()}`;
  const u: StoredUser = {
    id: genId(), name: name.trim(), username, role,
    passwordHash: bcrypt.hashSync(password, ROUNDS), active: true, createdAt: new Date().toISOString(),
  };
  writeUsers([u, ...readUsers()]);
  return { user: toAuthUser(u), credentials: { username, password } };
}

export function updateUser(id: string, patch: { name?: string; role?: UserRole; active?: boolean; password?: string }): { user: AuthUser; credentials?: Credentials } {
  const users = readUsers();
  const u = users.find((x) => x.id === id);
  if (!u || u.role === 'DEVELOPER') throw new Error('User not found');
  if (patch.role === 'DEVELOPER') throw new Error('Developer is not an assignable role');
  if (patch.name !== undefined) u.name = patch.name.trim();
  if (patch.role !== undefined) u.role = patch.role;
  if (patch.active !== undefined) u.active = patch.active;
  let credentials: Credentials | undefined;
  if (patch.password) { u.passwordHash = bcrypt.hashSync(patch.password, ROUNDS); credentials = { username: u.username, password: patch.password }; }
  writeUsers(users);
  // Deactivating the logged-in user ends their session.
  if (u.active === false && localStorage.getItem(SESSION_KEY) === id) logout();
  return { user: toAuthUser(u), credentials };
}

export function deleteUser(id: string): void {
  const users = readUsers();
  const u = users.find((x) => x.id === id);
  if (!u || u.role === 'DEVELOPER') throw new Error('User not found');
  writeUsers(users.filter((x) => x.id !== id));
  if (localStorage.getItem(SESSION_KEY) === id) logout();
}
