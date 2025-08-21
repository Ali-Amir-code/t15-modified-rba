import mongoose from "mongoose";

const contentSchema = new mongoose.Schema({
  title: { type: String, required: true },
  body: { type: String, required: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

export default mongoose.model("Content", contentSchema);
