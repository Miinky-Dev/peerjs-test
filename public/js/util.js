// Util

// POST queue
var q = async.queue(function (task, callback) {
  _post(task.url, task.data, function(arg1, arg2){
    if (task.cb) {
      task.cb(arg1, arg2);
    }
    callback();
  });
}, 1);

function post(url, data, cb) {
  q.push({url: url, data: data, cb: cb});
}

function _post(url, data, cb) {
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

function get(url, cb) {
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

function getQueryData() {
  var data = {};
  var query = window.location.search.substring(1);
  var vars = query.split('&');
  for (var i = 0; i < vars.length; i++) {
    var pair = vars[i].split('=');
    data[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1]);
  }
  return data;
}

function browserInfo() {
  var nVer = navigator.appVersion;
  var nAgt = navigator.userAgent;
  var browserName  = navigator.appName;
  var fullVersion  = ''+parseFloat(navigator.appVersion);
  var majorVersion = parseInt(navigator.appVersion,10);
  var nameOffset,verOffset,ix;

  // In Opera, the true version is after "Opera" or after "Version"
  if ((verOffset=nAgt.indexOf("Opera"))!=-1) {
   browserName = "Opera";
   fullVersion = nAgt.substring(verOffset+6);
   if ((verOffset=nAgt.indexOf("Version"))!=-1)
     fullVersion = nAgt.substring(verOffset+8);
  }
  // In MSIE, the true version is after "MSIE" in userAgent
  else if ((verOffset=nAgt.indexOf("MSIE"))!=-1) {
   browserName = "Microsoft Internet Explorer";
   fullVersion = nAgt.substring(verOffset+5);
  }
  // In Chrome, the true version is after "Chrome"
  else if ((verOffset=nAgt.indexOf("Chrome"))!=-1) {
   browserName = "Chrome";
   fullVersion = nAgt.substring(verOffset+7);
  }
  // In Safari, the true version is after "Safari" or after "Version"
  else if ((verOffset=nAgt.indexOf("Safari"))!=-1) {
   browserName = "Safari";
   fullVersion = nAgt.substring(verOffset+7);
   if ((verOffset=nAgt.indexOf("Version"))!=-1)
     fullVersion = nAgt.substring(verOffset+8);
  }
  // In Firefox, the true version is after "Firefox"
  else if ((verOffset=nAgt.indexOf("Firefox"))!=-1) {
   browserName = "Firefox";
   fullVersion = nAgt.substring(verOffset+8);
  }
  // In most other browsers, "name/version" is at the end of userAgent
  else if ( (nameOffset=nAgt.lastIndexOf(' ')+1) <
            (verOffset=nAgt.lastIndexOf('/')) )
  {
   browserName = nAgt.substring(nameOffset,verOffset);
   fullVersion = nAgt.substring(verOffset+1);
   if (browserName.toLowerCase()==browserName.toUpperCase()) {
    browserName = navigator.appName;
   }
  }
  // trim the fullVersion string at semicolon/space if present
  if ((ix=fullVersion.indexOf(";"))!=-1)
     fullVersion=fullVersion.substring(0,ix);
  if ((ix=fullVersion.indexOf(" "))!=-1)
     fullVersion=fullVersion.substring(0,ix);

  majorVersion = parseInt(''+fullVersion,10);
  if (isNaN(majorVersion)) {
   fullVersion  = ''+parseFloat(navigator.appVersion);
   majorVersion = parseInt(navigator.appVersion,10);
  }

  return {name: browserName, fullVersion: fullVersion, majorVersion: majorVersion};
};

function noop() {}
