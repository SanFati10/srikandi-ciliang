require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const session = require('express-session');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));

// Koneksi Database Supabase (PostgreSQL)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Konfigurasi Session
app.use(session({
    secret: 'kkn-desa-ciliang-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 3600000 }
}));

// Inisialisasi Admin Default
(async () => {
    try {
        const res = await pool.query('SELECT * FROM users WHERE username = $1', ['admin']);
        if (res.rows.length === 0) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            await pool.query('INSERT INTO users (username, password) VALUES ($1, $2)', ['admin', hashedPassword]);
            console.log('Akun Admin default berhasil dibuat: admin / admin123');
        }
    } catch (err) {
        console.error('Error inisialisasi admin:', err);
    }
})();

// Middleware Cek Login
const checkAuth = (req, res, next) => {
    if (req.session.isLoggedIn) {
        next();
    } else {
        res.redirect('/login');
    }
};

// Route Login & Logout
app.get('/login', (req, res) => {
    if (req.session.isLoggedIn) return res.redirect('/');
    res.render('login', { error: null });
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        const user = result.rows[0];

        if (user && await bcrypt.compare(password, user.password)) {
            req.session.isLoggedIn = true;
            req.session.user = user.username;
            res.redirect('/');
        } else {
            res.render('login', { error: 'Username atau password salah!' });
        }
    } catch (err) {
        res.render('login', { error: 'Terjadi kesalahan sistem.' });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/login'));
});

// Route Utama (Publik)
app.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM usaha ORDER BY id DESC');
        res.render('index', { 
            listUsaha: result.rows, 
            editData: null, 
            isLoggedIn: req.session.isLoggedIn || false 
        });
    } catch (err) {
        res.status(500).send('Database Error');
    }
});

// Route Admin (CRUD)
app.post('/tambah', checkAuth, async (req, res) => {
    const { nama_usaha, nama_pemilik, kategori, jenis_usaha, alamat, no_hp } = req.body;
    await pool.query(
        'INSERT INTO usaha (nama_usaha, nama_pemilik, kategori, jenis_usaha, alamat, no_hp) VALUES ($1, $2, $3, $4, $5, $6)',
        [nama_usaha, nama_pemilik, kategori, jenis_usaha, alamat, no_hp]
    );
    res.redirect('/');
});

app.get('/edit/:id', checkAuth, async (req, res) => {
    const editRes = await pool.query('SELECT * FROM usaha WHERE id = $1', [req.params.id]);
    const listRes = await pool.query('SELECT * FROM usaha ORDER BY id DESC');
    res.render('index', { 
        listUsaha: listRes.rows, 
        editData: editRes.rows[0] || null, 
        isLoggedIn: req.session.isLoggedIn || false 
    });
});

app.post('/update/:id', checkAuth, async (req, res) => {
    const { nama_usaha, nama_pemilik, kategori, jenis_usaha, alamat, no_hp } = req.body;
    await pool.query(
        'UPDATE usaha SET nama_usaha = $1, nama_pemilik = $2, kategori = $3, jenis_usaha = $4, alamat = $5, no_hp = $6 WHERE id = $7',
        [nama_usaha, nama_pemilik, kategori, jenis_usaha, alamat, no_hp, req.params.id]
    );
    res.redirect('/');
});

app.post('/hapus/:id', checkAuth, async (req, res) => {
    await pool.query('DELETE FROM usaha WHERE id = $1', [req.params.id]);
    res.redirect('/');
});

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));