// scraper.js
// GitHub Actions จะรันไฟล์นี้ และบันทึกผลลง results.json

const fs = require("fs");

const SOURCES = {
  lao_extra:       { url:"https://laoextra.com/", type:"lotto" },
  nikkei_vip:      { url:"https://stocks-vip.com/", type:"stock" },
  nikkei_morning:  { url:"https://indexes.nikkei.co.jp/en/nkave", type:"stock", parser:"nikkei" },
  hanoi_asean:     { url:"https://hanoiasean.com/", type:"lotto" },
  china_vip:       { url:"https://shenzhenindex.com/", type:"stock" },
  china_morning:   { url:"http://www.szse.cn/English/index.html", type:"stock", parser:"szse" },
  lao_tv:          { url:"https://lao-tv.com/", type:"lotto" },
  hangseng_vip:    { url:"https://hangsengvip.com/", type:"stock" },
  hangseng_morning:{ url:"https://www.hsi.com.hk/eng", type:"stock", parser:"hsi" },
  hanoi_hd:        { url:"https://xosohd.com/", type:"lotto" }
};

const HEADERS = {
  "user-agent":"Mozilla/5.0 AppleWebKit/537.36 Chrome/151 Safari/537.36",
  "accept":"text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
  "accept-language":"th-TH,th;q=0.9,en;q=0.8"
};

function textOnly(html){
 return html
   .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi," ")
   .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi," ")
   .replace(/<[^>]+>/g," ")
   .replace(/&nbsp;|&#160;/gi," ")
   .replace(/&amp;/gi,"&")
   .replace(/\s+/g," ")
   .trim();
}

function parseLotto(html){
 const t=textOnly(html);
 const all=t.match(/(?<!\d)\d{5}(?!\d)/g)||[];
 const five=all.find(x=>!/^20\d{3}$/.test(x))||"";
 if(!five) throw new Error("ไม่พบเลข 5 หลัก");
 return {type:"lotto",value:five,display:five,three:five.slice(-3),two:five.slice(-2)};
}
function pickIndex(t){
 const m=t.match(/(?<!\d)(\d{1,3}(?:,\d{3})+\.\d{2}|\d{4,6}\.\d{2})(?!\d)/);
 return m?m[1]:"";
}
function parseStock(html, parser){
 const t=textOnly(html);
 let seg=t;
 if(parser==="nikkei"){const p=t.search(/Nikkei Stock Average/i);if(p>=0)seg=t.slice(p,p+3000)}
 if(parser==="szse"){const p=t.search(/SHENZHEN\s+COMPONENT\s+INDEX/i);if(p>=0)seg=t.slice(p,p+3500)}
 if(parser==="hsi"){const p=t.search(/Hang Seng Index/i);if(p>=0)seg=t.slice(p,p+3500)}
 const value=pickIndex(seg);
 if(!value) throw new Error("ไม่พบค่าดัชนี");
 const change=(seg.match(/[+-]\d+(?:,\d{3})*(?:\.\d+)?(?:\s*\([+-]?\d+(?:\.\d+)?%\))?/)||[])[0]||"";
 return {type:"stock",value,display:value,change};
}

async function fetchOne(key,cfg){
 const ctrl=new AbortController();
 const timer=setTimeout(()=>ctrl.abort(),12000);
 try{
   const r=await fetch(cfg.url,{headers:HEADERS,redirect:"follow",signal:ctrl.signal});
   if(!r.ok)throw new Error("HTTP "+r.status);
   const html=await r.text();
   const parsed=cfg.type==="lotto" ? parseLotto(html) : parseStock(html,cfg.parser);
   return [key,{...parsed,source:cfg.url,ok:true}];
 }finally{clearTimeout(timer)}
}

(async()=>{
 const rows=await Promise.all(Object.entries(SOURCES).map(async ([key,cfg])=>{
   try{return await fetchOne(key,cfg)}
   catch(e){return [key,{type:cfg.type,source:cfg.url,ok:false,error:String(e.message||e)}]}
 }));
 const results=Object.fromEntries(rows);
 const out={
   updatedAt:new Date().toISOString(),
   successCount:Object.values(results).filter(v=>v.ok).length,
   total:Object.keys(SOURCES).length,
   results
 };
 fs.writeFileSync("results.json",JSON.stringify(out,null,2),"utf8");
 console.log(JSON.stringify(out,null,2));
})();