# เปรียบเทียบ3รูปแบบ

ตารางเป็นการเปรียบเทียบรูปแบบสถาปัตยกรรมตาม PLAN ไม่ได้อ้างว่าได้benchmarkหรือเปิดsource2โปรเจกต์เดิม (ไม่พบในเครื่องนี้)

| มิติ          | Next.js full-stack          | React+Express Modular Monolith | ระบบนี้ Microservices                                     |
| ------------- | --------------------------- | ------------------------------ | --------------------------------------------------------- |
| Process       | frontend/serverรวมframework | SPA+1backend                   | SPA+Gateway+3backend                                      |
| DB            | ตามแอป                      | ปกติDBเดียว                    | 3ownedDB+owncredentials                                   |
| Communication | framework/serverfunctions   | in-processmodules              | internalREST/privateauth                                  |
| อ่านโค้ด      | ต้องรู้framework            | flowตรงและง่าย                 | flowตรงแต่ข้ามnetwork                                     |
| Deploy        | platformต้องรองรับNext      | static+Node                    | container/processhost+privatenetwork+MySQL                |
| Test          | fullstack/API               | API/DB/E2E                     | per-service+proxy+contracts+outages+3DB                   |
| Failure       | ขึ้นกับdeployment           | backendเสียกระทบรวม            | Authdownปิดprotected,AnalyticsdownปิดredirectGET baseline |
| ค่าใช้จ่าย    | ขึ้นกับhost                 | มักoperationsน้อยกว่า          | มีprocess/DB/networkมากขึ้น ไม่ระบุราคา                   |
| Interview     | rendering/API/data          | moduleboundaries               | ownership,idempotency,distributedfailure                  |

APIpathsและUIตามแผนช่วยเทียบfrontendโดยเปลี่ยนarchitecture. Microservicesไม่ทำให้เร็วหรือปลอดภัยโดยอัตโนมัติ; ต้องวัดและดูแลมากขึ้น
