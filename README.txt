GITHUB PAGES VERSION

ไฟล์หลัก
- index.html = หน้าเว็บ
- scraper.js = ดึงผลจากเว็บต้นทาง
- results.json = ผลล่าสุดที่หน้าเว็บอ่าน
- .github/workflows/update-results.yml = GitHub Actions ดึงผลอัตโนมัติทุก 5 นาที

วิธีใช้
1. สร้าง Repository บน GitHub
2. อัปโหลดไฟล์ทั้งหมดใน ZIP นี้
3. ไป Settings > Pages
4. Build and deployment เลือก Deploy from a branch
5. Branch เลือก main / root
6. ไป Actions แล้วเปิด workflow "Update live lottery results"
7. กด Run workflow ครั้งแรก
8. รอ GitHub Pages เปิดเว็บ

ข้อจำกัดสำคัญ
GitHub Pages เป็นเว็บ Static จึงไม่สามารถรัน Server Function ทุก 30 วินาทีได้
GitHub Actions schedule ทำได้ประมาณทุก 5 นาที (และอาจช้ากว่านั้นเล็กน้อย)
หน้าเว็บจะเช็ก results.json ทุก 30 วินาที แต่ข้อมูลต้นทางจะถูกอัปเดตโดย Action ทุก 5 นาที

ถ้าต้องการผลใกล้ Real-time 30 วินาทีจริง ใช้ Netlify Function / Cloudflare Worker / Cloud Run จะเหมาะกว่า
