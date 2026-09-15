import bcrypt from 'bcryptjs';

export const USERS_STORAGE_KEY = 'stockinsights_users_v1';

const DEFAULT_USERS = [
  {
    username: 'yoga',
    passwordHash: '$2b$10$sZHDgy1I/Uf/Dz5ZWHFv4ObhuyRKP7eBkr5Up95MWfnR81n1neKQa',
    role: 'admin'
  },
  {
    username: 'user',
    passwordHash: '$2b$10$ODpe0wtXYJCY2whMi4ceruUmE303S5RircXAJ6OT/58f4n4gPZlgi',
    role: 'viewer'
  },
  {
    username: 'rajendra',
    // Password: Rajendra@2026 (share privately — never commit plaintext)
    passwordHash: '$2b$10$10/xkKTsczv81UXALPFJMeJQAKXn1qCVEKJqODtcbrkFLczpVgfMi',
    role: 'viewer'
  }
];

const sanitizeUsers = (list) => {
  if (!Array.isArray(list)) return null;
  const clean = list.filter(
    (u) =>
      u &&
      typeof u.username === 'string' &&
      typeof u.passwordHash === 'string' &&
      (u.role === 'admin' || u.role === 'viewer')
  );
  return clean.length > 0 ? clean : null;
};

const normalizeName = (name) => (name || '').trim().toLowerCase();

const loadCustomUsers = () => {
  try {
    return sanitizeUsers(JSON.parse(localStorage.getItem(USERS_STORAGE_KEY) || 'null'));
  } catch {
    return null;
  }
};

const persistCustomUsers = (users) => {
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
};

export const listUsers = () => loadCustomUsers() || [...DEFAULT_USERS];

export const getAllUsers = () => listUsers().map(({ passwordHash, ...rest }) => rest);

const mergedUsers = () => {
  const custom = loadCustomUsers();
  if (!custom) return [...DEFAULT_USERS];
  // Admin-added users override / extend the built-in defaults by username.
  const byName = new Map(DEFAULT_USERS.map((u) => [normalizeName(u.username), { ...u }]));
  custom.forEach((u) => byName.set(normalizeName(u.username), { ...u }));
  return [...byName.values()];
};

const SESSION_KEY = 'metro_cash_login';
const ROLE_KEY = 'metro_cash_role';
const USER_KEY = 'metro_cash_user';

export const login = (username, password) => {
  const user = mergedUsers().find((u) => normalizeName(u.username) === normalizeName(username));
  if (!user) {
    return { success: false, error: 'Invalid username or password' };
  }

  const match = bcrypt.compareSync(password, user.passwordHash);
  if (!match) {
    return { success: false, error: 'Invalid username or password' };
  }

  sessionStorage.setItem(SESSION_KEY, 'true');
  sessionStorage.setItem(ROLE_KEY, user.role);
  sessionStorage.setItem(USER_KEY, user.username);
  return { success: true, role: user.role, username: user.username };
};

export const logout = () => {
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(ROLE_KEY);
  sessionStorage.removeItem(USER_KEY);
};

export const isLoggedIn = () => {
  return sessionStorage.getItem(SESSION_KEY) === 'true';
};

export const getUserRole = () => {
  return sessionStorage.getItem(ROLE_KEY) || 'viewer';
};

export const getUsername = () => {
  return sessionStorage.getItem(USER_KEY) || '';
};

export const createUser = (username, password, role = 'viewer') => {
  const cleanName = (username || '').trim();
  if (!cleanName) return { success: false, error: 'Username is required' };
  if (!password || password.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters' };
  }
  if (role !== 'admin' && role !== 'viewer') {
    return { success: false, error: 'Invalid role' };
  }
  const users = mergedUsers();
  if (users.some((u) => normalizeName(u.username) === normalizeName(cleanName))) {
    return { success: false, error: 'Username already exists' };
  }
  const next = [
    ...(loadCustomUsers() || []),
    { username: cleanName, passwordHash: bcrypt.hashSync(password, 10), role },
  ];
  persistCustomUsers(next);
  return { success: true };
};

export const resetUserPassword = (username, newPassword) => {
  if (!newPassword || newPassword.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters' };
  }
  const current = mergedUsers();
  const target = current.find((u) => normalizeName(u.username) === normalizeName(username));
  if (!target) return { success: false, error: 'User not found' };
  const custom = current.map((u) =>
    normalizeName(u.username) === normalizeName(username)
      ? { ...u, passwordHash: bcrypt.hashSync(newPassword, 10) }
      : u
  );
  persistCustomUsers(custom);
  return { success: true };
};

export const deleteUser = (username, currentUsername) => {
  if (normalizeName(username) === normalizeName(currentUsername)) {
    return { success: false, error: 'You cannot delete the account you are logged in with' };
  }
  const adminCount = mergedUsers().filter((u) => u.role === 'admin').length;
  const target = mergedUsers().find((u) => normalizeName(u.username) === normalizeName(username));
  if (!target) return { success: false, error: 'User not found' };
  if (target.role === 'admin' && adminCount <= 1) {
    return { success: false, error: 'Cannot delete the last admin account' };
  }
  persistCustomUsers(
    mergedUsers().filter((u) => normalizeName(u.username) !== normalizeName(username))
  );
  return { success: true };
};

export const resetUsersToDefaults = () => {
  localStorage.removeItem(USERS_STORAGE_KEY);
};
