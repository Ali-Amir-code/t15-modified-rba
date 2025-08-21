import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import connectDB from "./config/db.js";
import authRoutes from "./routes/auth.js";
import usersRoutes from "./routes/users.js";
import profileRoutes from "./routes/profile.js";
import contentRoutes from "./routes/content.js";
import errorHandler from "./middleware/errorHandler.js";

dotenv.config();
const app = express();
connectDB();

app.use(cors());
app.use(express.json());
app.use(cookieParser());

app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/content", contentRoutes);

app.use(errorHandler);

app.get('/', (req, res) => {
    res.json({msg:'Welcome to the modified Role Base Access API.'});
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
