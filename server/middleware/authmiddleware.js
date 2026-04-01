    import jwt from "jsonwebtoken";

    export const authMiddleware = (req, res, next) => {
    const token = req.headers.authorization;

    if (!token) return res.status(401).send("No token");

    const decoded = jwt.verify(token, "SECRET");
    req.userId = decoded.id;

    next();
    };