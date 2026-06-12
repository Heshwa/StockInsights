import bcrypt from 'bcryptjs';

const USERS = [
  {
    username: 'yoga',
    passwordHash: '$2b$10$sZHDgy1I/Uf/Dz5ZWHFv4ObhuyRKP7eBkr5Up95MWfnR81n1neKQa',
    role: 'admin'
  },
  {
    username: 'user',
    passwordHash: '$2b$10$ODpe0wtXYJCY2whMi4ceruUmE303S5RircXAJ6OT/58f4n4gPZlgi',
    role: 'viewer'
  }
];

const SESSION_KEY = 'metro_cash_login';
const ROLE_KEY = 'metro_cash_role';

export const login = (username, password) => {
  const user = USERS.find(u => u.username === username);
  if (!user) {
    return { success: false, error: 'Invalid username or password' };
  }
  
  const match = bcrypt.compareSync(password, user.passwordHash);
  if (!match) {
    return { success: false, error: 'Invalid username or password' };
  }

  sessionStorage.setItem(SESSION_KEY, 'true');
  sessionStorage.setItem(ROLE_KEY, user.role);
  return { success: true, role: user.role };
};

export const logout = () => {
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(ROLE_KEY);
};

export const isLoggedIn = () => {
  return sessionStorage.getItem(SESSION_KEY) === 'true';
};

export const getUserRole = () => {
  return sessionStorage.getItem(ROLE_KEY) || 'viewer';
};