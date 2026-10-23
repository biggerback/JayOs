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
async function search(q){if(!q||q.length>180)throw Error('Search must be 1–180 characters');
 // Bing RSS supplies web links without a paid API key. Public access can be restricted.
 try{
  const r=await fetchPublic('https://www.bing.com/search?format=rss&q='+encodeURIComponent(q),'application/rss+xml,application/xml,text/xml');
  const items=[...r.body.matchAll(/<item>([\s\S]*?)<\/item>/gi)];
  const decode=s=>String(s).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'");
  const field=(x,t)=>decode(x.match(new RegExp('<'+t+'>([\\s\\S]*?)<\\/'+t+'>','i'))?.[1]||'');
  const results=items.slice(0,20).flatMap(m=>{try{const x=m[1],url=safeURL(field(x,'link')).href;return [{title:plain(field(x,'title')).slice(0,200),url,host:new URL(url).hostname,snippet:plain(field(x,'description')).slice(0,450)}]}catch{return []}});
  if(results.length)return {provider:'Bing RSS',results};
 }catch(e){}
 // Fallback to Wikipedia if the public web feed blocks automated requests.
 const endpoint='https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch='+encodeURIComponent(q)+'&gsrlimit=15&prop=extracts&exintro=1&explaintext=1&exsentences=2&format=json&origin=*';
 const r=await fetchPublic(endpoint,'application/json');
 const data=JSON.parse(r.body);
 const results=Object.values(data.query?.pages||{}).sort((a,b)=>(a.index||0)-(b.index||0)).map(p=>({title:p.title,url:'https://en.wikipedia.org/wiki/'+encodeURIComponent(p.title.replace(/ /g,'_')),host:'en.wikipedia.org',snippet:plain(p.extract||'').slice(0,450)}));
 return {provider:'Wikipedia fallback',results};
}
async function page(raw){const r=await fetchPublic(raw,'text/html,application/xhtml+xml');if(!/html/i.test(r.type))throw Error('This page is not HTML');
 const match=r.body.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);const title=plain(match?.[1]||'').slice(0,200)||new URL(r.url).hostname;
 const text=plain(r.body).slice(0,120000);if(!text)throw Error('No readable text found');
 const html=text.split(/\n\s*\n/).filter(Boolean).slice(0,300).map(s=>'<p>'+esc(s.trim())+'</p>').join('');
 return {title,url:r.url,html};
}
export default {async fetch(request,env){const url=new URL(request.url);if(url.pathname==='/api/search'||url.pathname==='/api/page'){
 if(request.method!=='GET')return json({error:'Method not allowed'},405);
 try{return json(url.pathname==='/api/search'?await search((url.searchParams.get('q')||'').trim()):await page(url.searchParams.get('url')||''))}
 catch(e){return json({error:e?.message||'Browser request failed'},502)}
 }
 if (!env.ASSETS) {
  return new Response(
    "JayOS assets binding is missing. Check wrangler.jsonc.",
    { status: 500 }
  );
}

return env.ASSETS.fetch(request);
}};
