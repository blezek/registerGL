// Read texture into Float array
//
// args:
//   r  -- registration object
//   t  -- texture to read
//   w  -- width of buffer
//   h  -- height of buffer


function read_texture ( r, t, w, h ) {
  var gl = r.gl;

  var out = new Float32Array(3*w*h);


  for ( var index = 0; index < 3; index++ ) {
    var pixels = new Uint8Array(w*h * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, r.framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, r.textures['encode'], 0);
    render ( r, r.programs["encode_float"], [
      {name: "image", value: t},
      {name: "index", value: index},
    ]);  

    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    out.set(new Float32Array(pixels.buffer), index*w*h);
  }
  return out;
  
}
