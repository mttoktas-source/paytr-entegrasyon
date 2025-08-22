// src/services/paytr.service.ts - TAM VE DÜZELTİLMİŞ HAL
import axios from 'axios';
import crypto from 'crypto';

interface PaytrKeys {
  merchantId: string;
  merchantKey: string;
  merchantSalt: string;
}

interface PaymentData {
  email: string;
  amount: number;
  orderId: string;
  fullName: string;
  userIp: string;
}

interface CreatePaymentTokenData {
  amount: number;
  description: string;
  userEmail: string;
  cardId: number;
}

// PayTR için ödeme token'ı oluştur (server.ts'de kullanılan fonksiyon)
export const createPaymentToken = async (data: CreatePaymentTokenData) => {
  const { amount, description, userEmail, cardId } = data;
  
  // PayTR ayarları - .env'den al
  const merchantId = process.env.PAYTR_MERCHANT_ID!;
  const merchantKey = process.env.PAYTR_MERCHANT_KEY!;
  const merchantSalt = process.env.PAYTR_MERCHANT_SALT!;
  
  // Benzersiz sipariş ID'si oluştur
  const orderId = `ORDER_${Date.now()}_${cardId}`;
  
  // PayTR tutarı (kuruş cinsinden)
  const paytrAmount = Math.round(amount * 100);
  
  // Sepet bilgisi (PayTR formatında)
  const basket = Buffer.from(JSON.stringify([[description, amount, 1]])).toString('base64');
  
  // Callback URL'leri
  const successUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/payment/success`;
  const failUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/payment/fail`;
  
  // Kullanıcı IP'si (demo için sabit)
  const userIp = '127.0.0.1';
  
  // PayTR hash oluştur
  const hashStr = `${merchantId}${userIp}${orderId}${userEmail}${paytrAmount}${basket}1TL${successUrl}${failUrl}`;
  const paytrToken = crypto.createHmac('sha256', merchantKey).update(hashStr + merchantSalt).digest('base64');
  
  // PayTR'ye gönderilecek parametreler
  const params = new URLSearchParams();
  params.append('merchant_id', merchantId);
  params.append('user_ip', userIp);
  params.append('merchant_oid', orderId);
  params.append('email', userEmail);
  params.append('payment_amount', paytrAmount.toString());
  params.append('paytr_token', paytrToken);
  params.append('user_basket', basket);
  params.append('debug_on', '1'); // Test için
  params.append('no_installment', '1');
  params.append('max_installment', '0');
  params.append('user_name', 'Test User');
  params.append('user_address', 'Test Address');
  params.append('user_phone', '5551234567');
  params.append('merchant_ok_url', successUrl);
  params.append('merchant_fail_url', failUrl);
  params.append('currency', 'TL');
  params.append('test_mode', '1'); // Test modu
  
  try {
    const response = await axios.post('https://www.paytr.com/odeme/api/get-token', params);
    
    if (response.data.status !== 'success') {
      throw new Error(`PayTR Token Error: ${response.data.reason}`);
    }
    
    return {
      token: orderId,
      paymentUrl: `https://www.paytr.com/odeme/guvenli/${response.data.token}`
    };
  } catch (error) {
    console.error('PayTR token oluşturma hatası:', error);
    throw new Error('Ödeme token\'ı oluşturulamadı');
  }
};

// PayTR callback doğrulama (server.ts'de kullanılan fonksiyon)
export const verifyCallback = (callbackData: any): boolean => {
  try {
    const { merchant_oid, status, total_amount, hash } = callbackData;
    
    const merchantKey = process.env.PAYTR_MERCHANT_KEY!;
    const merchantSalt = process.env.PAYTR_MERCHANT_SALT!;
    
    // Hash doğrulama
    const hashStr = `${merchant_oid}${merchantSalt}${status}${total_amount}`;
    const expectedHash = crypto.createHmac('sha256', merchantKey).update(hashStr).digest('base64');
    
    return hash === expectedHash;
  } catch (error) {
    console.error('PayTR callback doğrulama hatası:', error);
    return false;
  }
};

// Eski fonksiyon (geriye dönük uyumluluk için)
export const createPaymentUrl = async (paymentData: PaymentData, keys: PaytrKeys) => {
  const { merchantId, merchantKey, merchantSalt } = keys;
  const { email, amount, orderId, fullName, userIp } = paymentData;
  
  const basket = Buffer.from(JSON.stringify([["Sipariş", amount / 100, 1]])).toString('base64');
  
  const successUrl = 'https://siteniz.com/odeme-basarili';
  const failUrl = 'https://siteniz.com/odeme-basarisiz';
  
  const hashStr = `${merchantId}${userIp}${orderId}${email}${amount}${basket}1TL${successUrl}${failUrl}`;
  const paytrToken = crypto.createHmac('sha256', merchantKey).update(hashStr + merchantSalt).digest('base64');
  
  const params = new URLSearchParams();
  params.append('merchant_id', merchantId);
  params.append('user_ip', userIp);
  params.append('merchant_oid', orderId);
  params.append('email', email);
  params.append('payment_amount', amount.toString());
  params.append('paytr_token', paytrToken);
  params.append('user_basket', basket);
  params.append('debug_on', '1');
  params.append('no_installment', '1');
  params.append('max_installment', '0');
  params.append('user_name', fullName);
  params.append('user_address', 'N/A');
  params.append('user_phone', 'N/A');
  params.append('merchant_ok_url', successUrl);
  params.append('merchant_fail_url', failUrl);
  params.append('currency', 'TL');
  params.append('test_mode', '1');
  
  const response = await axios.post('https://www.paytr.com/odeme/api/get-token', params);
  
  if (response.data.status !== 'success') {
    throw new Error(`PayTR Token Error: ${response.data.reason}`);
  }
  
  return `https://www.paytr.com/odeme/guvenli/${response.data.token}`;
};
