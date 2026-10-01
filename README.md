# VidOmni AI Studio Pro — Cloud License Server (Vercel)

Hệ thống máy chủ Serverless phân phối bản quyền Ed25519 và quản lý Machine ID cho **VidOmni AI Studio Pro v2.0**, triển khai trên nền tảng **Vercel** (`https://vercel.com/prohacker20142015-2906`) và cơ sở dữ liệu **Upstash Redis / Vercel KV** hoàn toàn miễn phí.

---

## 1. Các Tính Năng Cốt Lõi

1. **Bảng Quản Trị Trực Quan (Admin Portal - `/admin`)**:
   - Đăng nhập bảo mật bằng mật khẩu quản trị (`ADMIN_PASSWORD`).
   - Thống kê thời gian thực: Tổng số key, số máy đang online, số key chưa kích hoạt, số key bị khóa / hết hạn.
   - Tạo mã bản quyền 1-Click: Chọn gói (Standard, Pro, VIP), thời hạn (3 ngày, 1 tháng, 3 tháng, 1 năm, Trọn đời), số tài khoản Google tối đa, số luồng render song song.
   - Thao tác nhanh cho từng khách hàng:
     - **Copy Key 1-Click**.
     - **Thu hồi / Khóa (Revoke)**: Vô hiệu hóa ngay lập tức phần mềm của khách hàng vi phạm.
     - **Reset Mã Máy (Machine ID)**: Cho phép khách hàng chuyển bản quyền sang máy tính mới khi đổi máy.
     - **Gia hạn (Extend)**: Thêm 30, 60, 90 ngày sử dụng cho khách hàng đã thanh toán.
2. **Serverless REST API**:
   - `POST /api/license/activate`: Desktop App gửi Machine ID + License Key lên Vercel -> Vercel kiểm tra trong Redis, khóa vào Machine ID và ký số token Ed25519 trả về lưu vào két sắt Windows DPAPI.
   - `POST /api/license/verify`: Desktop App kiểm tra định kỳ (Heartbeat) xem key có bị Admin bấm nút Revoke trên web hay không.
3. **Cơ Chế Bảo Mật Tối Cao**:
   - Server Vercel giữ **Khóa Bí Mật Ed25519 (`VENDOR_PRIVATE_KEY`)** để ký token.
   - Khách hàng và Desktop Client chỉ giữ **Khóa Công Khai (`VENDOR_PUBLIC_KEY`)** để xác thực, tuyệt đối không thể làm giả bản quyền dù có decompile phần mềm.

---

## 2. Hướng Dẫn Triển Khai Lên Vercel (Trong 2 Phút)

### Bước 1: Đẩy mã nguồn lên GitHub
1. Tạo một repository mới trên GitHub của bạn (ví dụ đặt tên: `vidomni-license-server`).
2. Tải toàn bộ nội dung trong thư mục `license-server` này lên repo GitHub đó.

### Bước 2: Nhập vào Vercel (`prohacker20142015-2906`)
1. Truy cập: [https://vercel.com/prohacker20142015-2906](https://vercel.com/prohacker20142015-2906)
2. Bấm nút **"Add New..."** -> Chọn **"Project"**.
3. Chọn Repository `vidomni-license-server` vừa tạo từ GitHub -> Bấm **"Import"**.

### Bước 3: Thêm Cơ Sở Dữ Liệu Upstash Redis Miễn Phí (1 Click)
1. Trong màn hình cấu hình trước khi Deploy (hoặc trong tab **Storage** của Project trên Vercel):
2. Chọn **"Storage"** -> Chọn **"Upstash Redis"** (hoặc **Vercel KV**) -> Bấm **"Create Database"**.
3. Vercel sẽ tự động điền các biến môi trường:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
4. Trong mục **Environment Variables**, thêm biến:
   - `ADMIN_PASSWORD`: Mật khẩu đăng nhập Admin của bạn (Ví dụ: `matkhaucuaban@123`).
5. Bấm **"Deploy"**!

---

## 3. Cách Kết Nối Desktop App Với Vercel Server

Sau khi deploy, Vercel sẽ cấp cho bạn một tên miền miễn phí dạng:
👉 `https://vidomni-license-server.vercel.app` (hoặc tên miền tùy chỉnh của bạn).

Bạn chỉ cần mở file cấu hình của Desktop App hoặc nhập domain Vercel vào để ứng dụng tự động kích hoạt trực tuyến!
