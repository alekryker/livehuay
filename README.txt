ไฟล์แก้ไขสำหรับ repo alekryker/livehuay

ต้องทับ 2 ไฟล์:
1) scraper.js
2) .github/workflows/update-results.yml

หลัง Commit:
Actions > Update live lottery results > Run workflow

เวอร์ชันนี้ใช้ Chromium/Playwright เปิดเว็บต้นทางจริงก่อนอ่านผล
เพราะเว็บ Lao Extra / Lao TV / Stocks VIP หลายเว็บโหลดข้อมูลด้วย JavaScript

หุ้น Nikkei / Shenzhen / Hang Seng มี Yahoo Finance fallback
ถ้าเว็บต้นทางบล็อก GitHub Actions

หน้า index.html และ results.json ไม่ต้องแก้
