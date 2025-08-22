// server.ts dosyasının SON VE TAM HALİ

import express from 'express';
import session from 'express-session';
import path from 'path';
import bcrypt from 'bcrypt';
import { db } from './services/db.service';
import { encrypt, decrypt } from './services/crypto.service';
import * as paytrService from './services/paytr.service';

const app = express();
const PORT = process.env.PORT || 3000;

// Express Ayarları
app.set('view engine', 'ejs');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Oturum (Session) Ayarları
app.use(session({
    secret: process.env.SESSION_SECRET || 'default_secret_key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: true, httpOnly: true, sameSite: 'lax' } // Profesyonel ayarlar
}));

// "Giriş yapmış mı" kontrolü
const isAuthenticated = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // @ts-ignore
    if (req.session.user) {
        next();
    } else {
        res.redirect('/login');
    }
};

// ANA SAYFA YÖNLENDİRMESİ
app.get('/', (req, res) => {
    // @ts-ignore
    if (req.session.user) {
        res.redirect('/dashboard');
    } else {
        res.redirect('/login');
    }
});

// KAYIT SAYFALARI
app.get('/register', (req, res) => {
  const html = `
    <style> body { font-family: sans-serif; background: #222; color: #fff; display: flex; justify-content: center; align-items: center; height: 100vh; margin:0; } form { background: #333; padding: 2rem; border-radius: 8px; width: 300px; } div { margin-bottom: 1rem; } label { display: block; margin-bottom: 0.5rem; } input { width: 100%; padding: 0.5rem; border: 1px solid #555; border-radius: 4px; background: #444; color: #fff; box-sizing: border-box; } button { width: 100%; padding: 0.7rem; background: #007bff; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 1rem; } h1 { text-align: center; } </style>
    <form action="/register" method="POST"> <h1>Kayıt Ol</h1> <div> <label for="email">E-posta:</label> <input type="email" id="email" name="email" required> </div> <div> <label for="password">Şifre:</label> <input type="password" id="password" name="password" required> </div> <button type="submit">Kayıt Ol</button> </form>
  `;
  res.send(html);
});

app.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).send('E-posta ve şifre alanları zorunludur.');
    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) return res.status(400).send('Bu e-posta adresi zaten kullanılıyor.');
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await db.user.create({ data: { email, password: hashedPassword } });
    console.log('Yeni kullanıcı kaydedildi:', user.email);
    res.redirect('/login');
  } catch (error) {
    console.error('Kayıt sırasında hata:', error);
    res.status(500).send('Sunucuda bir hata oluştu.');
  }
});

// GİRİŞ SAYFALARI
app.get('/login', (req, res) => {
  const html = `
    <style> body { font-family: sans-serif; background: #222; color: #fff; display: flex; justify-content: center; align-items: center; height: 100vh; margin:0; } form { background: #333; padding: 2rem; border-radius: 8px; width: 300px; } div { margin-bottom: 1rem; } label { display: block; margin-bottom: 0.5rem; } input { width: 100%; padding: 0.5rem; border: 1px solid #555; border-radius: 4px; background: #444; color: #fff; box-sizing: border-box; } button { width: 100%; padding: 0.7rem; background: #28a745; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 1rem; } h1 { text-align: center; } </style>
    <form action
