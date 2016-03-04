

// Load an image into the GL context and return the texture identifier in a promise.
// Returns a promise.  The `resolve` callback returns the texture.  The `reject` callback
// returns a string describing the error.
//
// args:
//  gl  -- WebGL context
//  url -- URL of the image to load

function load_image ( gl, url ) {
  return new Promise(function(resolve, reject){
    var fixedTextureImage = new Image();
    fixedTextureImage.src = url;
    fixedTextureImage.onload = function() {
      // Bind this image to fixedTexture
      var fixedTexture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, fixedTexture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      // args to texImage2d are: target (2D or cube), LOD level (0), internal format (RGBA),  format (RGBA), image
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, fixedTextureImage);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      resolve(fixedTexture);
    };
    
    fixedTextureImage.onabort = function(event) {
      reject(event.message);
    };
  });
}
