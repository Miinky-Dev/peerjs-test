var STOP_COMMAND = '__STOP'

/* DataChannel tests go here */
var TEST_DATA = [1,2,3,4,5];

function testDataClient(cb) {

  var testTimeout = setTimeout(function(){
    cb(null, false);
  }, 10000);

  var conn = peer.connect(TEST_ID + '-host');
  conn.on('data', function(data){
    // Piggyback off conn emitter
    console.log('Got', data)
    conn.emit('data-'+data.toString());
  });
  conn.on('open', function(){
    console.log('Conn openned');
    async.eachSeries(TEST_DATA, function(msg, eachCb){
      conn.on('data-'+msg.toString(), function(){
        eachCb();
      });
      console.log('Sending', msg)
      conn.send(msg);
    }, function(err){
      // Test complete
      clearTimeout(testTimeout);
      conn.send(STOP_COMMAND);
      cb(null, true);
    });
  });
}

function testDataHost(cb) {
  peer.on('connection', function(conn) {
    conn.on('data', function(data){
      console.log('Got', data)
      if (data == STOP_COMMAND) {
        peer.destroy();
        cb(null, true);
      } else {
        conn.send(data);
      }
    });
  });
}
