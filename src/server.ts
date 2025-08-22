// LÜTFEN DOSYADAKİ HER ŞEYİ SİLİP BU GÜNCEL VERSİYONU YAPIŞTIRIN

import express from 'express';
import session from 'express-session';
import path from 'path';
import bcrypt from 'bcrypt';
import { db } from './services/db.service';
import { encrypt, decrypt } from './services/crypto.service';
import * as paytrService from './services/paytr.service';

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: process.env.SESSION_SECRET || 'default_secret_key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

const isAuthenticated = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // @ts-ignore
    if (req.session.user) {
        next();
    } else {
        res.redirect('/login');
    }
};

app.get('/', (req, res) => {
    // @ts-ignore
    if (req.session.user) {
        res.redirect('/dashboard');
    } else {
        res.redirect('/login');
    }
});

// ... (login ve register GET/POST blokları burada kalacak, onlarda değişiklik yok)
app.get('/login', (req, res) => {
  const html = `
    <style>
      body { font-family: sans-serif; background: #222; color: #fff; display: flex; justify-content: center; align-items: center; height: 100vh; }
      form { background: #333; padding: 2rem; border-radius: 8px; width: 300px; }
      div { margin-bottom: 1rem; }
      label { display: block; margin-bottom: 0.5rem; }
      input { width: 100%; padding: 0.5rem; border: 1px solid #555; border-radius: 4px; background: #444; color: #fff; box-sizing: border-box; }
      button { width: 100%; padding: 0.7rem; background: #28a745; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 1rem; }
      h1 { text-align: center; }
    </style>
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
    </form>
  `;
  res.send(html);
});

app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await db.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(400).send('E-posta veya şifre hatalı.');
    }
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).send('E-posta veya şifre hatalı.');
    }
    // @ts-ignore
    req.session.user = { id: user.id, email: user.email };
    console.log('Kullanıcı giriş yaptı:', user.email);
    res.redirect('/dashboard');
  } catch (error) {
    console.error('Giriş sırasında hata:', error);
    res.status(500).send('Sunucuda bir hata oluştu.');
  }
});

app.get('/register', (req, res) => {
  const html = `
    <style>
      body { font-family: sans-serif; background: #222; color: #fff; display: flex; justify-content: center; align-items: center; height: 100vh; }
      form { background: #333; padding: 2rem; border-radius: 8px; width: 300px; }
      div { margin-bottom: 1rem; }
      label { display: block; margin-bottom: 0.5rem; }
      input { width: 100%; padding: 0.5rem; border: 1px solid #555; border-radius: 4px; background: #444; color: #fff; box-sizing: border-box; }
      button { width: 100%; padding: 0.7rem; background: #007bff; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 1rem; }
      h1 { text-align: center; }
    </style>
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
    </form>
  `;
  res.send(html);
});

app.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).send('E-posta ve şifre alanları zorunludur.');
    }
    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).send('Bu e-posta adresi zaten kullanılıyor.');
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await db.user.create({
      data: { email: email, password: hashedPassword },
    });
    console.log('Yeni kullanıcı veritabanına kaydedildi:', user.email);
    res.redirect('/login');
  } catch (error) {
    console.error('Kayıt sırasında hata:', error);
    res.status(500).send('Sunucuda bir hata oluştu.');
  }
});

app.get('/dashboard', isAuthenticated, async (req, res) => {
    // @ts-ignore
    const userId = req.session.user.id;
    // @ts-ignore
    const userEmail = req.session.user.email;
    const yourAppUrl = `https://${req.hostname}`; 
    const webhookUrl = `${yourAppUrl}/webhook/ghl?userId=${userId}`;

    const settings = await db.settings.findUnique({ where: { userId } });
    const settingsComplete = settings ? 'Ayarlarınız başarıyla kaydedilmiş.' : 'Lütfen entegrasyon için ayarlarınızı tamamlayın.';

    const html = `
        <style>body { font-family: sans-serif; background: #222; color: #fff; padding: 2rem; } code { background: #444; padding: 2px 5px; border-radius: 3px; }</style>
        <h1>Yönetim Paneli</h1>
        <p>Hoş geldiniz, ${userEmail}!</p>
        <p><a href="/settings">Ayarlar</a></p>
        <hr>
        <h3>Entegrasyon Bilgileri</h3>
        <p>${settingsComplete}</p>
        <h4>GoHighLevel Webhook URL'iniz:</h4>
        <p>Bu URL'i kopyalayıp GHL form ayarlarınıza yapıştırın:</p>
        <pre><code>${webhookUrl}</code></pre>
    `;
    res.send(html);
});

app.get('/settings', isAuthenticated, (req, res) => {
  const html = `
    <style>
      body { font-family: sans-serif; background: #222; color: #fff; display: flex; justify-content: center; align-items: center; height: 100vh; }
      .container { max-width: 500px; margin: auto; }
      form { background: #333; padding: 2rem; border-radius: 8px; }
      div { margin-bottom: 1rem; }
      label { display: block; margin-bottom: 0.5rem; }
      input { width: 100%; padding: 0.5rem; border: 1px solid #555; border-radius: 4px; background: #444; color: #fff; box-sizing: border-box; }
      button { width: 100%; padding: 0.7rem; background: #007bff; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 1rem; }
      h1 { text-align: center; }
    </style>
    <div class="container">
      <form action="/settings" method="POST">
        <h1>Ayarlar</h1>
        <div>
          <label for="ghlApiKey">GoHighLevel API Anahtarı:</label>
          <input type="password" id="ghlApiKey" name="ghlApiKey" placeholder="GHL Location API Key" required>
        </div>
        <div>
          <label for="paytrMerchantId">PayTR Mağaza ID:</label>
          <input type="text" id="paytrMerchantId" name="paytrMerchantId" required>
        </div>
        <div>
          <label for="paytrMerchantKey">PayTR Mağaza Anahtarı:</label>
          <input type="password" id="paytrMerchantKey" name="paytrMerchantKey" required>
        </div>
        <div>
          <label for="paytrMerchantSalt">PayTR Mağaza Gizli Anahtarı (Salt):</label>
          <input type="password" id="paytrMerchantSalt" name="paytrMerchantSalt" required>
        </div>
        <button type="submit">Ayarları Kaydet</button>
      </form>
    </div>
  `;
  res.send(html);
});

app.post('/settings', isAuthenticated, async (req, res) => {
  try {
    // @ts-ignore
    const userId = req.session.user.id;
    const { ghlApiKey, paytrMerchantId, paytrMerchantKey, paytrMerchantSalt } = req.body;
    const encryptedGhlKey = encrypt(ghlApiKey);
    const encryptedPaytrId = encrypt(paytrMerchantId);
    const encryptedPaytrKey = encrypt(paytrMerchantKey);
    const encryptedPaytrSalt = encrypt(paytrMerchantSalt);

    await db.settings.upsert({
        where: { userId },
        update: { 
            ghlApiKey: encryptedGhlKey,
            paytrMerchantId: encryptedPaytrId,
            paytrMerchantKey: encryptedPaytrKey,
            paytrMerchantSalt: encryptedPaytrSalt
        },
        create: {
            userId,
            ghlApiKey: encryptedGhlKey,
            paytrMerchantId: encryptedPaytrId,
            paytrMerchantKey: encryptedPaytrKey,
            paytrMerchantSalt: encryptedPaytrSalt
        }
    });
    // @ts-ignore
    console.log('Ayarlar kaydedildi, kullanıcı:', req.session.user.email);
    res.redirect('/dashboard');
  } catch (error) {
    console.error('Ayarları kaydederken hata:', error);
    res.status(500).send('Ayarlar kaydedilirken bir hata oluştu.');
  }
});

app.post('/webhook/ghl', async (req, res) => {
  try {
    const userId = req.query.userId as string;
    if (!userId) {
      throw new Error('Webhook URL\'de kullanıcı kimliği (userId) eksik.');
    }
    const settings = await db.settings.findUnique({ where: { userId: userId as string } });
    if (!settings) {
      throw new Error('Bu kullanıcı için ayarlar bulunamadı.');
    }
    const paytrKeys = {
      merchantId: decrypt(settings.paytrMerchantId),
      merchantKey: decrypt(settings.paytrMerchantKey),
      merchantSalt: decrypt(settings.paytrMerchantSalt),
    };
    const { email, full_name, phone, customData } = req.body;
    const amount = parseFloat(customData?.tutar || '1') * 100;

    const paymentUrl = await paytrService.createPaymentUrl(
      {
        email,
        amount,
        orderId: `GHL-${Date.now()}`,
        fullName: full_name || 'Isim Bilgisi Yok',
        userIp: req.ip || '127.0.0.1', // Hata veren satırı düzelttik
      },
      paytrKeys
    );
    res.redirect(302, paymentUrl);
  } catch (error: any) {
    console.error('Webhook işlenirken hata:', error.message);
    res.status(500).send(`Bir hata oluştu: ${error.message}`);
  }
});

// BU TEST KODUNU app.listen(...)'DEN HEMEN ÖNCE YAPIŞTIRIN

app.get('/test', (req, res) => {
  console.log('>>> TEST NOKTASI BAŞARIYLA ÇAĞIRILDI! KAPI AÇIK! <<<');
  res.send('Sunucu ayakta ve dışarıdan gelen isteklere cevap veriyor!');
});

app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
});