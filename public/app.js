$(document).ready(func());
function func() {
  images = document.getElementsByClassName("img");
  movies = document.getElementsByClassName("movie");
  i = 0;
  getUrl = async () => {
    try {
      id = Math.round(Math.random() * 500 + 1);
      var data = await axios.get(`http://api.tvmaze.com/episodes/${id}`);
      // console.log(i);
      //   console.log(images[i].src);
      images[i].src = data.data.image.original;
      images[i].id = id;

      var name = document.createElement("h4");
      name.innerHTML = data.data.name;
      name.style.color = "rgb(147 155 157)";
      movies[i].id = `movie${id}`;
      movies[i].appendChild(name);
    } catch (e) {
      await getUrl();
    }
  };
  f = async () => {
    for (j = 0; j < images.length; j++) {
      await getUrl();
      i += 1;
    }
  };
  f();
}

// function reload() {
//   window.location.reload();
// }

function movieDetails(id) {
  window.location.href = "/" + id;
}
function searchedMovie(id) {
  window.location.href = "/search/" + id;
}
