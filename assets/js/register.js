
var glProgram;
var canvas = document.getElementById('canvas');
var gl = canvas.getContext("webgl");

// Fixed image variables
var fixedTextureImage = new Image();
var fixedTexture;

// buffer is the gemotery array for the triangles
var buffer;

// Texture coordinates
var textureCoordBuffer;


$(function() {
  init();
  render();
});



function init() {

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

  // Create an in-memory, not displayed image for texture
  fixedTextureImage.src = "images/lion.png";
  fixedTextureImage.onload = function() {
    // Bind this image to fixedTexture
    fixedTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, fixedTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    // args to texImage2d are: target (2D or cube), LOD level (0), internal format (RGBA),  format (RGBA), image
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, fixedTextureImage);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    
    // We are done loading, so unbind the texture
    // gl.bindTexture(gl.TEXTURE_2D, null);
    console.log("Loaded texture");
  }
  
  // sourceTextureImage.src = "images/lion.png";
  // sourceTextureImage.onload = function() {
  //   gl.bindTexture(gl.TEXTURE_2D, sourceTexture);
  //   gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  //   gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sourceTextureImage);
  //   gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  //   gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  //   gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  //   gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  //   gl.bindTexture(gl.TEXTURE_2D, null);

  //   // sourceTextureSize[0] = sourceTextureImage.width;
  //   // sourceTextureSize[1] = sourceTextureImage.height;
  //   canvas.width = sourceTextureImage.width;
  //   canvas.height = sourceTextureImage.height;
  // }

  var message = "";

  // Create the program
  glProgram = gl.createProgram();
  // Load our shaders

  var vertex_shader = FetchFile("shaders/register.vs", false);
  var fragment_shader = FetchFile("shaders/register.fs", false);

  
  var vertexShader = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vertexShader, vertex_shader);
  gl.compileShader(vertexShader);
  if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
    message = message + "<h4>vertex</h3><pre>" + gl.getShaderInfoLog(vertexShader) + "</pre>";
  }

  var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fragmentShader, fragment_shader);
  gl.compileShader(fragmentShader);
  if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
    message = message + "<h4>fragment</h3><pre>" + gl.getShaderInfoLog(fragmentShader) + "</pre>";
  }

  if ( message === "") {
    message = "Sucess!";
  }
  
  message = message.replace(/\0/g, "");
  message = message.replace(/\n/g, "<br>");
  $("#status").html(message);


  gl.attachShader(glProgram, vertexShader);
  checkGLError();
  gl.attachShader(glProgram, fragmentShader);
  checkGLError();
  gl.linkProgram(glProgram);
  checkGLError();
	// gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
}

function render() {
  gl.clearColor(1.0, 0.0, 0.0, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.useProgram(glProgram);
  checkGLError();
  // window.requestAnimationFrame(render,canvas);

  var tex = gl.getAttribLocation(glProgram, 'texPosition');
  checkGLError();
  gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordBuffer);
  checkGLError();
  gl.enableVertexAttribArray(tex);
  checkGLError();
  gl.vertexAttribPointer(tex, 2, gl.FLOAT, false, 0, 0);
  checkGLError();

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
  checkGLError();
  console.log("Bound texture");

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


$(function() {
  init();
  render();

  
});
