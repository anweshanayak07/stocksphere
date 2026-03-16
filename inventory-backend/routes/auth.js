import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { queryDatabase } from '../db.js';

const router = express.Router();
const JWT_SECRET = "vectra";

//Login
router.post("/login", async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await queryDatabase("SELECT * FROM users WHERE username=@param0", [username]);
        const user = result[0];
        if (!user) return res.status(404).json({ error: "User not found" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ error: "Invalid password" });

        const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: "8h" }
        );

        res.json({ token, role: user.role });
    } catch (err) {
        console.log("Login error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

//Register
router.post("/register", async (req, res) => {
    const { username, password } = req.body;
    try {
        // Check if user already exists
        const existingUser = await queryDatabase("SELECT * FROM users WHERE username=@param0", [username]);
        if (existingUser.length > 0) {
            return res.status(400).json({ error: "Username already exists" });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Insert new user
        await queryDatabase(
            "INSERT INTO Users (username, password, role) VALUES (@param0, @param1, 'user')",
            [username, hashedPassword]
        );

        res.status(201).json({ message: "User registered successfully" });
    } catch (err) {
        console.log("Register error:", err);
        res.status(500).json({ error: "Server error during registration" });
    }
});

export default router;