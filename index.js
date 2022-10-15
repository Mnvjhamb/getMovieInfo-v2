require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const { urlencoded } = require("body-parser");
const axios = require("axios");
const { response } = require("express");
const methodOverride = require("method-override");
const flash = require("connect-flash");
const path = require("path");
const session = require("express-session");

const mongoose = require("mongoose");

const passport = require("passport");
const localStrategy = require("passport-local");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const FacebookStrategy = require("passport-facebook").Strategy;
const GitHubStrategy = require("passport-github").Strategy;

const actionMovies = require("./utils/action");
const adventureMovies = require("./utils/adventure");
const comedyMovies = require("./utils/comedy");
const thrillerMovies = require("./utils/thriller");

const app = express();

const dbUrl = process.env.DB_URL;
mongoose.connect(dbUrl, {
  useCreateIndex: true,
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useFindAndModify: false,
});

const User = require("./modals/user");
const Review = require("./modals/review");
 
app.set("views", path.join(process.cwd() + "/views"));
app.set("view engine", "ejs");
app.use(express.static(path.join(process.cwd() + "/public")));

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

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL:
        // "https://evening-ocean-62764.herokuapp.com/auth/google/findYourMovie",
      "http://localhost:3000/auth/google/findYourMovie",
      profileFields: ["id", "displayName", "emails"],
    },
    async function (accessToken, refreshToken, profile, done) {
      var user = await User.findOne({ googleId: profile.id });
      console.log(profile);
      if (!user) {
        user = await new User({
          email: profile._json.email,
          username: profile.displayName + " " + profile.id,
          googleId: profile.id,
        }).save();
      }
      done(null, user);
    }
  )
);



passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL:
        // "https://evening-ocean-62764.herokuapp.com/auth/github/findYourMovie",
      "http://localhost:3000/auth/github/findYourMovie",
    },
    async function (accessToken, refreshToken, profile, done) {
      var user = await User.findOne({ githubId: profile.id });

      if (!user) {
        user = await new User({
          email: profile._json.email,
          username: profile.displayName + " " + profile.id,
          githubId: profile.id,
        }).save();
      }
      done(null, user);
    }
  )
);

app.use((req, res, next) => {
  res.locals.currentUser = req.user;
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  res.locals.genre = "Genre";
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

const isauthorized = async (req, res, next) => {
  const user = await User.findById(req.params.userId);
  if (user._id.equals(req.user._id)) {
    next();
  } else {
    req.flash("error", "Not Authorized");
    res.redirect("/");
  }
};

app.get("/", (req, res) => {
  res.render("home");
});

app.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: [
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/userinfo.email",
    ],
  })
);

app.get(
  "/auth/google/findYourMovie",
  passport.authenticate("google", { failureRedirect: "/login" }),
  function (req, res) {
    // Successful authentication, redirect home.
    req.flash("success", "Successfully Logged in");
    res.redirect("/");
  }
);

app.get(
  "/auth/facebook",
  passport.authenticate("facebook", { scope: ["email"] })
);

app.get(
  "/auth/facebook/findYourMovie",
  passport.authenticate("facebook", { failureRedirect: "/login" }),
  function (req, res) {
    // Successful authentication, redirect home.
    req.flash("success", "Successfully Logged in");
    res.redirect("/");
  }
);

app.get("/auth/github", passport.authenticate("github"));

app.get(
  "/auth/github/findYourMovie",
  passport.authenticate("github", { failureRedirect: "/login" }),
  function (req, res) {
    // Successful authentication, redirect home.
    req.flash("success", "Successfully Logged in");
    res.redirect("/");
  }
);

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

app.get('/users', async(req, res)=>{
  const users = await User.find();
  res.send(users);
})

app.get("/genre/action", async (req, res) => {
  var action = [];
  for (var i = 0; i < 10; i++) {
    var random = Math.floor(Math.random() * actionMovies.length);
    action.push(actionMovies[random]);
  }
  const shows = [];
  for (var movie of action) {
    var show = await axios
      .get(`https://www.omdbapi.com/?i=${movie}&apikey=70fc15e9`)
      .then((show) => {
        shows.push(show);
      })
      .catch((e) => {
        res.send(e);
      });
  }
  res.render("watchlist", { shows, genre: "Action" });
});
app.get("/genre/adventure", async (req, res) => {
  var adventure = [];
  for (var i = 0; i < 10; i++) {
    var random = Math.floor(Math.random() * adventureMovies.length);
    adventure.push(adventureMovies[random]);
  }
  const shows = [];
  for (var movie of adventure) {
    var show = await axios
      .get(`https://www.omdbapi.com/?i=${movie}&apikey=70fc15e9`)
      .then((show) => {
        shows.push(show);
      })
      .catch((e) => {
        res.send(e);
      });
  }
  res.render("watchlist", { shows, genre: "Adventure" });
});
app.get("/genre/comedy", async (req, res) => {
  var comedy = [];
  for (var i = 0; i < 10; i++) {
    var random = Math.floor(Math.random() * comedyMovies.length);
    comedy.push(comedyMovies[random]);
  }
  const shows = [];
  for (var movie of comedy) {
    var show = await axios
      .get(`https://www.omdbapi.com/?i=${movie}&apikey=70fc15e9`)
      .then((show) => {
        shows.push(show);
      })
      .catch((e) => {
        res.send(e);
      });
  }
  res.render("watchlist", { shows, genre: "Comedy" });
});
app.get("/genre/thriller", async (req, res) => {
  var thriller = [];
  for (var i = 0; i < 10; i++) {
    var random = Math.floor(Math.random() * thrillerMovies.length);
    thriller.push(thrillerMovies[random]);
  }
  const shows = [];
  for (var movie of thriller) {
    var show = await axios
      .get(`https://www.omdbapi.com/?i=${movie}&apikey=70fc15e9`)
      .then((show) => {
        shows.push(show);
      })
      .catch((e) => {
        res.send(e);
      });
  }
  res.render("watchlist", { shows, genre: "Thriller" });
});

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
        res.render("details", { show: show.data, notInWatchList, reviews });
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
  isauthorized,
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

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`server started at port ${port}`);
});
