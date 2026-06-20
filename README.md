# AI Sight Glasses - Web App Prototype

Prototaip berasaskan web untuk konsep **AI Sight Glasses** (Cermin Mata Pintar untuk Orang Buta) yang menggunakan AI Penglihatan Komputer tempatan (*Edge AI*) untuk mengesan halangan dalam masa nyata dan memberikan amaran audio spatial.

![AI Sight UI](https://img.shields.io/badge/AI-TensorFlow.js-orange?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)

---

## 🚀 Ciri-Ciri Utama
*   **Edge-AI Object Detection:** Menjalankan model **COCO-SSD Lite (MobileNet V2)** secara langsung di dalam pelayar telefon/komputer anda tanpa menggunakan internet (selamat dan jimat bateri).
*   **3D Spatial Stereo Audio:** Menghasilkan bunyi bip amaran berarah (kiri atau kanan) menggunakan **Web Audio API** berdasarkan kedudukan koordinat halangan.
*   **Amaran Suara Bahasa Melayu:** Menggunakan **Web Speech API (Text-to-Speech)** untuk menyebut nama halangan yang dikesan dalam Bahasa Melayu apabila objek berada terlalu dekat.
*   **Dwi-Kamera Support:** Menyokong penukaran kamera depan dan belakang (kamera utama telefon).
*   **Visual Dashboard:** Memaparkan visual kotak sempadan (*bounding box*) bercahaya neon, log amaran masa nyata, dan kadar bingkai sesaat (FPS).

---

## 🛠️ Fail Projek
*   `index.html` - Struktur antaramuka dan pemuatan library TensorFlow.js.
*   `style.css` - Reka bentuk premium bertema gelap futuristik (*glassmorphism*).
*   `app.js` - Logik kawalan kamera, pemprosesan AI, pengiraan arah spatial, dan audio amaran.

---

## 📱 Cara Uji Pada Telefon Pintar

Pihak pelayar telefon pintar (Chrome/Safari) **menyekat akses kamera (getUserMedia) hanya untuk sambungan HTTPS** atau `localhost`. Anda boleh menguji projek ini di telefon menggunakan kaedah berikut:

### Kaedah A: Netlify Drop (Paling Mudah)
1. Pergi ke [Netlify Drop](https://app.netlify.com/drop).
2. Seret (*drag and drop*) keseluruhan folder projek ini ke dalam kotak yang disediakan.
3. Buka pautan HTTPS yang dijana di telefon pintar anda, benarkan akses kamera, dan mula menguji!

### Kaedah B: Local Server + Port Forwarding
1. Jalankan server Python di komputer anda:
   ```bash
   python -m http.server 8080
   ```
2. Sambungkan telefon anda ke komputer menggunakan kabel USB.
3. Gunakan ciri **Chrome DevTools Remote Devices** untuk melakukan *Port Forwarding* port `8080` dari komputer ke telefon.
4. Buka pelayar Chrome di telefon anda dan akses `http://localhost:8080`.
