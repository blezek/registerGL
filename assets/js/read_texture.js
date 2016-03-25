// Read texture into Float array
//
// args:
//   r  -- registration object
//   t  -- texture to read
//   w  -- width of buffer
//   h  -- height of buffer


function read_texture ( r, t, w, h ) {
  var gl = r.gl;

  var pixels = new Uint8Array(w*h * 4);
  var tempBuffer = create_texture(r, w, h);
  gl.bindFramebuffer(gl.FRAMEBUFFER, r.framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tempBuffer, 0);
  render ( r, r.programs["encode_float"], [
    {name: "image", value: t},
  ]);  

  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  pixels = new Float32Array(pixels.buffer);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.deleteTexture(tempBuffer);
  return pixels;
  
}
