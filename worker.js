// JayOS Cloudflare Worker — static assets + browser API.
// SearXNG_BASE_URL is an optional Worker environment variable.
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
function safeURL(raw){let u;try{u=new URL(raw)}catch{throw Error('Invalid website URL')}
 if(u.protocol!=='https:'||u.username||u.password||u.port&&u.port!=='443'||u.href.length>2048)throw Error('Only public HTTPS URLs are supported');
 const h=u.hostname.toLowerCase().replace(/\.$/,'');
 if(!h.includes('.')||h==='localhost'||h.endsWith('.localhost')||h.endsWith('.local')||h.endsWith('.internal')||h.endsWith('.test')||h.endsWith('.invalid')||h.endsWith('.example')||h.endsWith('.onion')||h.endsWith('.arpa')||/^\d+(\.\d+){0,3}$/.test(h)||h.includes(':'))throw Error('Private or IP-based hosts are blocked');
 return u;
}
async function fetchPublic(url,accept,redirects=0){if(redirects>3)throw Error('Too many redirects');const u=safeURL(url);
 const res=await fetch(u.href,{redirect:'manual',headers:{'Accept':accept,'User-Agent':'JayOSReader/1.0'},signal:AbortSignal.timeout(8000)});
 if([301,302,303,307,308].includes(res.status)&&res.headers.get('location'))return fetchPublic(new URL(res.headers.get('location'),u).href,accept,redirects+1);
 if(!res.ok)throw Error('Website returned HTTP '+res.status);
 const len=Number(res.headers.get('content-length')||0);if(len>1200000)throw Error('Page too large');
 const reader=res.body?.getReader();if(!reader)throw Error('Empty response');let total=0,chunks=[];
 try{while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>1200000)throw Error('Page too large');chunks.push(value)}}finally{reader.cancel().catch(()=>{})}
 const all=new Uint8Array(total);let pos=0;for(const part of chunks){all.set(part,pos);pos+=part.length}
 return {body:new TextDecoder().decode(all),url:u.href,type:res.headers.get('content-type')||''};
}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function plain(html){return html.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi,' ').replace(/<(?:nav|footer|header|aside|form|noscript|svg|iframe)\b[^>]*>[\s\S]*?<\/(?:nav|footer|header|aside|form|noscript|svg|iframe)\s*>/gi,' ').replace(/<\/(?:p|div|section|article|h[1-6]|li|br|tr)>/gi,'\n\n').replace(/<br\s*\/?\s*>/gi,'\n').replace(/<[^>]*>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&quot;/gi,'"').replace(/&#39;/gi,"'").replace(/[ \t]+/g,' ').replace(/\n\s*\n\s*\n/g,'\n\n').trim()}
// Free built-in Wikipedia search. No API key, SearXNG instance or Cloudflare variables needed.
async function search(q,env){
 if(!q||q.length>180)throw Error('Search must be 1–180 characters');
 const api=new URL('https://en.wikipedia.org/w/api.php');
 api.searchParams.set('action','query');
 api.searchParams.set('generator','search');
 api.searchParams.set('gsrsearch',q);
 api.searchParams.set('gsrlimit','20');
 api.searchParams.set('prop','extracts');
 api.searchParams.set('exintro','1');
 api.searchParams.set('explaintext','1');
 api.searchParams.set('exsentences','2');
 api.searchParams.set('format','json');
 api.searchParams.set('formatversion','2');
 const r=await fetchPublic(api.href,'application/json');
 if(!r.type.toLowerCase().includes('json'))throw Error('Wikipedia search returned an unexpected response');
 let data;try{data=JSON.parse(r.body)}catch{throw Error('Wikipedia returned invalid JSON')}
 const pages=Array.isArray(data?.query?.pages)?data.query.pages:[];
 return {provider:'Wikipedia',results:pages.filter(p=>p.title).map(p=>{
   const url='https://en.wikipedia.org/wiki/'+encodeURIComponent(p.title.replace(/ /g,'_'));
   return {title:p.title,url,host:'en.wikipedia.org',snippet:String(p.extract||'').slice(0,450)}
 })};
}
async function page(raw){const r=await fetchPublic(raw,'text/html,application/xhtml+xml');if(!/html/i.test(r.type))throw Error('This page is not HTML');
 const match=r.body.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);const title=plain(match?.[1]||'').slice(0,200)||new URL(r.url).hostname;
 const text=plain(r.body).slice(0,120000);if(!text)throw Error('No readable text found');
 const html=text.split(/\n\s*\n/).filter(Boolean).slice(0,300).map(s=>'<p>'+esc(s.trim())+'</p>').join('');
 return {title,url:r.url,html};
}
export default {async fetch(request,env){const url=new URL(request.url);if(url.pathname==='/api/search'||url.pathname==='/api/page'){
 if(request.method!=='GET')return json({error:'Method not allowed'},405);
 try{return json(url.pathname==='/api/search'?await search((url.searchParams.get('q')||'').trim(),env):await page(url.searchParams.get('url')||''))}
 catch(e){return json({error:e?.message||'Browser request failed'},502)}
 }
 return env.ASSETS.fetch(request);
}};
