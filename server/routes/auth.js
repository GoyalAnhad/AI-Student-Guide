    import express from "express";
    import bcrypt from "bcryptjs";
    import jwt from "jsonwebtoken";
    import User from "../models/User.js";

    const router = express.Router();

    router.post("/signup", async (req, res) => {
    const { email, password } = req.body;
    const hashed = await bcrypt.hash(password, 10);

    const user = await User.create({ email, password: hashed });
    res.json(user);
    });

    router.post("/login", async (req, res) => {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    const valid = await bcrypt.compare(password, user.password);

    if (!valid) return res.status(400).send("Invalid");

    const token = jwt.sign({ id: user._id }, "SECRET");
    res.json({ token });
    });

    export default router;