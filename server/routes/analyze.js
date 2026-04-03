    import express from "express";
    import { authMiddleware } from ".middleware/authMiddleware.js";
    import { processStudent } from "../ai/engine.js";

    const router = express.Router();

    router.post("/", authMiddleware, async (req, res) => {
    try {
        const result = await processStudent(req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: "Analysis failed" });
    }
    });

    export default router;