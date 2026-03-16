import jwt  from "jsonwebtoken";
import dotenv from "dotenv";

const JWT_SECRET = process.env.JWT_SECRET;

export function authMiddleware(req,res,next) {
    const authHeader = req.headers.token;
    if(!authHeader) return res.status(401).json({error:"No token provided"});

    const token = authHeader.split("")[1];
    try{
        const decoded =  jwt.verify(token,JWT_SECRET);
        req.user = decoded;
        next();
    } catch{
        return res.status(403).json({error:"Invalid token"});

    }
}

export function isAdmin(req,res,next) {
    if( !req.user || req.user.role !== "admin"){
        return res.status(403).json({error:"Access Denied"});
    }
    next();
}