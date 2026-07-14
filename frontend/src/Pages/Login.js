import React, { useState } from "react";
import './Login.css';

const Login = ({ setUser }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [successMsg, setSuccessMsg] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setSuccessMsg("");
        setIsLoading(true);

        const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";

        try {
            const res = await fetch(`http://localhost:5000${endpoint}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password }),
            });

            const data = await res.json();
            
            if (!res.ok) {
                setError(data.error || "An error occurred");
                setIsLoading(false);
                return;
            }

            if (isLogin) {
                // Save token in localstorage
                localStorage.setItem("token", data.token);
                localStorage.setItem("role", data.role);
                setUser({ username, role: data.role, token: data.token });
            } else {
                setSuccessMsg("Registration successful! Please login.");
                setIsLogin(true);
                setPassword("");
            }
        } catch (err) {
            setError(isLogin ? "Login failed. Please try again" : "Registration failed.");
            console.log("Auth error:", err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="login-container">
            <h2>StockSphere Auth</h2>
            <div className="auth-toggle">
                <button 
                    className={`toggle-btn ${isLogin ? 'active' : ''}`}
                    onClick={() => { setIsLogin(true); setError(""); setSuccessMsg(""); }}
                    type="button"
                >
                    Login
                </button>
                <button 
                    className={`toggle-btn ${!isLogin ? 'active' : ''}`}
                    onClick={() => { setIsLogin(false); setError(""); setSuccessMsg(""); }}
                    type="button"
                >
                    Sign Up
                </button>
            </div>
            
            <form onSubmit={handleSubmit} className="auth-form">
                <div className="input-group">
                    <label>Username</label>
                    <input
                        type="text"
                        placeholder="Enter username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                    />
                </div>
                <div className="input-group">
                    <label>Password</label>
                    <input
                        type="password"
                        placeholder="Enter password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                </div>
                <button type="submit" className="btn-primary auth-submit" disabled={isLoading}>
                    {isLoading ? "Processing..." : (isLogin ? "Login to Dashboard" : "Create Account")}
                </button>
            </form>
            
            {error && <div className="auth-message error">{error}</div>}
            {successMsg && <div className="auth-message success">{successMsg}</div>}
        </div>
    );
};

export default Login;