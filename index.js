const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const { urlencoded } = require("body-parser");
const axios = require("axios");
const { response } = require("express");
const app = express();

app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.render("home");
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
