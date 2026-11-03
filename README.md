# vvh_db · Hồ sơ cá nhân Vũ Văn Hiếu

Trang hồ sơ của Vũ Văn Hiếu, sinh viên ngành Hệ thống thông tin quản lý, Đại học Giao thông Vận tải. Đây là bài giữa kỳ môn Lập trình Web, làm bằng HTML, CSS và JavaScript thuần, không dùng framework hay bước build.

**Xem trang:** https://vuhieu020304-creator.github.io/Portfolio/

## Ý tưởng

Cả trang được trình bày như một phần mềm cơ sở dữ liệu tên `vvh_db`, mỗi mục là một bảng dữ liệu:

- Màn khởi động giả lập kết nối qua terminal, sau đó 7 bảng xoay trên một quỹ đạo.
- Bộ lọc kỹ năng là mệnh đề `WHERE`, nút `\x` chuyển giữa dạng thẻ và dạng bảng như trong psql.
- Form liên hệ là một câu lệnh `INSERT`, tự cập nhật theo nội dung bạn gõ.
- Lật ảnh hồ sơ để đổi giao diện sáng/tối. Âm thanh được tạo bằng Web Audio API.

## Cách chạy

Trang chỉ gồm file tĩnh, nên có thể chạy bằng một máy chủ tĩnh bất kỳ:

```
git clone https://github.com/vuhieu020304-creator/Portfolio.git
cd Portfolio
python -m http.server 8000
```

Sau đó mở http://localhost:8000. Nếu mở thẳng `index.html`, trang vẫn chạy nhưng icon kỹ năng không đổi sang màu thương hiệu khi rê chuột.

## Ghi nguồn

- [React Bits](https://reactbits.dev): hiệu ứng quỹ đạo, chữ tự gõ, thẻ lật, chuyển sang JavaScript thuần. Giấy phép: [LICENSES/react-bits.md](LICENSES/react-bits.md).
- [Animate UI](https://animate-ui.com/docs/backgrounds/glyph): nền chữ động Glyph, chuyển sang JavaScript thuần. Giấy phép: [LICENSES/animate-ui.md](LICENSES/animate-ui.md).
- [Simple Icons](https://simpleicons.org): icon công nghệ (CC0). Các icon SQL, Office, MOS, Canva và mũ tốt nghiệp là tự vẽ.

Bản v1 của trang được giữ ở tag [`v1`](https://github.com/vuhieu020304-creator/Portfolio/tree/v1).
