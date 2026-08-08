const express = require("express");
const router = express.Router();
const userSchema  = require("../models/User");
const bcrypt = require("bcrypt");

const {
    generateSecureCode,
    sendVerificationEmail,
} = require("../services/mail");

// Stores verification in memory
let verificationCode = null;
let resentTimes = 0;

const EMAIL = process.env.EMAIL_USER_RECIPENT;

router.post("/", async (req, res, next) => {
    try {
        const { userRole, newPassword } = req.body;

        const passwordHash = await bcrypt.hash(newPassword, 10);

        const update =
            userRole === "admin"
                ? { adminPasswordHash: passwordHash }
                : { warehousePasswordHash: passwordHash };

        await userSchema.updateOne(
            { _id: "auth" },
            update
        );

        return res.status(200).json({
            success: true,
            user: { role: userRole }, 
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({
            error: err.message,
        });
    }
});



// POST /api/password-reset/send-code
router.post("/send-code", async (req, res, next) => {
    try {
        const { role } = req.body;
        resentTimes = resentTimes + 1;
        if (resentTimes > 3){
             return res.status(500).json({
            error: "Only allow three times resend.",
        });
        }
        console.log("Sending verification code to:", EMAIL);
        const code = generateSecureCode();
        console.log("Generated verification code:", code);

        verificationCode = code;

        await sendVerificationEmail(EMAIL, code, role);
        await setTimeout(()=>{}, 1000)
        console.log("Verification code sent successfully to:", EMAIL);

        res.json({
            success: true,
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({
            error: err.message,
        });
    }
});

// POST /api/password-reset/verify-code
router.post("/verify-code", (req, res) => {
    const { code } = req.body;

    if (!code) {
        return res.status(400).json({
            message: "Verification code is required.",
        });
    }

    if (!verificationCode) {
        return res.status(400).json({
            message: "No active verification request.",
        });
    }


    if (verificationCode !== code) {
        return res.status(400).json({
            message: "Invalid verification code.",
        });
    }

    verificationCode = null;

    res.json({
        success: true,
    });
});

module.exports = router;