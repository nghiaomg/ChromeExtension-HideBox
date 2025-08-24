# HideBox - Chrome Extension MV3

> **Ẩn Khung DIV Theo Domain** - Cho phép người dùng chọn và ẩn các phần tử DOM không mong muốn trên website, với cấu hình lưu trữ theo domain.

## 🎯 Tính năng chính

- **🎯 Chế độ chọn phần tử**: Bật/tắt bằng icon popup hoặc phím tắt `Alt+X`
- **👁️ Lưu và ẩn tức thì**: Phần tử được chọn sẽ lưu và ẩn ngay lập tức theo domain
- **🌐 Lưu theo domain**: Cấu hình được lưu theo hostname, không phụ thuộc đường dẫn
- **🔄 Áp dụng tự động**: Tự động ẩn phần tử khi truy cập bất kỳ trang nào trong cùng domain
- **🛡️ Iframe Protection**: Chặn redirect khi click iframe quảng cáo, cho phép ẩn iframe an toàn
- **⚙️ Quản lý danh sách**: Popup cho phép bật/tắt, sửa ghi chú, xóa từng rule
- **📤📥 Xuất/Nhập**: Backup và restore toàn bộ cấu hình
- **😴 Tạm thời vô hiệu**: Snooze domain trong 5/15/60 phút
- **🌍 Hỗ trợ subdomain**: Tuỳ chọn áp dụng cho tất cả subdomain
- **⌨️ Phím tắt toàn diện**: ESC để thoát, Ctrl+U để undo, với multiple event listeners

## 🚀 Cài đặt

### Từ Chrome Web Store
*(Sẽ cập nhật khi extension được publish)*

### Cài đặt thủ công (Developer Mode)

1. **Clone repository**:
   ```bash
   git clone https://github.com/nghiaomg/ChromeExtension-HideBox.git
   cd ChromeExtension-HideBox
   ```

2. **Mở Chrome Extension Manager**:
   - Vào `chrome://extensions/`
   - Bật **Developer mode** (góc phải trên)

3. **Load extension**:
   - Click **Load unpacked**
   - Chọn thư mục `ChromeExtension-HideBox`
   - Extension sẽ xuất hiện trong thanh công cụ

## 📖 Hướng dẫn sử dụng

### Chọn phần tử để ẩn

1. **Bật chế độ chọn**:
   - Click icon HideBox trên toolbar
   - Bấm **"Bật chế độ chọn"** hoặc phím `Alt+X`

2. **Chọn phần tử**:
   - Di chuột để highlight phần tử
   - **Click** để chọn và lưu ngay lập tức
   - **Shift+Click** để chọn phần tử cha
   - **Ctrl+Click** để bỏ chọn và xóa khỏi storage
   - **🛡️ Iframe**: Click vào iframe quảng cáo sẽ được chặn redirect và chọn an toàn

3. **Thoát chế độ chọn**:
   - Bấm **Escape** để thoát chế độ chọn
   - Hoặc click icon HideBox lần nữa

### Quản lý rules

- **Bật/Tắt rule**: Click icon mắt bên cạnh rule
- **Sửa ghi chú**: Click icon bút chì
- **Xóa rule**: Click icon thùng rác
- **Xóa tất cả**: Bấm **"Xóa tất cả"** (cần xác nhận)

### Phím tắt

- `Alt+X`: Bật/tắt chế độ chọn
- `Alt+Z`: Snooze domain hiện tại
- `Ctrl+U`: Undo selection gần nhất (trong chế độ chọn)
- `Escape`: Thoát chế độ chọn (với multiple event listeners để đảm bảo luôn hoạt động)
- `Enter`: Thoát chế độ chọn (vì phần tử đã được lưu tự động)

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

### 🛡️ Iframe Protection System
Extension có hệ thống bảo vệ toàn diện chống iframe redirect:

1. **Global Protection**: Khi bật selection mode, tất cả iframe được cover bởi transparent overlay
2. **Event Blocking**: `stopImmediatePropagation()` chặn triệt để event propagation
3. **Visual Feedback**: Red border animation khi click iframe để xác nhận đã chặn redirect
4. **Auto Cleanup**: Tự động restore iframe functionality khi tắt selection mode
5. **Safe Selection**: Iframe được chọn như element bình thường mà không trigger redirect

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

### Iframe redirect khi click
- **Nguyên nhân**: Iframe quảng cáo có event listener redirect
- **Giải pháp**: ✅ **Đã fix** - Extension tự động chặn redirect và bảo vệ tất cả iframe khi ở selection mode

### Phím ESC không hoạt động
- **Nguyên nhân**: Trang web chặn hoặc override keyboard events
- **Giải pháp**: ✅ **Đã fix** - Multiple event listeners (document, window, body) + global backup listener

### Popup không kết nối được với content script
- **Nguyên nhân**: Content script chưa được inject khi popup load
- **Giải pháp**: ✅ **Đã fix** - Auto-inject content script với ping/pong mechanism

### SPA không hoạt động
- **Nguyên nhân**: Route thay đổi client-side
- **Giải pháp**: Extension tự động detect và áp lại rules với MutationObserver

### Performance
- Extension được tối ưu để không ảnh hưởng hiệu năng trang
- Sử dụng CSS `display: none !important` thay vì JavaScript manipulation
- Debounced MutationObserver để tránh excessive processing

## 📝 Changelog

### v1.0.0 (2025-08-25)
- 🎉 Phiên bản đầu tiên
- ✨ Chế độ chọn phần tử với overlay và tooltip thông tin
- 🎯 Tạo selector ổn định với 5 strategies (ID → attributes → classes → structure → position)
- 💾 Lưu tức thì theo domain (click = save ngay lập tức)
- 🔄 Auto-apply với MutationObserver cho SPA support
- 🛡️ **Iframe Protection**: Chặn redirect iframe quảng cáo hoàn toàn
- 📤📥 Xuất/nhập cấu hình JSON với metadata
- 😴 Snooze domain với auto-cleanup
- ⌨️ **Enhanced Keyboard**: Multiple ESC listeners + global backup
- 🔗 **Connection Reliability**: Auto-inject content script với ping/pong
- 🎨 Modern UI với animations và visual feedback

## 🤝 Đóng góp

1. Fork repository
2. Tạo feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Mở Pull Request

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

## 🆘 Hỗ trợ

- **Issues**: [GitHub Issues](https://github.com/nghiaomg/ChromeExtension-HideBox/issues)
- **Discussions**: [GitHub Discussions](https://github.com/nghiaomg/ChromeExtension-HideBox/discussions)
- **Email**: your.email@example.com

## ⭐ Roadmap

### 🔥 Đã hoàn thành v1.0.0
- [x] **Iframe Protection**: Chặn redirect iframe quảng cáo
- [x] **Enhanced ESC handling**: Multiple listeners để đảm bảo luôn hoạt động
- [x] **Auto-save on click**: Lưu tức thì khi chọn phần tử
- [x] **Connection reliability**: Auto-inject content script
- [x] **Visual feedback**: Animations và notifications

### 🚀 Tính năng tương lai
- [ ] **Smart Selector Scoring**: Tính điểm độ ổn định cho selector
- [ ] **Rule Templates**: Template có sẵn cho các site phổ biến (YouTube ads, Facebook sidebar, etc.)
- [ ] **Responsive Rules**: Ẩn theo kích thước màn hình
- [ ] **Advanced Filtering**: Lọc theo text content, thuộc tính
- [ ] **Rule Groups**: Nhóm rules theo chức năng (ads, social, navigation)
- [ ] **Cross-browser Support**: Hỗ trợ Firefox, Edge
- [ ] **Cloud Sync**: Đồng bộ rules qua Google Drive/Dropbox
- [ ] **Rule Sharing**: Chia sẻ rules giữa users

---

**Made with ❤️ by [Your Name]**
