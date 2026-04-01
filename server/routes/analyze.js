    import express from "express";
    import { authMiddleware } from "../middleware/authMiddleware.js";
    import { processStudent } from "../ai/engine.js";

    const router = express.Router();

    router.post("/", authMiddleware, (req, res) => {
    const result = processStudent(req.body);
    res.json(result);
    });

    export default router;