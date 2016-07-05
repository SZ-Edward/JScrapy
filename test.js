var myCallback = function(data) {
  console.log('got data: '+data);
};

var usingItNow = function(callback, msg) {
  callback(msg);
};

usingItNow(myCallback, process.argv.slice(2));
