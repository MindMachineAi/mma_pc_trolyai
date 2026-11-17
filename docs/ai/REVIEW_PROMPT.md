# Review (chỉ đọc, KHÔNG sửa file)
Phạm vi: git diff origin/main...HEAD, đối chiếu spec trong lệnh và CLAUDE.md.
Kiểm: đủ/đúng từng mục spec và nghiệm thu; bảo mật (lộ bí mật, xác thực session/device token, rate limit, kiểm đầu vào bằng zod);
lệnh từ xa (chỉ trong ALLOWED_COMMANDS, có handler tương ứng trong apps/agent/executor.py, cần người dùng xác nhận);
quy ước dự án (Conventional Commits, tiếng Việt ở UI); biến môi trường mới có trong .env.example;
không thêm package ngoài spec, không file rác; lỗi kiểu và lỗi logic rõ ràng.
Định dạng (mỗi dòng file:dòng + lý do):
## PHẢI SỬA
## CẦN QUYẾT ĐỊNH (câu hỏi + phương án đề xuất)
## NÊN SỬA
## KẾT LUẬN: ĐẠT hoặc CHƯA ĐẠT
