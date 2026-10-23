'use strict';
const https=require('node:https');
const dns=require('node:dns');
const net=require('node:net');
const cheerio=require('cheerio');

function publicIP(ip){
 if(!net.isIP(ip))return false;
 if(net.isIP(ip)===4){const a=ip.split('.').map(Number);return !(a[0]===0||a[0]===10||a[0]===127||a[0]>=224||a[0]===169&&a[1]===254||a[0]===172&&a[1]>=16&&a[1]<=31||a[0]===192&&a[1]===168||a[0]===100&&a[1]>=64&&a[1]<=127||a[0]===192&&a[1]===0||a[0]===198&&a[1]===18||a[0]===198&&a[1]===19||a[0]===198&&a[1]>=51&&a[1]<=100||a[0]===203&&a[1]===0&&a[2]===113);}
 const s=ip.toLowerCase();return !(s==='::'||s==='::1'||s.startsWith('fe80:')||s.startsWith('fc')||s.startsWith('fd')||s.startsWith('ff')||s.startsWith('2001:db8:')||s.startsWith('::ffff:'));
}
function validate(raw){let u;try{u=new URL(raw)}catch{throw Error('Invalid website address')}
 if(u.protocol!=='https:'||u.username||u.password||u.port&&u.port!=='443')throw Error('Only public HTTPS websites are supported');
 if(!u.hostname.includes('.')||u.hostname==='localhost'||u.hostname.endsWith('.localhost')||u.hostname.endsWith('.local')||u.hostname.endsWith('.internal')||net.isIP(u.hostname))throw Error('Private network addresses are not allowed');
 if(u.href.length>2048)throw Error('Address is too long');u.hash='';return u;
}
// Preserve DNS rebinding protection while respecting Node's lookup(all:true) contract.
function safeLookup(host,opts,cb){
 const options=typeof opts==='object'&&opts!==null?opts:{};
 dns.lookup(host,{all:true,verbatim:true},(err,addresses)=>{
  if(err)return cb(err);
  const safe=(addresses||[]).filter(x=>x&&publicIP(x.address));
  if(!safe.length)return cb(Error('Blocked private network address'));
  const ordered=safe.sort((a,b)=>(a.family===4?0:1)-(b.family===4?0:1));
  if(options.all)return cb(null,ordered);
  const selected=ordered[0];return cb(null,selected.address,selected.family);
 });
}
function request(url,depth=0){return new Promise((resolve,reject)=>{
 if(depth>3)return reject(Error('Too many redirects'));
 let u;try{u=validate(url)}catch(e){return reject(e)}
 const req=https.get(u,{timeout:6500,headers:{'User-Agent':'Mozilla/5.0 (compatible; JayOSReader/1.0)','Accept':'text/html,application/xhtml+xml','Accept-Encoding':'identity'},lookup:safeLookup},res=>{
 if([301,302,303,307,308].includes(res.statusCode)&&res.headers.location){res.resume();let next;try{next=new URL(res.headers.location,u).href}catch{return reject(Error('Invalid redirect'))}return request(next,depth+1).then(resolve,reject)}
 if(res.statusCode!==200){res.resume();return reject(Error('Website returned HTTP '+res.statusCode))}
 if(!String(res.headers['content-type']||'').toLowerCase().includes('text/html')){res.resume();return reject(Error('This page is not HTML'))}
 let chunks=[],size=0;res.on('data',chunk=>{size+=chunk.length;if(size>1200000){req.destroy(Error('Page too large'));return}chunks.push(chunk)});res.on('end',()=>resolve({html:Buffer.concat(chunks).toString('utf8'),url:u.href}));res.on('error',reject);
 });req.on('timeout',()=>req.destroy(Error('Website timed out')));req.on('error',reject);
})}
function unwrap(raw){try{const u=new URL(raw,'https://duckduckgo.com');if(u.pathname.startsWith('/l/')){const target=u.searchParams.get('uddg');if(target)return validate(target).href}return validate(u.href).href}catch{return null}}
async function search(q){if(!q||q.length>180)throw Error('Search must be 1–180 characters');const {html}=await request('https://html.duckduckgo.com/html/?q='+encodeURIComponent(q));const $=cheerio.load(html);const results=[];
 $('.result').each((_,el)=>{const a=$(el).find('.result__a').first();const url=unwrap(a.attr('href'));const title=a.text().trim().replace(/\s+/g,' ');const snippet=$(el).find('.result__snippet').first().text().trim().replace(/\s+/g,' ');if(url&&title&&results.length<25)results.push({title:title.slice(0,200),url,host:new URL(url).hostname,snippet:snippet.slice(0,450)})});
 return {results};
}
async function page(raw){const {html,url}=await request(raw);const $=cheerio.load(html);const title=$('title').first().text().trim().slice(0,200)||new URL(url).hostname;
 $('script,style,iframe,object,embed,form,button,input,textarea,select,video,audio,canvas,svg,meta,link,base,noscript,template,header,footer,nav,aside').remove();
 $('*').each((_,el)=>{if(el.type!=='tag')return;const tag=el.name;const allowed=new Set(['article','section','main','div','p','span','h1','h2','h3','h4','h5','h6','ul','ol','li','a','strong','b','em','i','blockquote','pre','code','br','hr','img','figure','figcaption','table','thead','tbody','tr','th','td','small','time']);if(!allowed.has(tag)){if(['html','body'].includes(tag))return;$(el).replaceWith($(el).contents());return}const href=$(el).attr('href'),src=$(el).attr('src');for(const attr of Object.keys(el.attribs||{}))$(el).removeAttr(attr);
 if(tag==='a'&&href){try{const u=validate(new URL(href,url).href);$(el).attr('href',u.href)}catch{}}
 if(tag==='img'&&src){try{const u=validate(new URL(src,url).href);$(el).attr('src',u.href);$(el).attr('loading','lazy');$(el).attr('referrerpolicy','no-referrer')}catch{}}
 });
 let content=$('main').first();if(!content.length||content.text().trim().length<200)content=$('article').first();if(!content.length||content.text().trim().length<200)content=$('body');let safe=content.html()||'';if(safe.length>250000)safe=safe.slice(0,250000);return {title,url,html:safe};
}
module.exports={search:require('./searxng-search').search,page};
