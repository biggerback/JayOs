'use strict';
const https = require('node:https');
const net = require('node:net');
const dns = require('node:dns');

// Set SEARXNG_BASE_URL in Netlify, e.g. https://your-searxng.example
// Public instances often disable JSON or rate-limit serverless traffic.
function endpoint() {
  const raw = process.env.SEARXNG_BASE_URL;
  if (!raw) throw Error('SEARXNG_BASE_URL is not configured in Netlify');
  let u;
  try { u = new URL(raw); } catch { throw Error('Invalid SEARXNG_BASE_URL'); }
  if (u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443') || net.isIP(u.hostname) || !u.hostname.includes('.')) throw Error('SEARXNG_BASE_URL must be a public HTTPS hostname');
  return u;
}
function publicIP(ip) {
  const version = net.isIP(ip);
  if (!version) return false;
  if (version === 4) {
    const [a,b,c] = ip.split('.').map(Number);
    return !(a===0||a===10||a===127||a>=224||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&b===168)||(a===100&&b>=64&&b<=127)||(a===192&&b===0)||(a===192&&b===0&&c===2)||(a===198&&b>=18&&b<=19)||(a===198&&b===51&&c===100)||(a===203&&b===0&&c===113));
  }
  const s=ip.toLowerCase();
  if (s.startsWith('::ffff:')) return publicIP(s.slice(7));
  return !(s==='::'||s==='::1'||s.startsWith('fc')||s.startsWith('fd')||s.startsWith('fe8')||s.startsWith('fe9')||s.startsWith('fea')||s.startsWith('feb')||s.startsWith('ff')||s.startsWith('2001:db8:'));
}
function lookup(host, opts, cb) {
  dns.lookup(host,{all:true},(err,addresses)=>{
    if(err) return cb(err);
    const safe=addresses.filter(x=>publicIP(x.address));
    if(!safe.length) return cb(Error('Blocked private network address'));
    if(opts && opts.all) return cb(null,safe);
    const picked=safe.find(x=>x.family===4)||safe[0];
    cb(null,picked.address,picked.family);
  });
}
function fetchJSON(url) {
  return new Promise((resolve,reject)=>{
    const req=https.get(url,{timeout:8000,lookup,headers:{'User-Agent':'JayOS/1.0 (+browser search)','Accept':'application/json','Accept-Encoding':'identity'}},res=>{
      if(res.statusCode!==200){res.resume();return reject(Error('SearXNG returned HTTP '+res.statusCode+' (this instance may block JSON or rate-limit requests)'));}
      if(!String(res.headers['content-type']||'').toLowerCase().includes('json')){res.resume();return reject(Error('SearXNG did not return JSON; enable JSON format on the instance'));}
      let size=0,chunks=[];
      res.on('data',c=>{size+=c.length;if(size>1000000){req.destroy(Error('Search response too large'));return;}chunks.push(c)});
      res.on('end',()=>{try{resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))}catch{reject(Error('Invalid SearXNG JSON'))}});
      res.on('error',reject);
    });
    req.on('timeout',()=>req.destroy(Error('SearXNG request timed out')));
    req.on('error',reject);
  });
}
function safeResultUrl(raw){
  try{const u=new URL(raw);if(u.protocol!=='https:'&&u.protocol!=='http:')return null;if(u.username||u.password)return null;return u.href}catch{return null}
}
async function search(q){
  if(typeof q!=='string'||!q.trim()||q.length>180)throw Error('Search must be 1–180 characters');
  const u=endpoint();u.pathname='/search';u.search='';u.searchParams.set('q',q.trim());u.searchParams.set('format','json');
  const payload=await fetchJSON(u);
  if(!Array.isArray(payload.results))throw Error('Unexpected SearXNG response');
  const results=[];
  for(const item of payload.results){
    const url=safeResultUrl(item.url);if(!url||!item.title)continue;
    results.push({title:String(item.title).slice(0,200),url,host:new URL(url).hostname,snippet:String(item.content||'').replace(/<[^>]*>/g,'').slice(0,450)});
    if(results.length>=25)break;
  }
  return {results};
}
module.exports={search};
