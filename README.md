# HideBox - Chrome Extension MV3

> **Ẩn Khung DIV Theo Domain** - Cho phép người dùng chọn và ẩn các phần tử DOM không mong muốn trên website, với cấu hình lưu trữ theo domain.

## 🎯 Tính năng chính

- **🎯 Chế độ chọn phần tử**: Bật/tắt bằng icon popup hoặc phím tắt `Alt+X`
- **👁️ Ẩn/hiện ngay lập tức**: Phần tử được chọn sẽ ẩn ngay, có thể undo trước khi lưu
- **🌐 Lưu theo domain**: Cấu hình được lưu theo hostname, không phụ thuộc đường dẫn
- **🔄 Áp dụng tự động**: Tự động ẩn phần tử khi truy cập bất kỳ trang nào trong cùng domain
- **⚙️ Quản lý danh sách**: Popup cho phép bật/tắt, sửa ghi chú, xóa từng rule
- **📤📥 Xuất/Nhập**: Backup và restore toàn bộ cấu hình
- **😴 Tạm thời vô hiệu**: Snooze domain trong 5/15/60 phút
- **🌍 Hỗ trợ subdomain**: Tuỳ chọn áp dụng cho tất cả subdomain

## 🚀 Cài đặt

### Từ Chrome Web Store
*(Sẽ cập nhật khi extension được publish)*

### Cài đặt thủ công (Developer Mode)

1. **Clone repository**:
   ```bash
   git clone https://github.com/nghiaomg/HideBox.git
   cd HideBox
   ```

2. **Mở Chrome Extension Manager**:
   - Vào `chrome://extensions/`
   - Bật **Developer mode** (góc phải trên)

3. **Load extension**:
   - Click **Load unpacked**
   - Chọn thư mục `HideBox`
   - Extension sẽ xuất hiện trong thanh công cụ

## 📖 Hướng dẫn sử dụng

### Chọn phần tử để ẩn

1. **Bật chế độ chọn**:
   - Click icon HideBox trên toolbar
   - Bấm **"Bật chế độ chọn"** hoặc phím `Alt+X`

2. **Chọn phần tử**:
   - Di chuột để highlight phần tử
   - **Click** để chọn phần tử
   - **Shift+Click** để chọn phần tử cha
   - **Ctrl+Click** để bỏ chọn

3. **Lưu cấu hình**:
   - Bấm **Enter** để lưu tất cả phần tử đã chọn
   - Hoặc **Escape** để hủy

### Quản lý rules

- **Bật/Tắt rule**: Click icon mắt bên cạnh rule
- **Sửa ghi chú**: Click icon bút chì
- **Xóa rule**: Click icon thùng rác
- **Xóa tất cả**: Bấm **"Xóa tất cả"** (cần xác nhận)

### Phím tắt

- `Alt+X`: Bật/tắt chế độ chọn
- `Alt+Z`: Snooze domain hiện tại
- `Ctrl+U`: Undo selection gần nhất (trong chế độ chọn)
- `Enter`: Lưu selections (trong chế độ chọn)
- `Escape`: Thoát chế độ chọn

## ⚙️ Cấu hình nâng cao

### Subdomain Support
- Bật **"Áp dụng cho tất cả subdomain"** để rules hoạt động trên `*.domain.com`
- Ví dụ: Rule cho `example.com` sẽ áp dụng cho `www.example.com`, `m.example.com`

### Xuất/Nhập cấu hình
- **Xuất**: Tải file JSON chứa toàn bộ rules
- **Nhập**: Upload file JSON để restore cấu hình
- Hữu ích cho backup hoặc chia sẻ giữa nhiều máy

### Snooze Domain
- Tạm thời vô hiệu hóa extension cho domain hiện tại
- Chọn thời gian: 5, 15, hoặc 60 phút
- Tự động khôi phục sau khi hết thời gian

## 🔧 Cách hoạt động

### Selector Generation
Extension tạo CSS selector ổn định theo thứ tự ưu tiên:

1. **Unique ID** (`#element-id`)
2. **Stable attributes** (`[data-attr="value"]`)
3. **Class combinations** (`.class1.class2`)
4. **Structural path** (`div > .container > span:nth-of-type(2)`)
5. **Position fallback** (`div:nth-of-type(3)`)

### Auto-Apply Rules
- **MutationObserver** theo dõi thay đổi DOM
- Tự động áp dụng rules khi có phần tử mới
- Hỗ trợ Single Page Applications (SPA)

### Storage
- **Chrome Sync Storage**: Đồng bộ rules giữa các thiết bị
- **Local Storage**: Lưu trạng thái snooze tạm thời
- **Format**: JSON có thể đọc được và backup

## 🛡️ Bảo mật & Quyền riêng tư

- **Không thu thập dữ liệu**: Chỉ lưu selectors do người dùng tạo
- **Local storage**: Tất cả dữ liệu ở máy người dùng
- **Quyền tối thiểu**: Chỉ yêu cầu quyền cần thiết:
  - `activeTab`: Thao tác với tab hiện tại
  - `scripting`: Inject scripts khi cần
  - `storage`: Lưu cấu hình
  - `tabs`: Đọc hostname

## 🐛 Xử lý sự cố

### Phần tử tái xuất hiện
- **Nguyên nhân**: Selector không ổn định do thay đổi DOM
- **Giải pháp**: Chọn lại phần tử với selector tốt hơn (ưu tiên ID, data-attributes)

### Không highlight được
- **Nguyên nhân**: Trang có overlay che phủ
- **Giải pháp**: Thử refresh trang hoặc sử dụng Shift+Click

### SPA không hoạt động
- **Nguyên nhân**: Route thay đổi client-side
- **Giải pháp**: Extension tự động detect và áp lại rules

### Performance
- Extension được tối ưu để không ảnh hưởng hiệu năng trang
- Giới hạn số lượng rules và sử dụng CSS thay vì JavaScript để ẩn

## 📝 Changelog

### v1.0.0 (2024-XX-XX)
- 🎉 Phiên bản đầu tiên
- ✨ Chế độ chọn phần tử với overlay
- 🎯 Tạo selector ổn định
- 💾 Lưu trữ theo domain
- 🔄 Auto-apply với MutationObserver
- 📤📥 Xuất/nhập cấu hình
- 😴 Snooze domain
- ⌨️ Phím tắt

## 🤝 Đóng góp

1. Fork repository
2. Tạo feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Mở Pull Request

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

## 🆘 Hỗ trợ

- **Issues**: [GitHub Issues](https://github.com/yourusername/HideBox/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/HideBox/discussions)
- **Email**: your.email@example.com

## ⭐ Roadmap

- [ ] **Smart Selector Scoring**: Tính điểm độ ổn định cho selector
- [ ] **Rule Templates**: Template có sẵn cho các site phổ biến
- [ ] **Responsive Rules**: Ẩn theo kích thước màn hình
- [ ] **Advanced Filtering**: Lọc theo text content, thuộc tính
- [ ] **Rule Groups**: Nhóm rules theo chức năng
- [ ] **Cross-browser Support**: Hỗ trợ Firefox, Edge

---

**Made with ❤️ by [Your Name]**
