import Content from "../models/Content.js";

export async function listContent(req, res, next) {
  try {
    const items = await Content.find({ isDeleted: false }).populate("author", "name email role");
    res.json(items);
  } catch (err) {
    next(err);
  }
}

export async function createContent(req, res, next) {
  try {
    const { title, body } = req.body;
    if (!title || !body) return res.status(400).json({ message: "title and body required" });
    const item = await Content.create({ title, body, author: req.user.id });
    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
}

export async function updateContent(req, res, next) {
  try {
    const { id } = req.params;
    const { title, body } = req.body;
    const item = await Content.findById(id);
    if (!item || item.isDeleted) return res.status(404).json({ message: "Content not found" });

    // editors can only update their own content
    if (req.user.role === "Editor" && item.author.toString() !== req.user.id) {
      return res.status(403).json({ message: "Cannot update others' content" });
    }

    if (title) item.title = title;
    if (body) item.body = body;
    await item.save();
    res.json(item);
  } catch (err) {
    next(err);
  }
}

export async function deleteContent(req, res, next) {
  try {
    const { id } = req.params;
    const item = await Content.findById(id);
    if (!item || item.isDeleted) return res.status(404).json({ message: "Content not found" });

    if (req.user.role === "Editor" && item.author.toString() !== req.user.id) {
      return res.status(403).json({ message: "Cannot delete others' content" });
    }

    item.isDeleted = true;
    await item.save();
    res.json({ message: "Content deleted" });
  } catch (err) {
    next(err);
  }
}
