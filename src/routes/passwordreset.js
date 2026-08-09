const express = require("express");
const router = express.Router();
const userSchema  = require("../models/User");
const bcrypt = require("bcrypt");
const Setting = require("../models/Settings")

const {
    generateSecureCode,
    sendVerificationEmail,
} = require("../services/mail");




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
       
        console.log("Sending verification code to:", EMAIL);
        const code = generateSecureCode();
        console.log("Generated verification code:", code);

        await Setting.findOneAndUpdate(
            { key: "verification_code" },
            { value: code },
            {
              upsert: true,
              returnDocument: "after",
              setDefaultsOnInsert: true,
            }
          );
  

        await sendVerificationEmail(EMAIL, code, role);
       
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
router.post("/verify-code", async (req, res) => {
    const { code } = req.body;

    if (!code) {
        return res.status(400).json({
            message: "Verification code is required.",
        });
    }

    const setting = await Setting.findOne({ key: "verification_code" });
    const dbCode = setting?.value;

    if (!dbCode || (String(dbCode) !== String(code))) {
      return res.status(400).json({
        message: "Invalid verification code.",
      });
    }

    // Code is valid, consume it
    setting.value = null;
    await setting.save();


    res.json({
        success: true,
    });
});

module.exports = router;