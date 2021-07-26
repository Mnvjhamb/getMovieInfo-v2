const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const { urlencoded } = require("body-parser");
const axios = require("axios");
const { response } = require("express");
const mongoose = require("mongoose");
const passport = require("passport");
const session = require("express-session");
const localStrategy = require("passport-local");
const flash = require("connect-flash");
const passportLocalMongoose = require("passport-local-mongoose");

const app = express();

mongoose.connect("mongodb://localhost:27017/findYourMovie", {
  useCreateIndex: true,
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
  },
});

userSchema.plugin(passportLocalMongoose);
const User = mongoose.model("User", userSchema);

app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));

app.use(
  session({
    secret: "Thisisasecret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  })
);
app.use(flash());

app.use(passport.initialize());
app.use(passport.session());
passport.use(new localStrategy(User.authenticate()));

passport.serializeUser(function (user, done) {
  done(null, user.id);
});

passport.deserializeUser(function (id, done) {
  User.findById(id, function (err, user) {
    done(err, user);
  });
});

app.use((req, res, next) => {
  res.locals.currentUser = req.user;
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  next();
});

app.get("/", (req, res) => {
  res.render("home");
});

app.get("/register", (req, res) => {
  res.render("register");
});

app.post("/register", async (req, res) => {
  const { email, username, password } = req.body;
  const user = await new User({ email, username });
  await User.register(user, password);
  req.login(user, (err) => {
    if (!err) {
      req.flash("success", "Account Created Successfully");
      res.redirect("/");
    }
  });
});

app.get("/login", (req, res) => {
  res.render("login");
});

app.post(
  "/login",
  passport.authenticate("local", {
    failureFlash: true,
    failureRedirect: "/login",
  }),
  (req, res) => {
    const returnURL = req.session.returnTo || "/";
    req.flash("success", "Welcome Back :)");
    res.redirect(returnURL);
  }
);

app.get("/logout", (req, res) => {
  req.logout();
  req.flash("success", "Logged You out");
  res.redirect("/");
});

app.get("/search", async (req, res) => {
  const { title } = req.query;
  if (title) {
    try {
      var shows = await axios.get(
        `http://api.tvmaze.com/search/shows?q=${title}`
      );
      res.render("search", { shows: shows.data });
    } catch (e) {
      res.send(e);
    }
  } else {
    res.send("NO MOVIES");
  }
});

app.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const show = await axios.get(`http://api.tvmaze.com/episodes/${id}`);
    res.render("Show", { show: show.data });
  } catch (e) {
    res.send(e);
  }
});

app.get("/search/:title", async (req, res) => {
  const { title } = req.params;
  try {
    const show = await axios.get(
      `http://api.tvmaze.com/singlesearch/shows?q=${title}`
    );
    res.render("searchedShow", { show: show.data });
  } catch (e) {
    res.send(e);
  }
});

app.listen("3000", () => {
  console.log("server started at port 3000");
});
