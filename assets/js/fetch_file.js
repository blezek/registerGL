// Fetch a file async and return a promise.
// The `resolve` callback returns the text, while
// `reject` returns a text message with the error.
//
// args:
//   url -- url of the text to get

function fetch_file(url, async)
{
  return new Promise(function(resolve,reject) {
	  var request = new XMLHttpRequest();
	  request.open("GET", url);
	  request.overrideMimeType("text/plain");

    request.onload = function() {
      // Called even on 404 errors, so check the status
      if (request.status == 200) {
        // Resolve the promise with the response text
        resolve(request.responseText);
      } else {
        // Otherwise reject with the status text
        // which will hopefully be a meaningful error
        reject(request.statusText);
      }
    };
    // Handle network errors
    request.onerror = function() {
      reject("Network Error");
    };
	  request.send();
  });
}
