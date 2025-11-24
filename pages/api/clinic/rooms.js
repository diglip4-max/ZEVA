import dbConnect from "../../../lib/database";
import Room from "../../../models/Room";
import Clinic from "../../../models/Clinic";
import User from "../../../models/Users";
import { getUserFromReq } from "../lead-ms/auth";

export default async function handler(req, res) {
  await dbConnect();

  // Verify clinic admin authentication
  let clinicUser;
  try {
    clinicUser = await getUserFromReq(req);
    if (!clinicUser) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    if (clinicUser.role !== "clinic") {
      return res.status(403).json({ success: false, message: "Access denied. Clinic role required." });
    }
  } catch (error) {
    return res.status(401).json({ success: false, message: "Invalid token" });
  }

  // Find the clinic associated with this user
  const clinic = await Clinic.findOne({ owner: clinicUser._id });
  if (!clinic) {
    return res.status(404).json({ success: false, message: "Clinic not found" });
  }

  const clinicId = clinic._id;

  // GET: Fetch all rooms for this clinic
  if (req.method === "GET") {
    try {
      const rooms = await Room.find({ clinicId })
        .sort({ createdAt: -1 })
        .lean();

      return res.status(200).json({
        success: true,
        rooms: rooms.map((room) => ({
          _id: room._id.toString(),
          name: room.name,
          createdAt: room.createdAt,
          updatedAt: room.updatedAt,
        })),
      });
    } catch (error) {
      console.error("Error fetching rooms:", error);
      return res.status(500).json({ success: false, message: "Failed to fetch rooms" });
    }
  }

  // POST: Create a new room
  if (req.method === "POST") {
    try {
      const { name } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ success: false, message: "Room name is required" });
      }

      // Check if room with same name already exists for this clinic
      const existingRoom = await Room.findOne({
        clinicId,
        name: name.trim(),
      });

      if (existingRoom) {
        return res.status(400).json({
          success: false,
          message: "A room with this name already exists",
        });
      }

      const newRoom = await Room.create({
        clinicId,
        name: name.trim(),
        createdBy: clinicUser._id,
      });

      return res.status(201).json({
        success: true,
        message: "Room created successfully",
        room: {
          _id: newRoom._id.toString(),
          name: newRoom.name,
          createdAt: newRoom.createdAt,
          updatedAt: newRoom.updatedAt,
        },
      });
    } catch (error) {
      console.error("Error creating room:", error);
      if (error.code === 11000) {
        return res.status(400).json({
          success: false,
          message: "A room with this name already exists",
        });
      }
      return res.status(500).json({ success: false, message: "Failed to create room" });
    }
  }

  // DELETE: Delete a room
  if (req.method === "DELETE") {
    try {
      const { roomId } = req.query;

      if (!roomId) {
        return res.status(400).json({ success: false, message: "Room ID is required" });
      }

      // Verify the room belongs to this clinic
      const room = await Room.findOne({ _id: roomId, clinicId });
      if (!room) {
        return res.status(404).json({ success: false, message: "Room not found" });
      }

      await Room.findByIdAndDelete(roomId);

      return res.status(200).json({
        success: true,
        message: "Room deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting room:", error);
      return res.status(500).json({ success: false, message: "Failed to delete room" });
    }
  }

  res.setHeader("Allow", ["GET", "POST", "DELETE"]);
  return res.status(405).json({ success: false, message: "Method not allowed" });
}

