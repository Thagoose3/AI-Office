# ไฟล์บทบาทของทีม AI

ก๊อปโฟลเดอร์ `template/.office` และ `template/.review` ไปไว้ในโปรเจกต์ของคุณ แล้วแก้ `project.md` ให้ตรงโปรเจกต์

```
คุณ → PM (Claude) → ก๊อป "คำสั่งจาก PM" → แชทกลาง (Antigravity) → dev / ui / tester (subagent)
ถ้า Claude หมดโควต้า → ใช้แชท PM สำรองใน Antigravity แทน
```

ตั้งครั้งเดียว:
- Claude (PM): `นายคือ role "pm" (PM หลัก) ของโปรเจกต์ที่ <path> อ่าน .office/roles/pm.md แล้วทำตามนั้น`
- Antigravity แชทกลาง: `นายคือแชทกลาง อ่าน .office/roles/lead.md แล้วทำตามนั้น`
- Antigravity แชท PM สำรอง: `นายคือ PM สำรอง อ่าน .office/roles/pm.md แล้วทำตามนั้น`
