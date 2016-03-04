// Create a framebuffer for the difference image.
//
// args:
//   r  -- registration object

function create_difference_texture ( r ) {
  var gl = r.gl;
  r.differenceFramebuffer = gl.createFramebuffer();
  
  gl.bindFramebuffer(gl.FRAMEBUFFER, r.differenceFramebuffer);
  r.differenceFramebuffer.width = 512;
  r.differenceFramebuffer.height = 512;

  r.differenceTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, r.differenceTexture);
  
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, r.differenceFramebuffer.width, r.differenceFramebuffer.height, 0, gl.RGBA, gl.FLOAT, null);

  var renderbuffer = gl.createRenderbuffer();
  gl.bindRenderbuffer(gl.RENDERBUFFER, renderbuffer);
  gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, r.differenceFramebuffer.width, r.differenceFramebuffer.height);
  
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, r.differenceTexture, 0);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, renderbuffer);
  
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.bindTexture(gl.TEXTURE_2D, null);
}
