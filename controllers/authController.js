import { validationResult } from "express-validator";
import bcrypt from "bcrypt";
import User from "../models/User.js";
import Token from "../models/Token.js";
import { genAccessToken, genRefreshTokenTokenId, genRefreshTokenJWT, genRandomToken, hashToken } from "../utils/tokens.js";
import { sendEmail } from "../utils/email.js";
import jwt from "jsonwebtoken";

const SALT_ROUNDS = 12;

export async function register(req, res, next) {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

		const { name, email, password } = req.body;
		const existing = await User.findOne({ email });
		if (existing) return res.status(400).json({ message: "Email already registered" });

		const hashed = await bcrypt.hash(password, SALT_ROUNDS);
		const user = await User.create({ name, email, password: hashed, role: "Viewer" });

		// create verification token
		const rawToken = genRandomToken();
		const tokenHash = hashToken(rawToken);
		const expires = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24 hours

		await Token.create({ user: user._id, tokenHash, type: "verify", expiresAt: expires });

		const verifyUrl = `${process.env.BASE_URL}/api/auth/verify-email?token=${rawToken}&email=${encodeURIComponent(email)}`;
		await sendEmail({
			to: email,
			subject: "Verify your email",
			text: `Please verify your email: ${verifyUrl}`,
			html: `<p>Please verify your email by clicking <a href="${verifyUrl}">here</a></p>`
		});

		res.status(201).json({ message: "Registered. Please check email to verify your account." });
	} catch (err) {
		next(err);
	}
}

export async function verifyEmail(req, res, next) {
	try {
		const { token, email } = req.query;
		if (!token || !email) return res.status(400).json({ message: "Missing token or email" });

		const user = await User.findOne({ email });
		if (!user) return res.status(400).json({ message: "Invalid link" });

		const tokenHash = hashToken(token);
		const tokenDoc = await Token.findOne({ user: user._id, tokenHash, type: "verify", used: false, revoked: false });
		if (!tokenDoc || tokenDoc.expiresAt < new Date()) return res.status(400).json({ message: "Invalid or expired token" });

		user.emailVerified = true;
		await user.save();

		tokenDoc.used = true;
		await tokenDoc.save();

		return res.json({ message: "Email verified. You can now login." });
	} catch (err) {
		next(err);
	}
}

export async function login(req, res, next) {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

		const { email, password } = req.body;
		const user = await User.findOne({ email });
		if (!user || user.isDeleted) return res.status(400).json({ message: "Invalid credentials" });

		if (!user.emailVerified) return res.status(401).json({ message: "Email not verified" });

		const match = await bcrypt.compare(password, user.password);
		if (!match) return res.status(400).json({ message: "Invalid credentials" });

		// generate tokens
		const accessToken = genAccessToken({ id: user._id, role: user.role, email: user.email });
		const tokenId = genRefreshTokenTokenId();
		const refreshToken = genRefreshTokenJWT(user._id.toString(), tokenId);

		const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // matches REFRESH_TOKEN_EXPIRES (7d)
		await Token.create({ tokenId, user: user._id, type: "refresh", expiresAt });

		user.lastLoginAt = new Date();
		await user.save();

		return res.json({ accessToken, refreshToken });
	} catch (err) {
		next(err);
	}
}

export async function logout(req, res, next) {
	try {
		const { refreshToken } = req.body;
		if (!refreshToken) return res.status(400).json({ message: "refreshToken required" });
		let payload;
		try {
			payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
		} catch (err) {
			return res.status(400).json({ message: "Invalid refresh token" });
		}
		const { tokenId } = payload;
		await Token.findOneAndUpdate({ tokenId, type: "refresh" }, { revoked: true });
		return res.json({ message: "Logged out" });
	} catch (err) {
		next(err);
	}
}

export async function token(req, res, next) {
	try {
		const { refreshToken } = req.body;
		if (!refreshToken) return res.status(400).json({ message: "refreshToken required" });

		let payload;
		try {
			payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
		} catch (err) {
			return res.status(401).json({ message: "Invalid or expired refresh token" });
		}
		const { userId, tokenId } = payload;
		// check DB record
		const tokenDoc = await Token.findOne({ tokenId, user: userId, type: "refresh", revoked: false });
		if (!tokenDoc || tokenDoc.expiresAt < new Date()) return res.status(401).json({ message: "Invalid refresh token" });

		// revoke old
		tokenDoc.revoked = true;
		await tokenDoc.save();

		// issue new pair
		const newTokenId = genRefreshTokenTokenId();
		const newRefreshToken = genRefreshTokenJWT(userId, newTokenId);
		const accessToken = genAccessToken({ id: userId, role: (await (await User.findById(userId)).role), email: (await (await User.findById(userId)).email) });

		const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
		await Token.create({ tokenId: newTokenId, user: userId, type: "refresh", expiresAt });

		return res.json({ accessToken, refreshToken: newRefreshToken });
	} catch (err) {
		next(err);
	}
}

export async function forgotPassword(req, res, next) {
	try {
		const { email } = req.body;
		if (!email) return res.status(400).json({ message: "email required" });
		const user = await User.findOne({ email });
		if (!user) return res.status(200).json({ message: "If that email exists you will receive a reset link" });

		const rawToken = genRandomToken();
		const tokenHash = hashToken(rawToken);
		const expires = new Date(Date.now() + 1000 * 60 * 60); // 1 hour
		await Token.create({ user: user._id, tokenHash, type: "reset", expiresAt: expires });

		const resetUrl = `${process.env.BASE_URL}/api/auth/reset-password?token=${rawToken}&email=${encodeURIComponent(email)}`;
		await sendEmail({
			to: email,
			subject: "Password reset",
			text: `Reset link: ${resetUrl}`,
			html: `<p>Reset link: <a href="${resetUrl}">Reset password</a></p>`
		});

		return res.json({ message: "If that email exists you will receive a reset link" });
	} catch (err) {
		next(err);
	}
}

export async function resetPassword(req, res, next) {
	try {
		const { token, email, password } = req.body;
		if (!token || !email || !password) return res.status(400).json({ message: "token, email and password required" });

		const user = await User.findOne({ email });
		if (!user) return res.status(400).json({ message: "Invalid request" });

		const tokenHash = hashToken(token);
		const tokenDoc = await Token.findOne({ user: user._id, tokenHash, type: "reset", used: false, revoked: false });
		if (!tokenDoc || tokenDoc.expiresAt < new Date()) return res.status(400).json({ message: "Invalid or expired token" });

		user.password = await bcrypt.hash(password, SALT_ROUNDS);
		await user.save();

		tokenDoc.used = true;
		await tokenDoc.save();

		// revoke existing refresh tokens
		await Token.updateMany({ user: user._id, type: "refresh" }, { revoked: true });

		return res.json({ message: "Password reset successful" });
	} catch (err) {
		next(err);
	}
}
