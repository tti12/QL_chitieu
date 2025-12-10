require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'src')));

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';

// Simple file-based user store (demo only)
const dataDir = path.join(__dirname, 'data');
const usersFile = path.join(dataDir, 'users.json');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(usersFile)) fs.writeFileSync(usersFile, '[]', 'utf8');

function readUsers() {
    try { return JSON.parse(fs.readFileSync(usersFile, 'utf8') || '[]'); } catch (e) { return []; }
}
function writeUsers(users) { fs.writeFileSync(usersFile, JSON.stringify(users, null, 2), 'utf8'); }

// Helpers
function createToken(user) {
    const payload = { id: user.id, username: user.username, email: user.email, name: user.name };
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

function authenticateToken(req, res, next) {
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).json({ error: 'No token' });
    const token = auth.split(' ')[1];
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.user = payload;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid token' });
    }
}

// Routes
app.get('/', (req, res) => {
    res.send('Backend Node.js dang chay');
});

// Register
app.post('/auth/register', (req, res) => {
    const { username, password, email, name } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'username và password là bắt buộc' });
    const users = readUsers();
    if (users.find(u => u.username === username)) return res.status(409).json({ error: 'Tài khoản đã tồn tại' });
    const hash = bcrypt.hashSync(password, 10);
    const id = (users.length ? Math.max(...users.map(u=>u.id)) : 0) + 1;
    const user = { id, username, password_hash: hash, email: email||null, name: name||null };
    users.push(user);
    writeUsers(users);
    const safeUser = { id: user.id, username: user.username, email: user.email, name: user.name };
    const token = createToken(safeUser);
    res.json({ user: safeUser, token });
});

// Login
app.post('/auth/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'username và password là bắt buộc' });
    const users = readUsers();
    const row = users.find(u => u.username === username);
    if (!row) return res.status(401).json({ error: 'Sai thông tin đăng nhập' });
    const ok = bcrypt.compareSync(password, row.password_hash);
    if (!ok) return res.status(401).json({ error: 'Sai thông tin đăng nhập' });
    const user = { id: row.id, username: row.username, email: row.email, name: row.name };
    const token = createToken(user);
    res.json({ user, token });
});

// Protected: get current user
app.get('/auth/me', authenticateToken, (req, res) => {
    res.json({ user: req.user });
});

// Expenses storage per user (file-based, demo)
function getExpensesFile(username) {
    return path.join(dataDir, `expenses_${username}.json`);
}
function readExpenses(username) {
    try {
        const f = getExpensesFile(username);
        if (!fs.existsSync(f)) return [];
        return JSON.parse(fs.readFileSync(f, 'utf8') || '[]');
    } catch (e) {
        return [];
    }
}
function writeExpenses(username, arr) {
    const f = getExpensesFile(username);
    fs.writeFileSync(f, JSON.stringify(arr, null, 2), 'utf8');
}

// Get all expenses for current user
app.get('/expenses', authenticateToken, (req, res) => {
    const username = req.user.username;
    const items = readExpenses(username);
    res.json({ expenses: items });
});

// Add expense
app.post('/expenses', authenticateToken, (req, res) => {
    const { name, amount, date } = req.body;
    if (!name || amount == null || !date) return res.status(400).json({ error: 'name, amount, date required' });
    const username = req.user.username;
    const items = readExpenses(username);
    const id = Date.now().toString() + Math.random().toString(36).slice(2,7);
    const item = { id, name, amount: Number(amount), date, createdAt: new Date().toISOString() };
    items.push(item);
    writeExpenses(username, items);
    res.json({ expense: item });
});

// Delete expense
app.delete('/expenses/:id', authenticateToken, (req, res) => {
    const id = req.params.id;
    const username = req.user.username;
    let items = readExpenses(username);
    const idx = items.findIndex(e => e.id === id);
    if (idx === -1) return res.status(404).json({ error: 'not found' });
    items.splice(idx, 1);
    writeExpenses(username, items);
    res.json({ ok: true });
});

// Update expense
app.put('/expenses/:id', authenticateToken, (req, res) => {
    const id = req.params.id;
    const username = req.user.username;
    const { name, amount, date } = req.body;
    let items = readExpenses(username);
    const idx = items.findIndex(e => e.id === id);
    if (idx === -1) return res.status(404).json({ error: 'not found' });
    const it = items[idx];
    if (name != null) it.name = name;
    if (amount != null) it.amount = Number(amount);
    if (date != null) it.date = date;
    items[idx] = it;
    writeExpenses(username, items);
    res.json({ expense: it });
});

// Simple test endpoint
app.get('/hello', (req, res) => {
    res.json({ message: 'chạy thành công' });
});

// Generic POST example preserved
app.post('/add', (req, res) => {
    const data = req.body;
    res.json({ received: data });
});

app.listen(PORT, () => {
    console.log(`Server chạy tại http://localhost:${PORT}`);
});
