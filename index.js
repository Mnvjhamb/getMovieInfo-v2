const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const { urlencoded } = require("body-parser");
const axios = require("axios");
const { response } = require("express");
const mongoose = require("mongoose");
const passport = require("passport");
const methodOverride = require("method-override");
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
  watchList: [
    {
      imdbId: "String",
    },
  ],
});

userSchema.plugin(passportLocalMongoose);
const User = mongoose.model("User", userSchema);

const reviewSchema = new mongoose.Schema({
  user: {
    type: mongoose.Types.ObjectId,
    ref: "User",
  },
  imdbId: String,
  body: "String",
});

const Review = mongoose.model("Review", reviewSchema);

app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(methodOverride("_method"));
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

const catchAsync = (func) => {
  return function (req, res, next) {
    func(req, res, next).catch(next);
  };
};

class ExpressError extends Error {
  constructor(message, status) {
    super();
    this.message = message;
    this.status = status;
  }
}

const isLoggedIn = (req, res, next) => {
  if (req.user) {
    next();
  } else {
    req.flash("error", "Please Login First");
    res.redirect("/login");
  }
};

app.get("/", (req, res) => {
  res.render("home");
});

app.get("/register", (req, res) => {
  res.render("register");
});

app.post(
  "/register",
  catchAsync(async (req, res) => {
    const { email, username, password } = req.body;
    const user = await new User({ email, username });
    await User.register(user, password);
    req.login(user, (err) => {
      if (!err) {
        req.flash("success", "Account Created Successfully");
        res.redirect("/");
      }
    });
  })
);

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
    req.flash("success", "Welcome Back :)");
    res.redirect("/");
  }
);

app.get("/logout", (req, res) => {
  req.logout();
  req.flash("success", "Logged You out");
  res.redirect("/");
});

app.get(
  "/search",
  catchAsync(async (req, res) => {
    const { title } = req.query;
    if (title) {
      var shows = await axios
        .get(`https://www.omdbapi.com/?s=${title}&apikey=70fc15e9`)
        .then((show) => {
          res.render("search", { shows: show.data.Search });
        })
        .catch((e) => {
          res.send(e);
        });
    } else {
      res.send("NO MOVIES");
    }
  })
);

app.get(
  "/:imdb",
  catchAsync(async (req, res) => {
    const { imdb } = req.params;
    var notInWatchList = true;
    if (req.user) {
      for (var movie of req.user.watchList) {
        if (movie.imdbId == imdb) {
          notInWatchList = false;
        }
      }
    }

    const reviews = await Review.find({ imdbId: imdb }).populate("user");
    const show = await axios
      .get(`https://www.omdbapi.com/?i=${imdb}&apikey=70fc15e9`)
      .then((show) => {
        res.render("show", { show: show.data, notInWatchList, reviews });
      })
      .catch((e) => {
        res.send(e);
      });
  })
);

app.post("/:imdbId/review", isLoggedIn, async (req, res) => {
  const { imdbId } = req.params;
  const { body } = req.body;
  const review = await new Review({
    user: req.user,
    body,
    imdbId,
  });
  await review.save();
  req.flash("success", "Comment Added");
  res.redirect("/" + imdbId);
});

app.get("/:imdbId/review/:reviewId/delete", isLoggedIn, async (req, res) => {
  await Review.findByIdAndDelete(req.params.reviewId);
  req.flash("success", "Comment Deleted");
  res.redirect("/" + req.params.imdbId);
});

app.get(
  "/:userId/watchlist",
  isLoggedIn,
  catchAsync(async (req, res) => {
    const movies = req.user.watchList;
    const shows = [];
    for (var movie of movies) {
      var show = await axios
        .get(`https://www.omdbapi.com/?i=${movie.imdbId}&apikey=70fc15e9`)
        .then((show) => {
          shows.push(show);
        })
        .catch((e) => {
          res.send(e);
        });
    }
    res.render("watchlist", { shows });
  })
);

app.post("/:userId/watchlist", isLoggedIn, async (req, res) => {
  const user = await User.findById(req.params.userId);
  const { movieId } = req.body;
  user.watchList.push({ imdbId: movieId });
  await user.save();
  req.flash("success", "WatchList Updated");
  res.redirect("/" + movieId);
});

app.delete("/:userId/watchlist", isLoggedIn, async (req, res) => {
  const { movieId } = req.body;
  const user = await User.findByIdAndUpdate(req.params.userId, {
    $pull: { watchList: { imdbId: movieId } },
  });
  user.save();
  req.flash("success", "WatchList Updated");
  res.redirect("/" + movieId);
});

app.all("*", (req, res, next) => {
  next(new ExpressError("Page not found", 404));
});

app.use((err, req, res, next) => {
  const { status = 500, message = "SOMTHING WENT WRONg" } = err;
  res.status(status).render("error", { message });
});

app.listen("3000", () => {
  console.log("server started at port 3000");
});
