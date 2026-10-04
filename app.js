const tg = window.Telegram?.WebApp || null;
if (tg) {
  tg.ready();
  try { tg.expand(); tg.setHeaderColor('#09080f'); tg.setBackgroundColor('#09080f'); } catch {}
}

const $ = (id) => document.getElementById(id);
const splash = $('splash');
const panelIcon = $('panelIcon');
const panelTitle = $('panelTitle');
const panelSub = $('panelSub');
const panelBody = $('panelBody');
const menuGrid = $('menuGrid');
const contentPanel = $('contentPanel');
const heroSlides = [...document.querySelectorAll('.hero-slide')];
const dots = $('dots');
const progress = $('heroProgress');
const soundToggle = $('soundToggle');
const miniBack = $('miniBack');

let soundEnabled = true;
let slideIndex = 0;
let paletteIndex = 0;
let selectedFile = null;
const SLIDE_MS = 5000;
const PALETTE_MS = 3000;

const products = [
  {id:'claude-sharing-1m', name:'Claude AI Sharing 1 Bulan', price:'Rp 85.000', amount:85000, desc:'Sharing 10 User · Full Garansi'},
  {id:'claude-private-1d', name:'Claude AI Pro Private 1 Hari', price:'Rp 55.000', amount:55000, desc:'Akses private'},
  {id:'claude-private-3d', name:'Claude AI Pro Private 3 Hari', price:'Rp 90.000', amount:90000, desc:'Akses private'},
  {id:'claude-private-7d', name:'Claude AI Pro Private 7 Hari', price:'Rp 150.000', amount:150000, desc:'Akses private'},
  {id:'tools-dionize', name:'Tools Dionize', price:'Rp 75.000', amount:75000, desc:'Generate gambar jadi video'}
];

const menuMeta = {
  home:{icon:'✦', title:'RAGION SHOP', sub:'Premium Digital Store', speech:'Menu utama'},
  order:{icon:'🛍️', title:'ORDER SEKARANG', sub:'Pilih produk yang tersedia', speech:'Order'},
  price:{icon:'💰', title:'HARGA', sub:'Daftar harga RAGION SHOP', speech:'Harga'},
  profile:{icon:'👤', title:'PROFIL', sub:'Informasi akun Telegram', speech:'Profil'},
  orders:{icon:'📦', title:'PESANAN SAYA', sub:'Riwayat dan status order', speech:'Pesanan'},
  payment:{icon:'💳', title:'PAYMENT', sub:'Pembayaran via QRIS', speech:'Payment'},
  info:{icon:'ℹ️', title:'INFO', sub:'Tentang RAGION SHOP', speech:'Info'}
};

function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
}
function getCurrentOrder(){ try{return JSON.parse(localStorage.getItem('ragion_current_order')||'null')}catch{return null} }
function setCurrentOrder(order){ localStorage.setItem('ragion_current_order', JSON.stringify(order)); }
function getOrderHistory(){ try{return JSON.parse(localStorage.getItem('ragion_orders')||'[]')}catch{return []} }
function saveOrderHistory(order){ const list=getOrderHistory(); const filtered=list.filter(o=>o.id!==order.id); filtered.unshift(order); localStorage.setItem('ragion_orders', JSON.stringify(filtered.slice(0,20))); }

// --- Voice: direct user gesture first, TTS fallback second. ---
function googleVoiceUrl(text){
  return `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=id&q=${encodeURIComponent(text)}`;
}
function speakMenu(label){
  if(!soundEnabled) return;
  // Remote speech starts immediately from the click gesture when possible.
  try {
    const audio = new Audio(googleVoiceUrl(label));
    audio.volume = 1;
    audio.play().catch(()=>{});
  } catch {}
  // Local device voice fallback.
  if ('speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(label);
      u.lang = 'id-ID';
      u.rate = 0.78;
      u.pitch = 1.35;
      u.volume = 1;
      const voices = window.speechSynthesis.getVoices();
      const idVoice = voices.find(v => /^id[-_]/i.test(v.lang));
      if (idVoice) u.voice = idVoice;
      window.speechSynthesis.speak(u);
    } catch {}
  }
}
function haptic(){ try{tg?.HapticFeedback?.impactOccurred('light')}catch{} }

function renderHome(){
  return `<div class="welcome-copy"><div class="badge">✦ PREMIUM DIGITAL STORE</div><h2>Semua kebutuhan digital dalam satu tempat.</h2><p>Website profesional · Tools AI · Produk digital · Layanan premium.</p></div><div class="action-row"><button class="action" data-menu="order">🛍️ ORDER SEKARANG</button><button class="action ghost" data-menu="price">💰 LIHAT HARGA</button></div>`;
}
function renderProducts(withBuy=true){
  return `<div class="product-list">${products.map(p=>`<div class="product"><div class="meta"><b>${escapeHtml(p.name)}</b><span>${escapeHtml(p.desc)}</span></div><div class="product-right"><strong>${p.price}</strong>${withBuy?`<button class="buy-btn" data-buy="${p.id}" data-label="Beli ${escapeHtml(p.name)}">BELI SEKARANG</button>`:''}</div></div>`).join('')}</div>`;
}
function renderOrders(){
  const list=getOrderHistory();
  if(!list.length) return `<div class="empty">Belum ada pesanan. Pilih produk di menu <b>ORDER</b>.</div><div class="action-row"><button class="action" data-menu="order">🛍️ PILIH PRODUK</button></div>`;
  return `<div class="order-history">${list.map(o=>`<div class="history-item"><div><b>${escapeHtml(o.productName)}</b><small>${escapeHtml(o.id)} · ${escapeHtml(o.status)}</small></div><strong>${escapeHtml(o.amountLabel)}</strong></div>`).join('')}</div>`;
}
function renderProfile(){
  const u=tg?.initDataUnsafe?.user||{};
  const name=[u.first_name,u.last_name].filter(Boolean).join(' ')||'Pengunjung';
  return `<div class="profile-grid"><div class="stat"><span>Nama</span><b>${escapeHtml(name)}</b></div><div class="stat"><span>Username</span><b>${escapeHtml(u.username?`@${u.username}`:'-')}</b></div><div class="stat"><span>Telegram ID</span><b>${escapeHtml(u.id||'-')}</b></div><div class="stat"><span>Role</span><b>Member</b></div></div>`;
}
function renderPayment(){
  const o=getCurrentOrder();
  const summary=o?`<div class="pay-summary"><span>ORDER ID</span><b>${escapeHtml(o.id)}</b><span>PRODUK</span><b>${escapeHtml(o.productName)}</b><span>TOTAL</span><b>${escapeHtml(o.amountLabel)}</b></div>`:`<div class="empty">Belum ada produk dipilih. Kembali ke <b>ORDER</b> lalu tekan <b>BELI SEKARANG</b>.</div>`;
  return `<div class="payment-card">${summary}<img class="qris" src="https://files.catbox.moe/7rheyw.png" alt="QRIS RAGION SHOP"><div class="payment-note">Scan QRIS, selesaikan pembayaran, lalu upload bukti transfer.</div><div class="upload-box"><input id="proofFile" type="file" accept="image/*,.pdf" hidden><button class="action ghost" id="chooseProof" type="button">📎 PILIH BUKTI TRANSFER</button><div class="file-name" id="fileName">Belum ada file dipilih.</div><button class="action" id="uploadProof" type="button" ${o?'':'disabled'}>📤 KIRIM BUKTI KE ADMIN</button><div class="upload-status" id="uploadStatus"></div></div></div>`;
}
function renderInfo(){ return `<div class="empty">RAGION SHOP menyediakan <b style="color:#fff">Website · Tools AI · Produk Digital · Layanan Premium</b>.<br><br>Pilih produk, lakukan pembayaran via QRIS, lalu kirim bukti transfer untuk konfirmasi admin.</div>`; }

function bodyFor(menu){
  switch(menu){
    case 'order': return renderProducts(true);
    case 'price': return renderProducts(false)+`<div class="action-row"><button class="action" data-menu="order">🛍️ BELI SEKARANG</button></div>`;
    case 'orders': return renderOrders();
    case 'profile': return renderProfile();
    case 'payment': return renderPayment();
    case 'info': return renderInfo();
    default: return renderHome();
  }
}

function render(menu='home', announce=true){
  const m=menuMeta[menu]||menuMeta.home;
  contentPanel.classList.remove('panel-pop'); void contentPanel.offsetWidth; contentPanel.classList.add('panel-pop');
  panelIcon.textContent=m.icon; panelTitle.textContent=m.title; panelSub.textContent=m.sub; panelBody.innerHTML=bodyFor(menu);
  document.querySelectorAll('.menu-card,.nav-btn').forEach(btn=>btn.classList.toggle('active', btn.dataset.menu===menu));
  const active=document.querySelector(`.menu-card[data-menu="${menu}"]`); if(active){active.classList.remove('tap-pop'); void active.offsetWidth; active.classList.add('tap-pop');}
  if(menu==='payment') bindPaymentUI();
  if(announce) speakMenu(m.speech);
  haptic();
}

function selectProduct(productId){
  const product=products.find(p=>p.id===productId); if(!product)return;
  const user=tg?.initDataUnsafe?.user||{};
  const order={id:`RG-${Date.now().toString(36).toUpperCase()}`,productId:product.id,productName:product.name,amount:product.amount,amountLabel:product.price,status:'MENUNGGU PEMBAYARAN',userId:user.id||null,username:user.username||'',firstName:user.first_name||'',createdAt:new Date().toISOString()};
  setCurrentOrder(order); saveOrderHistory(order); render('payment',true);
}

function bindPaymentUI(){
  const input=$('proofFile'), choose=$('chooseProof'), upload=$('uploadProof'), fileName=$('fileName'), status=$('uploadStatus');
  if(!input||!choose||!upload)return;
  choose.onclick=()=>input.click();
  input.onchange=()=>{ selectedFile=input.files?.[0]||null; fileName.textContent=selectedFile?.name||'Belum ada file dipilih.'; };
  upload.onclick=async()=>{
    const file=selectedFile||input.files?.[0]||null;
    const order=getCurrentOrder();
    if(!order){ status.textContent='⚠️ Pilih produk terlebih dahulu.'; return; }
    if(!file){ status.textContent='⚠️ Pilih bukti transfer terlebih dahulu.'; return; }
    if(!tg?.initData){ status.textContent='⚠️ Buka Mini App dari tombol Telegram agar akun pembeli dapat diverifikasi.'; return; }
    if(file.size>10*1024*1024){ status.textContent='⚠️ Ukuran file maksimal 10 MB.'; return; }
    choose.disabled=true; upload.disabled=true; status.textContent='⏳ Mengirim bukti transfer ke admin...';
    try{
      const fd=new FormData();
      fd.append('proof',file,file.name); fd.append('initData',tg.initData); fd.append('orderId',order.id); fd.append('productName',order.productName); fd.append('amount',order.amountLabel);
      const response=await fetch('/api/payment-proof',{method:'POST',body:fd,headers:{'X-Ragion-App':'miniapp-v5'}});
      const result=await response.json().catch(()=>({ok:false,message:'Respons server tidak valid.'}));
      if(!response.ok||!result.ok) throw new Error(result.message||'Upload gagal.');
      order.status='MENUNGGU KONFIRMASI ADMIN'; setCurrentOrder(order); saveOrderHistory(order);
      status.textContent='✅ Bukti berhasil dikirim ke admin. Menunggu konfirmasi.'; upload.textContent='✅ BUKTI SUDAH TERKIRIM';
    }catch(err){ status.textContent=`❌ ${err.message||'Gagal mengirim bukti.'}`; }
    finally{ choose.disabled=false; upload.disabled=false; }
  };
}

document.addEventListener('click',e=>{
  const buy=e.target.closest('[data-buy]');
  if(buy){ speakMenu('Beli sekarang'); haptic(); selectProduct(buy.dataset.buy); return; }
  const menu=e.target.closest('[data-menu]');
  if(!menu)return;
  const target=menu.dataset.menu;
  const label=menu.dataset.label || menuMeta[target]?.speech || 'Menu';
  speakMenu(label);
  if(target==='home') render('home',false); else render(target,false);
});
miniBack.onclick=()=>render('home',true);
soundToggle.onclick=()=>{
  soundEnabled=!soundEnabled; soundToggle.textContent=soundEnabled?'🔊':'🔇';
  if(!soundEnabled&&'speechSynthesis'in window) window.speechSynthesis.cancel();
  if(soundEnabled) speakMenu('Suara aktif');
};

// Banner slider: client-side only, no Telegram API calls.
heroSlides.forEach((_,i)=>{const d=document.createElement('span');d.className='dot'+(i===0?' active':'');dots.appendChild(d)});
function showSlide(i){
  slideIndex=(i+heroSlides.length)%heroSlides.length;
  heroSlides.forEach((s,n)=>s.classList.toggle('active',n===slideIndex));
  [...dots.children].forEach((d,n)=>d.classList.toggle('active',n===slideIndex));
  progress.style.transition='none'; progress.style.width='0%';
  requestAnimationFrame(()=>requestAnimationFrame(()=>{progress.style.transition=`width ${SLIDE_MS}ms linear`;progress.style.width='100%'}));
}
showSlide(0); setInterval(()=>showSlide(slideIndex+1),SLIDE_MS);

const palettes=[
  [['#ff2d78','#7c4dff'],['#2678ff','#9c3eff'],['#00d084','#00a3ff'],['#ff6b2c','#ffbe1b'],['#5e5ce6','#007aff'],['#00c7be','#34c759']],
  [['#ff375f','#ff9f0a'],['#00c6ff','#0072ff'],['#00d084','#00a3ff'],['#af52de','#ff2d55'],['#5856d6','#32ade6'],['#34c759','#0a84ff']],
  [['#ff2d55','#ffcc00'],['#af52de','#5856d6'],['#30d158','#00c7be'],['#ff9f0a','#ff375f'],['#007aff','#af52de'],['#00c7be','#0a84ff']],
  [['#7c4dff','#12d9ff'],['#ff2d78','#ff7a2f'],['#00b8d9','#14d77c'],['#ff9500','#ff2d55'],['#2678ff','#9c3eff'],['#0fbf9d','#703cff']]
];
function applyPalette(){
  const p=palettes[paletteIndex%palettes.length];
  document.querySelectorAll('.menu-card').forEach((b,i)=>{
    const [a,c]=p[i%p.length]; b.style.backgroundImage=`linear-gradient(135deg,${a},${c})`;
  });
}
applyPalette(); setInterval(()=>{paletteIndex++;applyPalette();},PALETTE_MS);

setTimeout(()=>{splash.style.opacity='0'; splash.style.pointerEvents='none'; splash.style.transition='opacity .5s ease'; setTimeout(()=>splash.remove(),550)},1500);
if('speechSynthesis' in window){ window.speechSynthesis.onvoiceschanged=()=>window.speechSynthesis.getVoices(); window.speechSynthesis.getVoices(); }
render('home',false);
