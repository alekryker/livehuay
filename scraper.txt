// scraper.js
// เวอร์ชันแก้ไข: ใช้ Playwright เปิดเว็บจริงเพื่อให้ JavaScript โหลดผลก่อน
// หุ้นมี Yahoo Finance fallback ถ้าเว็บต้นทางบล็อก GitHub Actions

const fs = require("fs");
const { chromium } = require("playwright");

const SOURCES = {
  lao_extra:       { url:"https://laoextra.com/", type:"lotto" },
  nikkei_vip:      { url:"https://stocks-vip.com/", type:"stock", symbol:"^N225", hint:/Nikkei/i },
  nikkei_morning:  { url:"https://indexes.nikkei.co.jp/en/nkave", type:"stock", symbol:"^N225", hint:/Nikkei Stock Average|Nikkei 225/i },
  hanoi_asean:     { url:"https://hanoiasean.com/", type:"lotto" },
  china_vip:       { url:"https://shenzhenindex.com/", type:"stock", symbol:"399001.SZ", hint:/SZSE COMPONENT INDEX|Shenzhen/i },
  china_morning:   { url:"https://www.szse.cn/English/index.html", type:"stock", symbol:"399001.SZ", hint:/SHENZHEN COMPONENT INDEX|Component Index/i },
  lao_tv:          { url:"https://lao-tv.com/", type:"lotto" },
  hangseng_vip:    { url:"https://hangsengvip.com/", type:"stock", symbol:"^HSI", hint:/Hang Seng Index/i },
  hangseng_morning:{ url:"https://www.hsi.com.hk/eng/", type:"stock", symbol:"^HSI", hint:/Hang Seng Index/i },
  hanoi_hd:        { url:"https://xosohd.com/", type:"lotto" }
};

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function clean(s="") {
  return String(s)
    .replace(/\u00a0/g," ")
    .replace(/[\t\r]+/g," ")
    .replace(/ +/g," ")
    .replace(/\n{3,}/g,"\n\n")
    .trim();
}

function validFive(x){
  if(!/^\d{5}$/.test(x)) return false;
  if(/^20\d{3}$/.test(x)) return false;
  return true;
}

function parseLotto(text, html="") {
  const t = clean(text + "\n" + html.replace(/<[^>]+>/g," "));

  const fiveAll = [...t.matchAll(/(?<!\d)(\d{5})(?!\d)/g)]
    .map(m=>m[1])
    .filter(validFive);

  const five = [...new Set(fiveAll)];
  if(!five.length) throw new Error("ไม่พบเลขผล 5 หลักหลัง render JavaScript");

  const top5 = five[0];
  let bottom2 = "";

  const bottomPatterns = [
    /(?:2\s*โต(?:ลุ่ม|ລຸ່ມ)|2\s*ตัวล่าง|สองตัวล่าง|bottom)\D{0,25}(\d{2})(?!\d)/i,
    /(?:ล่าง|ລຸ່ມ)\D{0,18}(\d{2})(?!\d)/i
  ];

  for(const re of bottomPatterns){
    const m=t.match(re);
    if(m){ bottom2=m[1]; break; }
  }

  // ฮานอยหลายเว็บแสดงเลข 5 หลักชุดบน + ชุดล่าง
  if(!bottom2 && five.length >= 2) bottom2 = five[1].slice(-2);

  // fallback สุดท้าย
  if(!bottom2) bottom2 = top5.slice(-2);

  return {
    type:"lotto",
    value:top5,
    display:top5,
    three:top5.slice(-3),
    two:bottom2
  };
}

function pickStockNumber(segment){
  const hits = [...segment.matchAll(/(?<!\d)(\d{1,3}(?:,\d{3})+\.\d{2}|\d{4,6}\.\d{2})(?!\d)/g)]
    .map(m=>m[1]);
  return hits[0] || "";
}

function stockResult(value, change=""){
  const raw=String(value).replace(/,/g,"");
  const [intPart,decPart=""] = raw.split(".");
  const digits=intPart.replace(/\D/g,"");

  return {
    type:"stock",
    value:String(value),
    display:String(value),
    change,
    three:digits.slice(-3).padStart(3,"0"),
    two:(decPart+"00").slice(0,2)
  };
}

function parseStock(text, cfg){
  const t=clean(text);
  let segment=t;

  if(cfg.hint){
    const pos=t.search(cfg.hint);
    if(pos>=0) segment=t.slice(pos,pos+5000);
  }

  const value=pickStockNumber(segment);
  if(!value) throw new Error("ไม่พบค่าดัชนีหลัง render JavaScript");

  const change=(segment.match(/[+-]\d+(?:,\d{3})*(?:\.\d+)?(?:\s*\([+-]?\d+(?:\.\d+)?%\))?/)||[])[0]||"";
  return stockResult(value,change);
}

async function yahooStock(symbol){
  const url=`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1m&range=1d`;

  const r=await fetch(url,{
    headers:{
      "user-agent":UA,
      "accept":"application/json"
    }
  });

  if(!r.ok) throw new Error(`Yahoo HTTP ${r.status}`);

  const j=await r.json();
  const result=j?.chart?.result?.[0];

  if(!result) throw new Error("Yahoo ไม่มีข้อมูลดัชนี");

  const meta=result.meta||{};
  const value=Number(meta.regularMarketPrice ?? meta.chartPreviousClose);

  if(!Number.isFinite(value)) throw new Error("Yahoo ไม่มีราคาปัจจุบัน");

  const prev=Number(meta.previousClose ?? meta.chartPreviousClose);
  const change=Number.isFinite(prev)
    ? `${value-prev>=0?"+":""}${(value-prev).toFixed(2)}`
    : "";

  return stockResult(
    value.toLocaleString("en-US",{
      minimumFractionDigits:2,
      maximumFractionDigits:2
    }),
    change
  );
}

async function renderPage(browser,cfg){
  const context=await browser.newContext({
    userAgent:UA,
    locale:"th-TH",
    timezoneId:"Asia/Bangkok",
    ignoreHTTPSErrors:true,
    viewport:{width:1440,height:1000}
  });

  const page=await context.newPage();

  try{
    await page.goto(cfg.url,{
      waitUntil:"domcontentloaded",
      timeout:30000
    });

    // รอ AJAX / Vue / React / API ของเว็บต้นทาง
    await page.waitForTimeout(7000);

    try{
      await page.waitForLoadState("networkidle",{timeout:5000});
    }catch{}

    const text=await page.locator("body").innerText({timeout:10000}).catch(()=>"");
    const html=await page.content();

    return {
      text,
      html,
      finalUrl:page.url()
    };
  } finally {
    await context.close();
  }
}

async function scrapeOne(browser,key,cfg){
  let browserError="";

  try{
    const page=await renderPage(browser,cfg);

    const parsed=cfg.type==="lotto"
      ? parseLotto(page.text,page.html)
      : parseStock(page.text,cfg);

    return [key,{
      ...parsed,
      source:cfg.url,
      finalUrl:page.finalUrl,
      method:"browser",
      ok:true
    }];
  }catch(e){
    browserError=String(e.message||e);
  }

  // หุ้นใช้ Yahoo สำรองได้
  if(cfg.type==="stock" && cfg.symbol){
    try{
      const parsed=await yahooStock(cfg.symbol);

      return [key,{
        ...parsed,
        source:cfg.url,
        method:"yahoo-fallback",
        warning:browserError,
        ok:true
      }];
    }catch(e){
      return [key,{
        type:cfg.type,
        source:cfg.url,
        ok:false,
        error:`browser: ${browserError}; fallback: ${String(e.message||e)}`
      }];
    }
  }

  return [key,{
    type:cfg.type,
    source:cfg.url,
    ok:false,
    error:browserError
  }];
}

(async()=>{
  let browser;

  try{
    browser=await chromium.launch({
      headless:true,
      args:[
        "--no-sandbox",
        "--disable-dev-shm-usage"
      ]
    });

    const rows=[];

    // ทำทีละเว็บ เพื่อใช้ RAM น้อยลงและลดการโดน block
    for(const [key,cfg] of Object.entries(SOURCES)){
      console.log(`\n=== ${key} ===`);

      const row=await scrapeOne(browser,key,cfg);
      rows.push(row);

      console.log(row[1]);
    }

    const results=Object.fromEntries(rows);

    const out={
      updatedAt:new Date().toISOString(),
      successCount:Object.values(results).filter(v=>v.ok).length,
      total:Object.keys(SOURCES).length,
      results
    };

    fs.writeFileSync(
      "results.json",
      JSON.stringify(out,null,2),
      "utf8"
    );

    console.log("\nFINAL");
    console.log(JSON.stringify(out,null,2));

  } finally {
    if(browser) await browser.close();
  }

})().catch(err=>{
  console.error(err);
  process.exit(1);
});
