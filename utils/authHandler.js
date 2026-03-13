const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

// Đọc file Public Key
const publicKey = fs.readFileSync(path.join(__dirname, '../public.pem'), 'utf8');

module.exports = {
    checkLogin: function (req, res, next) {
        // Lấy token từ header Authorization (Bearer token)
        let token = req.headers.authorization?.split(" ")[1] || req.headers.token;
        if (!token) {
            return res.status(401).send("Vui lòng đăng nhập");
        }

        try {
            // Xác thực bằng Public Key và thuật toán RS256
            let decoded = jwt.verify(token, publicKey, { algorithms: ['RS256'] });
            req.user = decoded; // Gắn thông tin giải mã vào req để dùng cho các API sau
            next();
        } catch (error) {
            res.status(401).send("Token không hợp lệ hoặc đã hết hạn");
        }
    }
}