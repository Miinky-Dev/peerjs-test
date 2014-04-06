loadScript('0.3.7', function(err){
  if (err) {
    console.log('Error:', err.message);
  } else {
    console.log('Script loaded');
  }
});

getTestId(function(id){
  console.log(id);
});
