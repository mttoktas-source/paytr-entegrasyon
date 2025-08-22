// server.ts dosyasının TAM VE DÜZELTİLMİŞ HALİ
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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Oturum (Session) Ayarları
app.use(session({
    secret: process.env.SESSION_SECRET || 'default_secret_key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false, httpOnly: true, sameSite: 'lax' } // Vercel için secure: false
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
        <!DOCTYPE html>
        <html>
        <head>
            <title>Kayıt Ol</title>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                body { 
                    font-family: sans-serif; 
                    background: #222; 
                    color: #fff; 
                    display: flex; 
                    justify-content: center; 
                    align-items: center; 
                    height: 100vh; 
                    margin: 0; 
                } 
                form { 
                    background: #333; 
                    padding: 2rem; 
                    border-radius: 8px; 
                    width: 300px; 
                } 
                div { 
                    margin-bottom: 1rem; 
                } 
                label { 
                    display: block; 
                    margin-bottom: 0.5rem; 
                } 
                input { 
                    width: 100%; 
                    padding: 0.5rem; 
                    border: 1px solid #555; 
                    border-radius: 4px; 
                    background: #444; 
                    color: #fff; 
                    box-sizing: border-box; 
                } 
                button { 
                    width: 100%; 
                    padding: 0.7rem; 
                    background: #007bff; 
                    color: #fff; 
                    border: none; 
                    border-radius: 4px; 
                    cursor: pointer; 
                    font-size: 1rem; 
                } 
                button:hover {
                    background: #0056b3;
                }
                h1 { 
                    text-align: center; 
                    margin-bottom: 1.5rem;
                } 
                .link {
                    text-align: center;
                    margin-top: 1rem;
                }
                .link a {
                    color: #007bff;
                    text-decoration: none;
                }
            </style>
        </head>
        <body>
            <form action="/register" method="POST"> 
                <h1>Kayıt Ol</h1> 
                <div> 
                    <label for="email">E-posta:</label> 
                    <input type="email" id="email" name="email" required> 
                </div> 
                <div> 
                    <label for="password">Şifre:</label> 
                    <input type="password" id="password" name="password" required> 
                </div> 
                <button type="submit">Kayıt Ol</button>
                <div class="link">
                    <a href="/login">Zaten hesabın var mı? Giriş yap</a>
                </div>
            </form>
        </body>
        </html>
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
        <!DOCTYPE html>
        <html>
        <head>
            <title>Giriş Yap</title>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                body { 
                    font-family: sans-serif; 
                    background: #222; 
                    color: #fff; 
                    display: flex; 
                    justify-content: center; 
                    align-items: center; 
                    height: 100vh; 
                    margin: 0; 
                } 
                form { 
                    background: #333; 
                    padding: 2rem; 
                    border-radius: 8px; 
                    width: 300px; 
                } 
                div { 
                    margin-bottom: 1rem; 
                } 
                label { 
                    display: block; 
                    margin-bottom: 0.5rem; 
                } 
                input { 
                    width: 100%; 
                    padding: 0.5rem; 
                    border: 1px solid #555; 
                    border-radius: 4px; 
                    background: #444; 
                    color: #fff; 
                    box-sizing: border-box; 
                } 
                button { 
                    width: 100%; 
                    padding: 0.7rem; 
                    background: #007bff; 
                    color: #fff; 
                    border: none; 
                    border-radius: 4px; 
                    cursor: pointer; 
                    font-size: 1rem; 
                } 
                button:hover {
                    background: #0056b3;
                }
                h1 { 
                    text-align: center; 
                    margin-bottom: 1.5rem;
                } 
                .link {
                    text-align: center;
                    margin-top: 1rem;
                }
                .link a {
                    color: #007bff;
                    text-decoration: none;
                }
                .error {
                    background: #dc3545;
                    color: white;
                    padding: 0.5rem;
                    border-radius: 4px;
                    margin-bottom: 1rem;
                    text-align: center;
                }
            </style>
        </head>
        <body>
            <form action="/login" method="POST"> 
                <h1>Giriş Yap</h1> 
                <div> 
                    <label for="email">E-posta:</label> 
                    <input type="email" id="email" name="email" required> 
                </div> 
                <div> 
                    <label for="password">Şifre:</label> 
                    <input type="password" id="password" name="password" required> 
                </div> 
                <button type="submit">Giriş Yap</button>
                <div class="link">
                    <a href="/register">Hesabın yok mu? Kayıt ol</a>
                </div>
            </form>
        </body>
        </html>
    `;
    res.send(html);
});

app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).send('E-posta ve şifre alanları zorunludur.');
        
        const user = await db.user.findUnique({ where: { email } });
        if (!user) return res.status(401).send('Geçersiz e-posta veya şifre.');
        
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) return res.status(401).send('Geçersiz e-posta veya şifre.');
        
        // @ts-ignore
        req.session.user = { id: user.id, email: user.email };
        
        console.log('Kullanıcı giriş yaptı:', user.email);
        res.redirect('/dashboard');
    } catch (error) {
        console.error('Giriş sırasında hata:', error);
        res.status(500).send('Sunucuda bir hata oluştu.');
    }
});

// DASHBOARD SAYFASI
app.get('/dashboard', isAuthenticated, async (req, res) => {
    try {
        // @ts-ignore
        const userId = req.session.user.id;
        const user = await db.user.findUnique({ 
            where: { id: userId },
            include: { 
                creditCards: true,
                transactions: {
                    orderBy: { createdAt: 'desc' },
                    take: 10
                }
            }
        });
        
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Dashboard</title>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <style>
                    body { 
                        font-family: sans-serif; 
                        background: #222; 
                        color: #fff; 
                        margin: 0; 
                        padding: 2rem; 
                    }
                    .container {
                        max-width: 1200px;
                        margin: 0 auto;
                    }
                    .header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 2rem;
                        background: #333;
                        padding: 1rem;
                        border-radius: 8px;
                    }
                    .logout-btn {
                        background: #dc3545;
                        color: white;
                        padding: 0.5rem 1rem;
                        text-decoration: none;
                        border-radius: 4px;
                    }
                    .cards-section, .transactions-section {
                        background: #333;
                        padding: 1.5rem;
                        border-radius: 8px;
                        margin-bottom: 2rem;
                    }
                    .add-card-btn {
                        background: #28a745;
                        color: white;
                        padding: 0.7rem 1.5rem;
                        text-decoration: none;
                        border-radius: 4px;
                        display: inline-block;
                        margin-bottom: 1rem;
                    }
                    .card-item {
                        background: #444;
                        padding: 1rem;
                        margin: 0.5rem 0;
                        border-radius: 4px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    .transaction-item {
                        background: #444;
                        padding: 1rem;
                        margin: 0.5rem 0;
                        border-radius: 4px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    .status-success { color: #28a745; }
                    .status-pending { color: #ffc107; }
                    .status-failed { color: #dc3545; }
                    h1, h2 { margin-top: 0; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Dashboard - Hoş geldin ${user?.email}</h1>
                        <a href="/logout" class="logout-btn">Çıkış Yap</a>
                    </div>
                    
                    <div class="cards-section">
                        <h2>Kredi Kartlarım</h2>
                        <a href="/add-card" class="add-card-btn">Yeni Kart Ekle</a>
                        ${user?.creditCards.map(card => `
                            <div class="card-item">
                                <span>**** **** **** ${card.last4Digits}</span>
                                <span>${card.cardholderName}</span>
                                <a href="/delete-card/${card.id}" style="color: #dc3545;">Sil</a>
                            </div>
                        `).join('') || '<p>Henüz kart eklenmemiş.</p>'}
                    </div>
                    
                    <div class="transactions-section">
                        <h2>Son İşlemler</h2>
                        ${user?.transactions.map(tx => `
                            <div class="transaction-item">
                                <div>
                                    <strong>${tx.amount}₺</strong> - ${tx.description}
                                    <br><small>${new Date(tx.createdAt).toLocaleString('tr-TR')}</small>
                                </div>
                                <span class="status-${tx.status}">${tx.status}</span>
                            </div>
                        `).join('') || '<p>Henüz işlem bulunmuyor.</p>'}
                    </div>
                </div>
            </body>
            </html>
        `;
        res.send(html);
    } catch (error) {
        console.error('Dashboard yüklenirken hata:', error);
        res.status(500).send('Sunucuda bir hata oluştu.');
    }
});

// KART EKLEME SAYFASI
app.get('/add-card', isAuthenticated, (req, res) => {
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Kart Ekle</title>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                body { 
                    font-family: sans-serif; 
                    background: #222; 
                    color: #fff; 
                    display: flex; 
                    justify-content: center; 
                    align-items: center; 
                    min-height: 100vh; 
                    margin: 0; 
                    padding: 2rem;
                } 
                form { 
                    background: #333; 
                    padding: 2rem; 
                    border-radius: 8px; 
                    width: 400px; 
                    max-width: 100%;
                } 
                div { 
                    margin-bottom: 1rem; 
                } 
                label { 
                    display: block; 
                    margin-bottom: 0.5rem; 
                } 
                input { 
                    width: 100%; 
                    padding: 0.5rem; 
                    border: 1px solid #555; 
                    border-radius: 4px; 
                    background: #444; 
                    color: #fff; 
                    box-sizing: border-box; 
                } 
                button { 
                    width: 100%; 
                    padding: 0.7rem; 
                    background: #28a745; 
                    color: #fff; 
                    border: none; 
                    border-radius: 4px; 
                    cursor: pointer; 
                    font-size: 1rem; 
                    margin-bottom: 1rem;
                } 
                .back-btn {
                    background: #6c757d;
                    text-align: center;
                    text-decoration: none;
                    display: block;
                    padding: 0.7rem;
                    border-radius: 4px;
                }
                h1 { 
                    text-align: center; 
                    margin-bottom: 1.5rem;
                }
            </style>
        </head>
        <body>
            <form action="/add-card" method="POST"> 
                <h1>Yeni Kart Ekle</h1> 
                <div> 
                    <label for="cardNumber">Kart Numarası:</label> 
                    <input type="text" id="cardNumber" name="cardNumber" maxlength="19" placeholder="1234 5678 9012 3456" required> 
                </div> 
                <div> 
                    <label for="expiryMonth">Son Kullanma Ayı:</label> 
                    <input type="number" id="expiryMonth" name="expiryMonth" min="1" max="12" placeholder="12" required> 
                </div>
                <div> 
                    <label for="expiryYear">Son Kullanma Yılı:</label> 
                    <input type="number" id="expiryYear" name="expiryYear" min="2024" max="2034" placeholder="2025" required> 
                </div>
                <div> 
                    <label for="cvv">CVV:</label> 
                    <input type="text" id="cvv" name="cvv" maxlength="3" placeholder="123" required> 
                </div>
                <div> 
                    <label for="cardholderName">Kart Sahibi Adı:</label> 
                    <input type="text" id="cardholderName" name="cardholderName" placeholder="JOHN DOE" required> 
                </div>
                <button type="submit">Kartı Ekle</button>
                <a href="/dashboard" class="back-btn">Dashboard'a Dön</a>
            </form>
        </body>
        </html>
    `;
    res.send(html);
});

app.post('/add-card', isAuthenticated, async (req, res) => {
    try {
        const { cardNumber, expiryMonth, expiryYear, cvv, cardholderName } = req.body;
        // @ts-ignore
        const userId = req.session.user.id;
        
        if (!cardNumber || !expiryMonth || !expiryYear || !cvv || !cardholderName) {
            return res.status(400).send('Tüm alanlar zorunludur.');
        }
        
        // Kart numarasını şifrele
        const encryptedCardNumber = encrypt(cardNumber.replace(/\s/g, ''));
        const encryptedCVV = encrypt(cvv);
        
        // Son 4 hanesi kaydet
        const last4Digits = cardNumber.replace(/\s/g, '').slice(-4);
        
        await db.creditCard.create({
            data: {
                userId,
                encryptedCardNumber,
                expiryMonth: parseInt(expiryMonth),
                expiryYear: parseInt(expiryYear),
                encryptedCVV,
                cardholderName: cardholderName.toUpperCase(),
                last4Digits
            }
        });
        
        console.log('Yeni kart eklendi:', last4Digits);
        res.redirect('/dashboard');
    } catch (error) {
        console.error('Kart ekleme sırasında hata:', error);
        res.status(500).send('Sunucuda bir hata oluştu.');
    }
});

// KART SİLME
app.get('/delete-card/:cardId', isAuthenticated, async (req, res) => {
    try {
        const cardId = parseInt(req.params.cardId);
        // @ts-ignore
        const userId = req.session.user.id;
        
        await db.creditCard.deleteMany({
            where: {
                id: cardId,
                userId: userId
            }
        });
        
        console.log('Kart silindi:', cardId);
        res.redirect('/dashboard');
    } catch (error) {
        console.error('Kart silme sırasında hata:', error);
        res.status(500).send('Sunucuda bir hata oluştu.');
    }
});

// ÇIKIŞ
app.get('/logout', (req, res) => {
    // @ts-ignore
    req.session.destroy((err) => {
        if (err) {
            console.error('Çıkış sırasında hata:', err);
            return res.status(500).send('Sunucuda bir hata oluştu.');
        }
        res.redirect('/login');
    });
});

// ÖDEME İŞLEMİ SAYFASI (PayTR entegrasyonu için)
app.get('/payment', isAuthenticated, async (req, res) => {
    try {
        // @ts-ignore
        const userId = req.session.user.id;
        const user = await db.user.findUnique({ 
            where: { id: userId },
            include: { creditCards: true }
        });
        
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Ödeme</title>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <style>
                    body { font-family: sans-serif; background: #222; color: #fff; margin: 0; padding: 2rem; }
                    .container { max-width: 600px; margin: 0 auto; }
                    .form-section { background: #333; padding: 2rem; border-radius: 8px; margin-bottom: 2rem; }
                    input, select { width: 100%; padding: 0.7rem; margin: 0.5rem 0; border: 1px solid #555; border-radius: 4px; background: #444; color: #fff; box-sizing: border-box; }
                    button { width: 100%; padding: 0.7rem; background: #007bff; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 1rem; }
                    label { display: block; margin: 0.5rem 0; }
                    .back-btn { background: #6c757d; text-align: center; text-decoration: none; display: block; padding: 0.7rem; border-radius: 4px; margin-top: 1rem; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="form-section">
                        <h1>Ödeme Yap</h1>
                        <form action="/process-payment" method="POST">
                            <div>
                                <label for="amount">Tutar (₺):</label>
                                <input type="number" id="amount" name="amount" min="1" step="0.01" required>
                            </div>
                            <div>
                                <label for="description">Açıklama:</label>
                                <input type="text" id="description" name="description" placeholder="Ödeme açıklaması" required>
                            </div>
                            <div>
                                <label for="cardId">Kart Seç:</label>
                                <select id="cardId" name="cardId" required>
                                    <option value="">Kart seçiniz...</option>
                                    ${user?.creditCards.map(card => 
                                        `<option value="${card.id}">**** **** **** ${card.last4Digits} - ${card.cardholderName}</option>`
                                    ).join('')}
                                </select>
                            </div>
                            <button type="submit">Ödemeyi Başlat</button>
                            <a href="/dashboard" class="back-btn">Dashboard'a Dön</a>
                        </form>
                    </div>
                </div>
            </body>
            </html>
        `;
        res.send(html);
    } catch (error) {
        console.error('Ödeme sayfası yüklenirken hata:', error);
        res.status(500).send('Sunucuda bir hata oluştu.');
    }
});

// ÖDEME İŞLEME
app.post('/process-payment', isAuthenticated, async (req, res) => {
    try {
        const { amount, description, cardId } = req.body;
        // @ts-ignore
        const userId = req.session.user.id;
        
        if (!amount || !description || !cardId) {
            return res.status(400).send('Tüm alanlar zorunludur.');
        }
        
        // Seçilen kartı al
        const card = await db.creditCard.findFirst({
            where: { id: parseInt(cardId), userId }
        });
        
        if (!card) {
            return res.status(404).send('Kart bulunamadı.');
        }
        
        // PayTR ödeme token'ı oluştur
        const paymentData = await paytrService.createPaymentToken({
            amount: parseFloat(amount),
            description,
            userEmail: req.session.user.email,
            cardId: card.id
        });
        
        // İşlemi veritabanına kaydet
        const transaction = await db.transaction.create({
            data: {
                userId,
                cardId: card.id,
                amount: parseFloat(amount),
                description,
                status: 'pending',
                paytrToken: paymentData.token
            }
        });
        
        console.log('Yeni ödeme işlemi oluşturuldu:', transaction.id);
        
        // PayTR ödeme sayfasına yönlendir
        res.redirect(paymentData.paymentUrl);
        
    } catch (error) {
        console.error('Ödeme işleme sırasında hata:', error);
        res.status(500).send('Sunucuda bir hata oluştu.');
    }
});

// PAYTR CALLBACK
app.post('/paytr/callback', async (req, res) => {
    try {
        const isValid = paytrService.verifyCallback(req.body);
        
        if (isValid) {
            const { merchant_oid, status } = req.body;
            
            // İşlem durumunu güncelle
            await db.transaction.updateMany({
                where: { paytrToken: merchant_oid },
                data: { 
                    status: status === '1' ? 'success' : 'failed',
                    updatedAt: new Date()
                }
            });
            
            console.log('PayTR callback işlendi:', merchant_oid, status);
        }
        
        res.send('OK');
    } catch (error) {
        console.error('PayTR callback hatası:', error);
        res.status(500).send('ERROR');
    }
});

// SUNUCUYU BAŞLAT
app.listen(PORT, () => {
    console.log(`Server ${PORT} portunda çalışıyor...`);
});

// Vercel için export
export default app;
