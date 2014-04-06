

// Util
function post (url, data, cb) {
  var oReq = new XMLHttpRequest();
  oReq.onload = function(){
    var data;
    try {
      data = JSON.parse(this.responseText)
      if (!data) {
        return cb(null);
      }
    } catch (e) {
      return cb(null);
    }
    cb(data);
  }
  oReq.open("POST", url, true);
  oReq.setRequestHeader('Content-type','application/json; charset=utf-8');
  oReq.send(JSON.stringify(data));
}

function get (url, cb) {
  var oReq = new XMLHttpRequest();
  oReq.onload = function(){
    var data;
    try {
      data = JSON.parse(this.responseText)
      if (!data) {
        return cb(null);
      }
    } catch (e) {
      return cb(null);
    }
    cb(data);
  }
  oReq.open("GET", url, true);
  oReq.send();
}

function noop (){}
