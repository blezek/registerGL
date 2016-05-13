// Create a floating point buffer.
//
// args:
//   r  -- registration object
//   w  -- width of buffer
//   h  -- height of buffer

function create_float_texture ( r, w, h ) {
  var gl = r.gl;

  // Enable extensions
  gl.getExtension ( 'OES_texture_float');
  gl.getExtension ( 'OES_texture_float_linear');
  gl.getExtension ( 'OES_texture_half_float');
  gl.getExtension ( 'OES_texture_half_float_linear');
  
  var differenceTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, differenceTexture);
  
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.FLOAT, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  gl.bindTexture(gl.TEXTURE_2D, null);
  return differenceTexture;
}

// Create a texture buffer.
//
// args:
//   r  -- registration object
//   w  -- width of buffer
//   h  -- height of buffer

function create_texture ( r, w, h ) {
  var gl = r.gl;
  
  var differenceTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, differenceTexture);
  
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  gl.bindTexture(gl.TEXTURE_2D, null);
  return differenceTexture;
}

