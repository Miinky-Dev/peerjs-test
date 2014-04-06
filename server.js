var PORT = process.env.PORT || 9002;

var extend = require('extend');
var express = require('express');
var app = express();

var Datastore = require('nedb');
var db = new Datastore({ filename: __dirname + '/data/db', autoload: true });


app.use(express.json());

app.use('/static', express.static(__dirname + '/public'));

app.get('/id', function(req, res){
  res.send({id: guid()});
});

app.post('/save', function(req, res) {
  db.findOne({testId: req.body.testId}, function(err, doc){
    if (doc) {
      db.update({testId: req.body.testId}, extend(true, doc, req.body))
    } else {
      db.insert(req.body);
    }
  });
  res.send(200);
});

app.post('/end', function(req, res) {
  // Kill req.body.workerId
  res.send(200);
});

app.get('/dump', function(req, res) {
  db.find({}, function(err, data){
    res.send(data);
  });
});

app.listen(PORT);






// Util
function guid () {
  function s4 () {
    return Math.floor((1 + Math.random()) * 0x10000)
               .toString(16)
               .substring(1);
  }
  return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
         s4() + '-' + s4() + s4() + s4();
}
