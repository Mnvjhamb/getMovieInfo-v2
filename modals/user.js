const mongoose = require("mongoose");
const passportLocalMongoose = require("passport-local-mongoose");

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
  },
  watchList: [
    {
      imdbId: "String",
    },
  ],
  googleId: String,
  facebookId: String,
  githubId: String,
});
userSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model("User", userSchema);
