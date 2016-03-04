
var canvas = document.getElementById('canvas');
var gl = null;

// Fixed image variables
var fixedTexture;
var movingTexture;

// buffer is the gemotery array for the triangles
var buffer;

// Texture coordinates
var textureCoordBuffer;


$(function() {
  init();
});



function init() {
  gl = canvas.getContext("webgl");

  if ( !gl.getExtension('OES_texture_float') ) {
    alert ( "This browser does not support floating point textures!" );
  };
  
  // Vertex buffer
  buffer = gl.createBuffer();
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
  textureCoordBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    0,0,
    1,0,
    0,1,
    0,1,
    1,0,
    1,1]), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  
  // Load the image via a promise
  load_image(gl, "images/lion.png").then(function(texture){
    fixedTexture = texture;

    console.log("Loaded fixed texture");
    return load_image(gl,"images/lion-rotate.png");
  }).then(function(texture2) {
    console.log("Loaded moving texture");
    movingTexture = texture2;
    
    // Chain compiling the code
    return compile_program(gl, "shaders/register.vs", "shaders/register.fs" );
    
  }).then(function(program){
    glProgram = program;
    render(gl);
  }).catch(function(errorMessage){
    $("#status").html(message);
  });
}

function render(gl) {
  gl.clearColor(1.0, 0.0, 0.0, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.useProgram(glProgram);
  checkGLError(gl);
  // window.requestAnimationFrame(render,canvas);

  var tex = gl.getAttribLocation(glProgram, 'texPosition');
  checkGLError(gl);
  gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordBuffer);
  checkGLError(gl);
  gl.enableVertexAttribArray(tex);
  checkGLError(gl);
  gl.vertexAttribPointer(tex, 2, gl.FLOAT, false, 0, 0);
  checkGLError(gl);

  // Create a buffer and put a single clipspace rectangle in
  // it (2 triangles)
  var position = gl.getAttribLocation(glProgram, 'position');
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  // Bind our texture to the 0'th texture, and set the uniform accordingly
  var sampler = gl.getUniformLocation(glProgram, "fixedImage");
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, fixedTexture);
  gl.uniform1i(sampler, 0);
  checkGLError(gl);

  var sampler = gl.getUniformLocation(glProgram, "movingImage");
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, movingTexture);
  gl.uniform1i(sampler, 1);
  checkGLError(gl);
  
  // draw
  // gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.drawArrays(gl.TRIANGLES, 0, 6);

  // Send our uniforms down into the shaders

  // // set up the sourceTextureSize
  // gl.uniform2f(gl.getUniformLocation(glProgram, "sourceTextureSize"), canvas.width, canvas.height );

  // // the sourceTexture
  // gl.activeTexture(gl.TEXTURE0);
  // gl.bindTexture(gl.TEXTURE_2D, sourceTexture);
  // gl.uniform1i(gl.getUniformLocation(glProgram, "sourceTextureSampler"), 0);

  // // the coordinate attribute
  // gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  // var coordinateLocation = gl.getAttribLocation(glProgram, "coordinate");
  // gl.enableVertexAttribArray( coordinateLocation );
  // gl.vertexAttribPointer( coordinateLocation, 3, gl.FLOAT, false, 0, 0);

  // // the textureCoordinate attribute
  // gl.bindBuffer(gl.ARRAY_BUFFER, textureBuffer);
  // var textureCoordinateLocation = gl.getAttribLocation(glProgram, "textureCoordinate");
  // gl.enableVertexAttribArray( textureCoordinateLocation );
  // gl.vertexAttribPointer( textureCoordinateLocation, 2, gl.FLOAT, false, 0, 0);

}
