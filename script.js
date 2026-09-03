/* ============================================================
   🍎 ראש השנה שלנו 🍯 — script.js
   Two lists (Menu, Shopping) stored in Google Sheets via a
   Google Apps Script Web App. No dishes/ingredients, no
   categories — deliberately simple.
   ============================================================ */

const LS_URL_KEY = 'rh_simple_api_url';
const LS_USER_KEY = 'rh_simple_user_name';
const REFRESH_MS = 10000;

let apiUrl = localStorage.getItem(LS_URL_KEY) || '';
let menu = [];
let shopping = [];
let syncing = false;

function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
function nowIso(){ return new Date().toISOString(); }
function esc(s){ return (s==null?'':String(s)).replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

/* ---------------- rendering ---------------- */

function renderMenu(){
  const list = document.getElementById('menuList');
  const empty = document.getElementById('menuEmpty');
  if(!menu.length){ list.innerHTML=''; empty.style.display='block'; return; }
  empty.style.display='none';
  list.innerHTML = menu.map(m => `
    <li>
      <span>${esc(m.item)}</span>
      <button class="del-btn" onclick="deleteMenuItem('${m.id}')" title="מחיקה">🗑️</button>
    </li>
  `).join('');
}

function renderShopping(){
  const todo = shopping.filter(s => !s.purchased);
  const done = shopping.filter(s => s.purchased);

  const todoList = document.getElementById('todoList');
  const todoEmpty = document.getElementById('todoEmpty');
  todoList.innerHTML = todo.map(shopItemHtml).join('');
  todoEmpty.style.display = todo.length ? 'none' : 'block';

  const doneList = document.getElementById('doneList');
  const doneEmpty = document.getElementById('doneEmpty');
  doneList.innerHTML = done.map(shopItemHtml).join('');
  doneEmpty.style.display = done.length ? 'none' : 'block';
}

function shopItemHtml(s){
  const qtyPart = s.quantity ? ` — ${s.quantity}${s.unit ? ' ' + esc(s.unit) : ''}` : (s.unit ? ` — ${esc(s.unit)}` : '');
  return `
    <li class="shop-item ${s.purchased?'purchased':''}">
      <button class="check-btn" onclick="togglePurchased('${s.id}')">${s.purchased?'✓':''}</button>
      <span class="label">${esc(s.item)}${qtyPart}</span>
      <button class="del-btn" onclick="deleteShopItem('${s.id}')" title="מחיקה">🗑️</button>
    </li>`;
}

function renderAll(){ renderMenu(); renderShopping(); }

/* ---------------- actions ---------------- */

function addMenuItem(name){
  const item = { id: uid(), item: name, createdAt: nowIso() };
  menu.push(item);
  renderAll();
  callApi('createMenu', item).catch(()=>toast('לא הצלחתי לשמור — בדקו את החיבור'));
}
function deleteMenuItem(id){
  menu = menu.filter(m => m.id !== id);
  renderAll();
  callApi('deleteMenu', { id }).catch(()=>toast('לא הצלחתי למחוק — בדקו את החיבור'));
}

function addShoppingItem(name, quantity, unit){
  const item = { id: uid(), item: name, quantity: quantity || '', unit: unit || '', purchased: false, createdAt: nowIso(), updatedAt: nowIso() };
  shopping.push(item);
  renderAll();
  callApi('createShopping', item).catch(()=>toast('לא הצלחתי לשמור — בדקו את החיבור'));
}
function togglePurchased(id){
  const s = shopping.find(x => x.id === id);
  if(!s) return;
  s.purchased = !s.purchased;
  s.updatedAt = nowIso();
  renderAll();
  callApi('updateShopping', { id: s.id, purchased: s.purchased, updatedAt: s.updatedAt })
    .catch(()=>toast('לא הצלחתי לעדכן — בדקו את החיבור'));
}
function deleteShopItem(id){
  shopping = shopping.filter(s => s.id !== id);
  renderAll();
  callApi('deleteShopping', { id }).catch(()=>toast('לא הצלחתי למחוק — בדקו את החיבור'));
}

/* ---------------- sync ---------------- */

async function callApi(action, payload){
  if(!apiUrl) return Promise.reject('no api url');
  return fetch(apiUrl, { method: 'POST', body: JSON.stringify({ action, payload }) });
}

async function refreshFromSheet(manual){
  if(!apiUrl){
    setSyncStatus('local');
    if(manual) toast('חברו קודם ל-Google Sheets דרך "⚙️ חיבור ל-Google Sheets"');
    return;
  }
  if(syncing) return;
  syncing = true;
  setSyncStatus('syncing');
  try{
    const res = await fetch(apiUrl + '?action=getAll');
    const data = await res.json();
    if(data && data.ok){
      menu = data.menu || [];
      shopping = (data.shopping || []).map(normalizeShoppingRow);
      renderAll();
      setSyncStatus('ok');
    } else {
      setSyncStatus('error');
    }
  }catch(e){
    console.warn('refresh failed', e);
    setSyncStatus('error');
  }
  syncing = false;
}
function normalizeShoppingRow(row){
  row.purchased = row.purchased === true || row.purchased === 'TRUE' || row.purchased === 'true';
  return row;
}

function setSyncStatus(s){
  const el = document.getElementById('syncStatus');
  if(s === 'syncing') el.textContent = 'מסנכרן…';
  else if(s === 'error') el.textContent = 'שגיאת סנכרון';
  else if(s === 'local') el.textContent = 'לא מחובר ל-Sheets';
  else el.textContent = 'מסונכרן ✓';
}

/* ---------------- settings ---------------- */

function openSettings(){
  const current = apiUrl || '';
  const value = prompt('הדביקו כאן את כתובת ה-Web App מ-Google Apps Script:', current);
  if(value === null) return;
  apiUrl = value.trim();
  localStorage.setItem(LS_URL_KEY, apiUrl);
  toast(apiUrl ? 'הכתובת נשמרה' : 'החיבור הוסר — מצב מקומי בלבד');
  refreshFromSheet(true);
}

/* ---------------- misc ---------------- */

function toast(msg){
  const root = document.getElementById('toastRoot');
  root.innerHTML = `<div class="toast">${esc(msg)}</div>`;
  setTimeout(()=>{ root.innerHTML=''; }, 2400);
}

/* ---------------- init ---------------- */

document.getElementById('menuForm').addEventListener('submit', (e)=>{
  e.preventDefault();
  const input = document.getElementById('menuInput');
  const name = input.value.trim();
  if(!name) return;
  addMenuItem(name);
  input.value = '';
  input.focus();
});

document.getElementById('shopForm').addEventListener('submit', (e)=>{
  e.preventDefault();
  const nameEl = document.getElementById('shopName');
  const qtyEl = document.getElementById('shopQty');
  const unitEl = document.getElementById('shopUnit');
  const name = nameEl.value.trim();
  if(!name) return;
  addShoppingItem(name, qtyEl.value.trim(), unitEl.value.trim());
  nameEl.value = ''; qtyEl.value = ''; unitEl.value = '';
  nameEl.focus();
});

document.getElementById('refreshBtn').addEventListener('click', ()=> refreshFromSheet(true));
document.getElementById('settingsBtn').addEventListener('click', openSettings);

renderAll();
refreshFromSheet();
setInterval(()=>{ if(document.visibilityState === 'visible') refreshFromSheet(); }, REFRESH_MS);
document.addEventListener('visibilitychange', ()=>{ if(document.visibilityState === 'visible') refreshFromSheet(); });
