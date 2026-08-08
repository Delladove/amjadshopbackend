const userSchema = require("../models/User");
const express = require("express");
const bcrypt = require('bcrypt');
const jose = require('jose');
const cookieParser = require("cookie-parser");
const router = express.Router();
router.use(cookieParser());


const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'your-32-character-secret-key-here');

router.post('/', async (req, res) => {
  console.log("in login");
  const { userRole, userPassword } = req.body; // "admin" or "warehouse"

  try {
    // 1. Fetch your single auth document from MongoDB
    const authDoc = await userSchema.findById("auth");

    if (!authDoc) {
      return res.status(500).json({ message: 'Auth configuration missing' });
    }

    // 2. Select the correct hash field based on the role provided
    let storedHash = null;
    if (userRole === 'admin') {
      storedHash = authDoc.adminPasswordHash;
    } else if (userRole === 'warehouse') {
      storedHash = authDoc.warehousePasswordHash;
    } else {
      return res.status(400).json({ message: 'Invalid role provided' });
    }

    // 3. Compare the typed password with the MongoDB hash
    const isPasswordCorrect = await bcrypt.compare(userPassword, storedHash);
    if (!isPasswordCorrect) {
      return res.status(401).json({ message: 'Incorrect password' });
    }

    // 4. Create the JWT (Using role instead of userId)
    const token = await new jose.SignJWT({ role: userRole }) // 🔑 Role goes here
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('3d')
      .sign(JWT_SECRET);

    // 5. Drop the HttpOnly Cookie
    res.cookie('jwt_token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 3 * 24 * 60 * 60 * 1000 // 3 days
    });

    // // for development 
    // res.cookie('jwt_token', token, {
    //   httpOnly: true,
    //   secure: false,
    //   sameSite: 'lax', // for local dev 
    //   maxAge: 3 * 24 * 60 * 60 * 1000 // 3 days
    // });

    // 6. Return user state to React Context
    return res.status(200).json({
      success: true,
      user: { role: userRole } // React reads this to show Admin or Warehouse dashboards
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: err.message,
    });
  }
});

// 4. VERIFICATION ROUTE: Check cookie when React page reloads
router.get('/me', async (req, res) => {
  const token = req.cookies.jwt_token;

  if (!token) {
    return res.status(401).json({ authenticated: false, message: 'No token found' });
  }

  try {
    // Verify the JWT using jose
    const { payload } = await jose.jwtVerify(token, JWT_SECRET);

    // Token is valid! Return user data to populate React Context
    return res.status(200).json({
      authenticated: true,
      user: { role: payload.role }
    });
  } catch (error) {
    // Token expired or altered
    return res.status(401).json({ authenticated: false, message: 'Invalid or expired token' });
  }
});

// 5. LOGOUT ROUTE: Expire and wipe the cookie instantly
router.post('/logout', (req, res) => {
  res.clearCookie('jwt_token', {
    httpOnly: true,
    secure: true,
    sameSite: 'none'
  });
  return res.status(200).json({ success: true, message: 'Logged out successfully' });
});


router.get("/get-warehouse", async (req, res) => {
  try {
    const authDoc = await userSchema.findById("auth");
    console.log("in get-warehouse",authDoc)

    if (!authDoc) {
      return res.status(500).json({ message: 'Auth configuration missing' });
    }
    return res.status(200).json({
      "warehouseDisabled": authDoc.warehouseDisabled
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: err.message,
    });
  }
})

router.post("/set-warehouse", async (req, res) => {
  try {
    const { newValue } = req.body;
    console.log("in set warehouse", newValue);
    await userSchema.updateOne(
      { _id: "auth" },
      { warehouseDisabled: newValue }
    );
    return res.status(200).json({
      "warehouseDisabled": newValue
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: err.message,
    });
  }
})



module.exports = router;
