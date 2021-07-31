const mongoose = require("mongoose");
const passportLocalMongoose = require("passport-local-mongoose");

const reviewSchema = new mongoose.Schema({
  user: {
    type: mongoose.Types.ObjectId,
    ref: "User",
  },
  imdbId: String,
  body: "String",
});

module.exports = mongoose.model("Review", reviewSchema);
