import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "@fontsource/noto-sans-thai/400.css";
import "@fontsource/noto-sans-thai/500.css";
import "@fontsource/noto-sans-thai/600.css";
import "@fontsource/noto-sans-thai/700.css";
import "@fontsource/poppins/600.css";
import "@fontsource/poppins/700.css";
import "./styles/global.css";
import { App } from "./App";
// index.html โหลดไฟล์นี้ → หา div#root → ให้ React เริ่มแสดง App; ! บอก TypeScript ว่า root ไม่เป็น null
ReactDOM.createRoot(document.getElementById("root")!).render(
  // StrictMode ช่วยตรวจการทำงานในโหมดพัฒนา; อาจเรียก Render/Effect เพิ่มเพื่อหาปัญหา Cleanup
  <React.StrictMode>
    {/* BrowserRouter ให้ App ใช้ path, navigate และ Routes เลือก Page; ไม่ได้เรียก Backend ตาม path หน้าจอเอง */}
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);  
