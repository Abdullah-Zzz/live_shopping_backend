const mongoose = require("mongoose")

const streamSessionSchema = new mongoose.Schema({
  seller: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true },
  zegoRoomId: { type: String, required: true, unique: true },
  title: String,
  language : {
    type:String,
    required : true
  },
  status: { type: String, enum: ['scheduled', 'live', 'ended'], default: 'scheduled' },
  startTime: Date,
  endTime: Date,
  featuredProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  viewerCounts: [{
    timestamp: Date,
    count: Number
  }],
  chatEnabled: { type: Boolean, default: true },
  recordingUrl: String,
  thumbnailUrl: String
}, { timestamps: true });


module.exports = mongoose.model("live_sessions", streamSessionSchema);
