var http = require("http"),
    express = require("express"),
    bodyParser = require("body-parser"),
    redis = require("redis"),
    app = express(),
    client = redis.createClient(),
    INIT_KEY = 10 * Math.pow(36, 3);

app.set("views", "./views");
app.set("view engine", "jade");
app.use(bodyParser.urlencoded({extended: true}));

http.createServer(app).listen(3000);
console.log("Server running on port 3000");

app.get("/", function(req, res) {
  client.zrevrange("hits", 0, 9, "withscores", function(err, reply) {
    //console.log(reply);
    res.render("index", {"reply": reply});
  });
});

app.post("/", function(req, res) {
  // Using regular expression from http://stackoverflow.com/questions/3809401/what-is-a-good-regular-expression-to-match-a-url
  var exp = /(http(s)?:\/\/.)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&\/\/=]*)/;
  var re = new RegExp(exp);
  
  if (re.test(req.body.url)) {
    
    var short = req.body.url.substr(req.body.url.lastIndexOf("/") + 1);
    console.log("Short: " + short);
    
    client.exists("short:" + short, function(err, reply) {
      if (reply === 1) {
        // If short url is entered, display long url
        client.get("short:" + short, function(err, reply) {
          res.end("<p>Long URL: <a href='" + reply + "'>" + reply + "</a></p>");
        });
      }
      else {
        console.log("Could not find short:" + short + " in the rdb");
        console.log("Searching for long:" + req.body.url)
        client.exists("long:" + req.body.url, function(err, reply) {
          if (reply === 1) {
            // If long url is entered, display short url
            client.get("long:" + req.body.url, function(err, reply) {
              res.end("<p>Already in database</p><br /><p>Short URL: <a href='" + reply + "'>" + reply + "</p>");
            });
          }
          else {
            console.log("Could not find long:" + req.body.url + " in the rdb");
            console.log("Shortening URL");
            getNext(client, function(key) {
              client.set("short:" + key, req.body.url);
              client.setnx("long:" + req.body.url, "http://localhost:3000/" + key);
              res.end("<p>Your shortened URL is: <a href='http://localhost:3000/" + key + "'>http://localhost:3000/" + key + "</a></p>");
            });
          }
        });
      }
    });
  }
  else {
    // Error: Input does not have "http://localhost:3000/" in the beginning of their URL
    res.end("Please enter a correct url in the textfield!\n(e.g. http://localhost:3000/HelloWorld");
  }
});

app.get("/:key", function(req, res) {
  var short = "short:" + req.params.key;
  client.exists(short, function(err, reply) {
    if (reply === 1) {
      client.get(short, function(err, reply) {
        client.zincrby("hits", 1, short)
        res.redirect(reply);
      });
    }
    else {
      res.status(404).end("No such shortened URL!");
    }
  });
});

function getNext(redisClient, fn) {
  redisClient.setnx("next", INIT_KEY);
  
  var incr = Math.floor(Math.random()*10) + 1
  redisClient.incrby("next", incr, function(err, reply) {
    fn(base36encode(reply));
  });
}

function base36encode(num) {
  var base36 = "abcdefghijklmnopqrstuvwxyz0123456789";
  var key = "";
  
  while (num > 0) {
    key += base36[num % 36];
    num = Math.floor(num / 36);
  }
  
  return key;
}