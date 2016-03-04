

var register = {

  canvas: document.getElementById('canvas'),
  gl: null,

  // Textures
  fixedTexture: null,
  movingTexture: null,

  // buffer is the gemotery array for the triangles
  buffer: null,

  // Texture coordinates
  textureCoordBuffer: null,

  // programs
  // Metric program subtracts two textures
  metricProgram: null,

  // Display program simply renders an image
  displayProgram: null,

  // Sum program will add and downsample
  sumProgram: null,

  // Texture for difference image
  differenceTexture: null,
  differenceFramebuffer: null,
};



$(function() {
  init();
});



function init() {
  var gl = register.gl = canvas.getContext("webgl");

  if ( !gl.getExtension('OES_texture_float') ) {
    alert ( "This browser does not support floating point textures!" );
  };

  // Vertex buffer
  var buffer = register.buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData( gl.ARRAY_BUFFER,
                 new Float32Array([
                     -1.0, -1.0,
                      1.0, -1.0,
                     -1.0,  1.0,
                     -1.0,  1.0,
                      1.0, -1.0,
                      1.0,  1.0]),
                 gl.STATIC_DRAW);

  // Texture coordinates need to correspond to the vertex coordinates
  var textureCoordBuffer = register.textureCoordBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    0,0,
    1,0,
    0,1,
    0,1,
    1,0,
    1,1]), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);


  create_difference_texture ( register );
  
  // Load the image via a promise
  load_image(gl, "images/lion.png").then(function(texture){
    register.fixedTexture = texture;
    return load_image(gl,"images/lion-rotate.png");
  }).then(function(texture) {
    register.movingTexture = texture;
    // Chain compiling the code
    return compile_program(gl, "shaders/register.vs", "shaders/register.fs" );
  }).then(function(program){
    register.metricProgram = program;
    render(register);
  }).catch(function(errorMessage){
    $("#status").html(message);
  });
}

function render(r) {
  var gl = r.gl;
  gl.clearColor(1.0, 0.0, 0.0, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.bindFramebuffer(gl.FRAMEBUFFER, r.differenceFramebuffer);
  compute_difference ( r );
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  compute_difference ( r );
}

function compute_difference ( r ) {
  var gl = r.gl;
  gl.useProgram(r.metricProgram);
  checkGLError(gl);
  // window.requestAnimationFrame(render,canvas);

  var tex = gl.getAttribLocation(r.metricProgram, 'texPosition');
  checkGLError(gl);
  gl.bindBuffer(gl.ARRAY_BUFFER, r.textureCoordBuffer);
  checkGLError(gl);
  gl.enableVertexAttribArray(tex);
  checkGLError(gl);
  gl.vertexAttribPointer(tex, 2, gl.FLOAT, false, 0, 0);
  checkGLError(gl);

  // Create a buffer and put a single clipspace rectangle in
  // it (2 triangles)
  var position = gl.getAttribLocation(r.metricProgram, 'position');
  gl.bindBuffer(gl.ARRAY_BUFFER, r.buffer);
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  // Bind our texture to the 0'th texture, and set the uniform accordingly
  var sampler = gl.getUniformLocation(r.metricProgram, "fixedImage");
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, r.fixedTexture);
  gl.uniform1i(sampler, 0);
  checkGLError(gl);

  var sampler = gl.getUniformLocation(r.metricProgram, "movingImage");
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, r.movingTexture);
  gl.uniform1i(sampler, 1);
  checkGLError(gl);
  
  // draw
  gl.drawArrays(gl.TRIANGLES, 0, 6);

}
