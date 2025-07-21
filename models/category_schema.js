const mongoose = require("mongoose")

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  slug: {
    type: String,
    unique: true,
  },
  tax : {
    type :Number,
    required: true
  },
  icon: {
    type:String,
    default : "default.jpg"
  }, 
  description: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

categorySchema.pre("save", function(next) {
  if (!this.isModified("name")) return next();

  this.slug = this.name
    .toLowerCase()
    .replace(/[^\w ]+/g, "")
    .replace(/ +/g, "-");
  next();
});


module.exports = mongoose.model("Category", categorySchema);
