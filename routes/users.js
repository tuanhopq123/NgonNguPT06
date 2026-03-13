var express = require("express");
var router = express.Router();

let { checkLogin } = require('../utils/authHandler');
// Lấy toàn bộ validator cần thiết
let { 
    userCreateValidator, 
    userUpdateValidator, 
    RegisterValidator, 
    ChangePasswordValidator, 
    handleResultValidator 
} = require('../utils/validatorHandler');

let userController = require("../controllers/users");
let bcrypt = require('bcrypt');
let jwt = require('jsonwebtoken');
let userModel = require('../schemas/users'); // Thay đổi đường dẫn model nếu cần cho khớp file của bạn

const fs = require('fs');
const path = require('path');
// Đọc khóa Private Key cho thuật toán RS256
const privateKey = fs.readFileSync(path.join(__dirname, '../private.pem'), 'utf8');

// ==========================================
// PHẦN 1: CÁC API XÁC THỰC (AUTH)
// Các đường dẫn cụ thể (/register, /login, /me) PHẢI nằm trên cùng
// ==========================================

router.post('/register', RegisterValidator, handleResultValidator, async function (req, res, next) {
    try {
        let newUser = userController.CreateAnUser(
            req.body.username,
            req.body.password,
            req.body.email,
            "69aa8360450df994c1ce6c4c" // ID mặc định của role, bạn có thể thay đổi
        );
        await newUser.save();
        res.send({ message: "dang ki thanh cong" });
    } catch (err) {
        res.status(400).send({ message: err.message });
    }
});

router.post('/login', async function (req, res, next) {
    let { username, password } = req.body;
    let getUser = await userController.FindByUsername(username);
    
    if (!getUser) {
        return res.status(403).send("tai khoan khong ton tai");
    } 
    if (getUser.lockTime && getUser.lockTime > Date.now()) {
        return res.status(403).send("tai khoan dang bi ban");
    }
    
    if (bcrypt.compareSync(password, getUser.password)) {
        await userController.SuccessLogin(getUser);
        // Ký token RS256
        let token = jwt.sign(
            { id: getUser._id },
            privateKey,
            { algorithm: 'RS256', expiresIn: '30d' }
        );
        res.json({ token: token });
    } else {
        await userController.FailLogin(getUser);
        res.status(403).send("thong tin dang nhap khong dung");
    }
});

// Phải đặt /me lên trước /:id để không bị lỗi CastError
router.get('/me', checkLogin, async function(req, res, next){
    try {
        let user = await userModel.findById(req.user.id);
        res.send(user);
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
});

router.post('/change-password', checkLogin, ChangePasswordValidator, handleResultValidator, async function(req, res, next) {
    try {
        let { oldpassword, newpassword } = req.body;
        
        let user = await userModel.findById(req.user.id); 
        if (!user) {
            return res.status(404).send("Không tìm thấy người dùng");
        }

        if (!bcrypt.compareSync(oldpassword, user.password)) {
            return res.status(400).send({ message: "Mật khẩu cũ không chính xác" });
        }

        // Schema đã có sẵn pre('save') băm mật khẩu, nên chỉ cần gán thẳng
        user.password = newpassword; 
        await user.save(); 
        
        res.send({ message: "Đổi mật khẩu thành công" });
    } catch (error) {
        res.status(500).send({ message: "Lỗi server: " + error.message });
    }
});


// ==========================================
// PHẦN 2: CÁC API QUẢN LÝ DỮ LIỆU CŨ (CRUD)
// ==========================================

router.get("/", checkLogin, async function (req, res, next) {
    let users = await userController.GetAllUser();
    res.send(users);
});

router.get("/:id", async function (req, res, next) {
    try {
        let result = await userModel.find({ _id: req.params.id, isDeleted: false });
        if (result.length > 0) {
            res.send(result);
        } else {
            res.status(404).send({ message: "id not found" });
        }
    } catch (error) {
        res.status(404).send({ message: "id not found" });
    }
});

router.post("/", userCreateValidator, handleResultValidator, async function (req, res, next) {
    try {
        let newItem = userController.CreateAnUser(
            req.body.username, req.body.password, req.body.email, req.body.fullName,
            req.body.avatarUrl, req.body.role, req.body.status, req.body.loginCount
        );
        await newItem.save();
        let saved = await userModel.findById(newItem._id);
        res.send(saved);
    } catch (err) {
        res.status(400).send({ message: err.message });
    }
});

router.put("/:id", userUpdateValidator, handleResultValidator, async function (req, res, next) {
    try {
        let id = req.params.id;
        let updatedItem = await userModel.findByIdAndUpdate(id, req.body, { new: true });
        if (!updatedItem) return res.status(404).send({ message: "id not found" });
        let populated = await userModel.findById(updatedItem._id);
        res.send(populated);
    } catch (err) {
        res.status(400).send({ message: err.message });
    }
});

router.delete("/:id", async function (req, res, next) {
    try {
        let id = req.params.id;
        let updatedItem = await userModel.findByIdAndUpdate(
            id, { isDeleted: true }, { new: true }
        );
        if (!updatedItem) return res.status(404).send({ message: "id not found" });
        res.send(updatedItem);
    } catch (err) {
        res.status(400).send({ message: err.message });
    }
});

module.exports = router;