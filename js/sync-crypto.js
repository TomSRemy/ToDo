// Todo — the GitHub sync encrypted on this device (AES-256-GCM, Web Crypto) : the private data repo only ever holds
// ciphertext, so a leaked GitHub token (or GitHub itself) reads nothing. Loaded before js/app.js.
//
// One random data key encrypts the files. It is never stored on GitHub in clear : data/keyring.json holds it twice,
// wrapped by a key derived from the passphrase and by a key derived from the recovery code (the « kit de secours »),
// each with its own salt (PBKDF2-SHA-256, 600 000 rounds). Either secret opens it ; losing both makes the files on
// GitHub unreadable (the copy on each device stays). On a device, the data key is kept with the other keys (cleared
// by « Effacer toutes les clés »).
window.TodoCrypt=(function(){
  const VER='todo-aesgcm-1', KEY_LS='sync-key', ITER=600000, enc=new TextEncoder(), dec=new TextDecoder();
  const b64=buf=>btoa(String.fromCharCode(...new Uint8Array(buf))), unb64=s=>Uint8Array.from(atob(s), c=>c.charCodeAt(0));
  const rand=n=>crypto.getRandomValues(new Uint8Array(n));
  let dataKey=null;   // CryptoKey, once unlocked or loaded
  class Locked extends Error{ constructor(){ super('Synchro chiffrée : saisis ta phrase secrète (ou ton code de secours) sur cet appareil.'); this.locked=true; } }

  async function kek(secret, salt){
    const base=await crypto.subtle.importKey('raw', enc.encode(String(secret).normalize('NFKC')), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name:'PBKDF2', salt, iterations:ITER, hash:'SHA-256' }, base, { name:'AES-GCM', length:256 }, false, ['encrypt','decrypt']);
  }
  async function wrap(raw, secret){ const salt=rand(16), iv=rand(12), k=await kek(secret, salt); return { salt:b64(salt), iv:b64(iv), ct:b64(await crypto.subtle.encrypt({ name:'AES-GCM', iv }, k, raw)) }; }
  async function unwrap(w, secret){ const k=await kek(secret, unb64(w.salt)); return crypto.subtle.decrypt({ name:'AES-GCM', iv:unb64(w.iv) }, k, unb64(w.ct)); }
  const importData=raw=>crypto.subtle.importKey('raw', raw, { name:'AES-GCM' }, true, ['encrypt','decrypt']);
  // a recovery code easy to copy : 25 letters / digits without the ambiguous ones, in 5 groups (≈ 125 bits)
  function recoveryCode(){ const A='ABCDEFGHJKLMNPQRSTUVWXYZ23456789', r=rand(25); let s=''; r.forEach((x,i)=>{ s+=A[x%A.length]; if(i%5===4 && i<24) s+='-'; }); return s; }
  const normCode=s=>String(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'').replace(/(.{5})(?=.)/g,'$1-');

  async function load(){
    if(dataKey) return dataKey;
    let s=null; try{ s=localStorage.getItem(KEY_LS); }catch(e){}
    if(s) dataKey=await importData(unb64(s));
    return dataKey;
  }
  async function keep(raw){ dataKey=await importData(raw); try{ localStorage.setItem(KEY_LS, b64(raw)); }catch(e){} }
  function forget(){ dataKey=null; try{ localStorage.removeItem(KEY_LS); }catch(e){} }
  const isOn=()=>{ try{ return !!localStorage.getItem(KEY_LS); }catch(e){ return false; } };

  // first time : a new data key, its two wraps, and the recovery code to keep elsewhere
  async function setup(passphrase){
    const raw=rand(32), code=recoveryCode();
    const keyring={ v:1, alg:VER, kdf:'PBKDF2-SHA256', iter:ITER, pass:await wrap(raw, passphrase), recovery:await wrap(raw, normCode(code)), at:new Date().toISOString() };
    await keep(raw);
    return { keyring, code };
  }
  // another device, or a forgotten passphrase : either secret opens the keyring
  async function unlock(keyring, secret){
    let raw=null;
    try{ raw=await unwrap(keyring.pass, secret); }catch(e){ try{ raw=await unwrap(keyring.recovery, normCode(secret)); }catch(e2){ raw=null; } }
    if(!raw) throw new Error('Phrase secrète ou code de secours incorrect.');
    await keep(raw); return true;
  }
  // a new passphrase (and a new recovery code), the same data key : nothing to re-encrypt
  async function rewrap(keyring, newPass){
    const k=await load(); if(!k) throw new Locked();
    const raw=await crypto.subtle.exportKey('raw', k), code=recoveryCode();
    return { keyring:Object.assign({}, keyring, { pass:await wrap(raw, newPass), recovery:await wrap(raw, normCode(code)), at:new Date().toISOString() }), code };
  }

  const isSealed=o=>!!(o && typeof o==='object' && o.enc===VER && o.iv && o.ct);
  // what goes to GitHub : the JSON text, sealed when the encryption is on
  async function seal(text){
    const k=await load(); if(!k) return text;
    const iv=rand(12);
    return JSON.stringify({ enc:VER, iv:b64(iv), ct:b64(await crypto.subtle.encrypt({ name:'AES-GCM', iv }, k, enc.encode(text))) });
  }
  // what came from GitHub : opened when sealed (no key on this device : Locked), as is otherwise
  async function open(obj){
    if(!isSealed(obj)) return obj;
    const k=await load(); if(!k) throw new Locked();
    try{ return JSON.parse(dec.decode(await crypto.subtle.decrypt({ name:'AES-GCM', iv:unb64(obj.iv) }, k, unb64(obj.ct)))); }
    catch(e){ throw new Error('Données chiffrées illisibles avec la clé de cet appareil : déverrouille de nouveau avec ta phrase secrète.'); }
  }

  return { isOn, load, forget, setup, unlock, rewrap, seal, open, isSealed, Locked, normCode, KEY_LS };
})();
