// Compiles a WebGL program into the GL context and returns a promise.
// The program is passed to the resolve callback, and any error messages
// are returned as HTML text in the reject callback.
//
// args:
//  gl             -- WebGL context
//  vertexSource   -- URL of the shader source
//  fragmentSource -- URL of the fragment shader

function compile_program ( gl, vertexSource, fragmentSource ) {

  return new Promise(function(resolve,reject) {
    var message = "";
    var vertex_shader = "";
    var fragment_shader = "";
    
    // Create the program
    var glProgram = gl.createProgram();
    
    // Load our shaders
    fetch_file(vertexSource).then(function(text) {
      vertex_shader = text;
      return fetch_file(fragmentSource);
    }).then (function(text){
      fragment_shader = text;
      return Promise.resolve();
    }).then ( function() {
      
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

      if ( message != "") {
        message = message.replace(/\0/g, "");
        message = message.replace(/\n/g, "<br>");
        reject(message);
      }

      try {
        gl.attachShader(glProgram, vertexShader);
        checkGLError(gl);
        gl.attachShader(glProgram, fragmentShader);
        checkGLError(gl);
        gl.linkProgram(glProgram);
        checkGLError(gl);
      } catch ( message ) {
        reject(message);
      }
      resolve(glProgram)
      
    });
  });
}

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


/*
  demonsStep -- calculate one step in the demon's algorthim, i.e. update `r`
  Parameters:
    r -- registration object
    count -- number of steps
  1. transform the movingImage using the `displace` kernel
  2. calculate the movingImage gradient
  3. smooth the movingImage gradient
  4. calculate `dr`, the delta in `r`
  5. smooth `dr`
  6. update `r`
  7. smooth `r`
 */

function demonsStep(r,count) {
  count = count || 1;
  console.log("Running " + count + " steps in the Demon's algorithm");

  // delta between pixels, i.e. 1 / image size
  var delta = 1/512.;
  
  // Sigmas are in pixels
  var imageSigma = 0.0;
  var gradientSigma = 0.0;
  var drSigma = 5.0;
  var rSigma = 0.0;

  // How fast to update
  var scale = 0.2;
  
  var gl = r.gl;
  gl.bindFramebuffer(gl.FRAMEBUFFER, r.framebuffer);
  gl.viewport(0,0,512,512);
  
  for ( var counter = 0; counter < count; counter++ ) {
    // Update moving image
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, r.textures["displaced"], 0);
    render ( r, r.programs["displace"], [
      {name: "movingImage", value: r.movingTexture},
      {name: "r", value: r.textures["r"]},
      {name: "scale", value: scale},
    ]);

    // Smooth the displaced image
    smoothBuffer ( r, "displaced", imageSigma, delta );
    
    // Calculate the gradients
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, r.textures["B"], 0);
    render ( r, r.programs["copy"], [
      {name: "image", value: r.textures["fixed"]},
    ]);
    
    smoothBuffer ( r, "A", imageSigma, delta );
    gl.bindFramebuffer(gl.FRAMEBUFFER, r.framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, r.textures["fixedGradient"], 0);
    render ( r, r.programs["gradient"], [
      {name: "image", value: r.textures["B"]},
      {name: "delta", value: delta},
    ]);
    // Smooth the gradient
    smoothBuffer ( r, "fixedGradient", gradientSigma, delta );
    
    gl.bindFramebuffer(gl.FRAMEBUFFER, r.framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, r.textures["movingGradient"], 0);
    render ( r, r.programs["gradient"], [
      {name: "image", value: r.textures['displaced']},
      {name: "delta", value: delta},
    ]);
    // Smooth the gradient
    smoothBuffer ( r, "movingGradient", gradientSigma, delta );

    // 4. calculate `dr`, the delta in `r`
    gl.bindFramebuffer(gl.FRAMEBUFFER, r.framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, r.textures["dr"], 0);
    render ( r, r.programs["displacement"], [
      {name: "fixedImage", value: r.textures["fixed"]},
      {name: "fixedImageGradient", value: r.textures["fixedGradient"]},
      {name: "movingImage", value: r.textures["displaced"]},
      {name: "movingImageGradient", value: r.textures["movingGradient"]},
      {name: "spacing", value: 1.0},
    ]);

    // 5. smooth `dr`
    smoothBuffer ( r, "dr", drSigma, delta );
    
    // 6. update `r`
    // Calculate to "A", copy to "r"
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, r.textures["A"], 0);
    render ( r, r.programs["updateR"], [
      {name: "r", value: r.textures["r"]},
      {name: "dr", value: r.textures["dr"]},
    ]);

    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, r.textures["r"], 0);
    render ( r, r.programs["copy"], [
      {name: "image", value: r.textures["A"]},
    ]);
    
    // 7. smooth `r`
    smoothBuffer ( r, "r", rSigma, delta );
    
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, r.textures["difference"], 0);
    render ( r, r.programs["difference"], [
      {name: "movingImage", value: r.textures["displaced"]},
      {name: "fixedImage", value: r.textures["fixed"]},
    ]);

  }  
}

function smoothBuffer ( r, buffer, sigma, delta ) {
  if ( sigma == 0.0 ) { return; }
  // First do horizontal pass from buffer into "B"
  // Second do vertical pass from "B" into buffer
  var gl = r.gl;
  var tmpBuffer = "A";
  gl.bindFramebuffer(gl.FRAMEBUFFER, r.framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, r.textures[tmpBuffer], 0);
  render ( r, r.programs["smooth"], [
    {name: "image", value: r.textures[buffer]},
    {name: "delta", value: delta},
    {name: "sigma", value: sigma},
    {name: "direction", value: 0},
  ]);
  gl.bindFramebuffer(gl.FRAMEBUFFER, r.framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, r.textures[buffer], 0);
  render ( r, r.programs["smooth"], [
    {name: "image", value: r.textures[tmpBuffer]},
    {name: "delta", value: delta},
    {name: "sigma", value: sigma},
    {name: "direction", value: 1},
  ]);
}

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



var register = {

  canvas: document.getElementById('canvas'),
  gl: null,

  // Textures
  fixedTexture: null,
  movingTexture: null,

  // Currently displayed image values
  pixels: null,
  
  // buffer is the gemotery array for the triangles
  buffer: null,

  // Texture coordinates
  textureCoordBuffer: null,

  // programs
  programs: {},
  // Metric program subtracts two textures
  metricProgram: null,

  // Display program simply renders an image
  displayProgram: null,

  // Sum program will add and downsample
  sumProgram: null,

  // Framebuffer
  framebuffer: null,
  
  // Texture for difference image
  textures: {},
  sumPyramid: [],
  outPyramid: [],
  differenceTexture: null,
};



$(function() {
  init();
});



function init() {
  var gl = register.gl = canvas.getContext("webgl");
  
  if ( !gl.getExtension('OES_texture_float') ) {
    alert ( "This browser does not support floating point textures!" );
  };

  // Off screen frame buffer
  register.framebuffer = gl.createFramebuffer();
  
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

  // Textures needed
  register.textures["A"] = create_float_texture ( register, 512, 512 );
  register.textures["B"] = create_float_texture ( register, 512, 512 );
  register.textures["encode"] = create_float_texture ( register, 512, 512 );
  register.textures["r"] = create_float_texture ( register, 512, 512 );
  register.textures["dr"] = create_float_texture ( register, 512, 512 );
  register.textures["difference"] = create_float_texture ( register, 512, 512 );
  register.textures["movingGradient"] = create_float_texture ( register, 512, 512 );
  register.textures["displaced"] = create_float_texture ( register, 512, 512 );
  register.textures["fixedGradient"] = create_float_texture ( register, 512, 512 );

  // Load the image via a promise
  // load_image(gl, "images/copd1_eBHCT_slice.png").then(function(texture){
  load_image(gl, "images/small_square.png").then(function(texture){
    register.fixedTexture = texture;
    register.textures["fixed"] = texture;
    // return load_image(gl,"images/copd1_iBHCT_slice.png");
    return load_image(gl,"images/big_circle.png");
  }).then(function(texture) {
    register.movingTexture = texture;
    register.textures["moving"] = texture;
    // Chain compiling the code
    return compile_program(gl, "shaders/register.vs", "shaders/display.fs" );
  }).then(function(program){
    register.displayProgram = program;
    return compile_program(gl, "shaders/register.vs", "shaders/difference.fs" );
  }).then(function(program){
    register.programs["difference"] = program;
    return compile_program(gl, "shaders/register.vs", "shaders/scale.fs" );
  }).then(function(program){
    register.programs["scale"] = program;
    return compile_program(gl, "shaders/register.vs", "shaders/sum.fs" );
  }).then(function(program){
    register.programs["sum"] = program;
    return compile_program(gl, "shaders/register.vs", "shaders/copy.fs" );
  }).then(function(program){
    register.programs["copy"] = program;
    return compile_program(gl, "shaders/register.vs", "shaders/encode_float.fs" );
  }).then(function(program){
    register.programs["encode_float"] = program;
    return compile_program(gl, "shaders/register.vs", "shaders/gradient.fs" );
  }).then(function(program){
    register.programs["gradient"] = program;
    return compile_program(gl, "shaders/register.vs", "shaders/smooth.fs" );
  }).then(function(program){
    register.programs["smooth"] = program;
    return compile_program(gl, "shaders/register.vs", "shaders/displacement.fs" );
  }).then(function(program){
    register.programs["displacement"] = program;
    return compile_program(gl, "shaders/register.vs", "shaders/updateR.fs" );
  }).then(function(program){
    register.programs["updateR"] = program;
    return compile_program(gl, "shaders/register.vs", "shaders/displace.fs" );
  }).then(function(program){
    register.programs["displace"] = program;
    // start_render(register);
    display(register,$("#buffer").val());
  }).catch(function(errorMessage){
    console.log("Error: " + errorMessage)
    $("#status").html(errorMessage);
  });


  $("#step").click(function() {
    start_render(register);
  });
  
  $("#step10").click(function() {
    start_render(register,10);
  });

  $("#test").click(function() {
    testStep(register, 1);
    display (register, $('#buffer').val());
  });
  
  $("#buffer").change(function() {
    console.log("Display " + $("#buffer").val());
    display(register,$("#buffer").val());
  });

  var show_value = function(event) {
    if ( register.pixels == null ) { return; }
    var offset = event.offsetX + event.offsetY * 512;
    var dp = 2;
    var text = Number(register.pixels[offset].toFixed(dp)) + ", "
        + Number(register.pixels[offset+512*512].toFixed(dp)) + ", "
        + Number(register.pixels[offset+512*512*2].toFixed(dp));
    $('#value').text(text);
  }
  $("#canvas").mousemove(show_value);
  
  $("#restart").click(function() {
    // Zero the R buffer
    console.log("setting r buffer to 0.0")
    var r = register;
    var gl = r.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, r.framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, r.textures["r"], 0);
    render ( r, r.programs["scale"], [
      {name: "image", value: r.textures["A"]},
      {name: "scale", value: 0.0},
    ]);
    display(register,$("#buffer").val());
  });
  
}

function display(r,buffer) {
  console.log("Displaying buffer " + buffer);
  var gl = r.gl;
  gl.viewport(0,0,512,512);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  render ( r, r.displayProgram, [
    {name: "image", value: r.textures[buffer]},
  ]);

  // Pull the buffer to a local array
  r.pixels = read_texture ( r, r.textures[buffer], 512, 512);
  
  // Do a single step
  // start_render(r);
}

function start_render(r,count) {
  demonsStep(r, count||1);
  display (r, $('#buffer').val());
}





// Render using WebGL
// args:
//   r          -- register object
//   program    -- which program to use in the rendering
//   parameters -- array of values to pass to the program, consists of name / value pairs, e.g. { name: "time", value: 123.3 }
//                 may be int, float, bool, texture

function isInteger(n){
    return n === +n && n === (n|0);
}

function isFloat(n){
  return typeof(n) === "number";
}

function isBoolean(n){
  return typeof(n) === "boolean";
}

function isImage(n){
  return n instanceof WebGLTexture;
}

function render ( r, program, parameters ) {

  var gl = r.gl;
  gl.useProgram(program);
  checkGLError(gl);
  // window.requestAnimationFrame(render,canvas);

  var tex = gl.getAttribLocation(program, 'texPosition');
  checkGLError(gl);
  gl.bindBuffer(gl.ARRAY_BUFFER, r.textureCoordBuffer);
  checkGLError(gl);
  gl.enableVertexAttribArray(tex);
  checkGLError(gl);
  gl.vertexAttribPointer(tex, 2, gl.FLOAT, false, 0, 0);
  checkGLError(gl);

  // Create a buffer and put a single clipspace rectangle in
  // it (2 triangles)
  var position = gl.getAttribLocation(r.displayProgram, 'position');
  gl.bindBuffer(gl.ARRAY_BUFFER, r.buffer);
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  // Bind uniforms
  var textureIndex = 0;
  parameters.forEach( function(param, index) {
    var location = gl.getUniformLocation(program, param.name);
    if ( isImage(param.value) ) {
      var sampler = gl.getUniformLocation(program, param.name);
      gl.activeTexture(gl.TEXTURE0 + textureIndex);
      gl.bindTexture(gl.TEXTURE_2D, param.value);
      gl.uniform1i(sampler, textureIndex);
      checkGLError(gl);
      textureIndex++;
    } else if ( isBoolean(param.value) ) {
      gl.uniform1i(location, param.value);
    } else if ( isFloat(param.value) ) {
      gl.uniform1f(location, param.value);
    }
    
  });

  // draw
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  
}


function testStep(r,count) {
  count = count || 1;
  console.log("Running " + count + " steps in the Demon's algorithm");
  for ( var counter = 0; counter < count; counter++ ) {
    var gl = r.gl;
    
    gl.viewport(0,0,512,512);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, r.framebuffer);
    
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, r.textures["r"], 0);
    render ( r, r.programs["copy"], [
      {name: "image", value: r.textures["moving"]},
    ]);
    
    // 7. smooth `r`
    var sigma = 1.0;
    // smoothBuffer ( r, "r", 8.0 );
  }  
}

/**
 * Creates and compiles a shader.
 *
 * @param {!WebGLRenderingContext} gl The WebGL Context.
 * @param {string} shaderSource The GLSL source code for the shader.
 * @param {number} shaderType The type of shader, VERTEX_SHADER or
 *     FRAGMENT_SHADER.
 * @return {!WebGLShader} The shader.
 */
function compileShader(gl, shaderSource, shaderType) {
  // Create the shader object
  var shader = gl.createShader(shaderType);
 
  // Set the shader source code.
  gl.shaderSource(shader, shaderSource);
 
  // Compile the shader
  gl.compileShader(shader);
 
  // Check if it compiled
  var success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  if (!success) {
    // Something went wrong during compilation; get the error
    throw "could not compile shader:" + gl.getShaderInfoLog(shader);
  }
 
  return shader;
}

/**
 * Creates a program from 2 shaders.
 *
 * @param {!WebGLRenderingContext) gl The WebGL context.
 * @param {!WebGLShader} vertexShader A vertex shader.
 * @param {!WebGLShader} fragmentShader A fragment shader.
 * @return {!WebGLProgram} A program.
 */
function createProgram(gl, vertexShader, fragmentShader) {
  // create a program.
  var program = gl.createProgram();
 
  // attach the shaders.
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
 
  // link the program.
  gl.linkProgram(program);
 
  // Check if it linked.
  var success = gl.getProgramParameter(program, gl.LINK_STATUS);
  if (!success) {
      // something went wrong with the link
      throw ("program filed to link:" + gl.getProgramInfoLog (program));
  }
 
  return program;
};


function checkGLError(gl) {
	var error = gl.getError();
	if (error != gl.NO_ERROR) {
		var str = "GL Error: " + error + " " + gl.enum_strings[error];
		console.log(str);
		throw str;
	}
}



function FetchFile(url, async)
{
	var request = new XMLHttpRequest();
	request.open("GET", url, async);
	request.overrideMimeType("text/plain");
	request.send(null);
	return request.responseText;
}

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImNvbXBpbGVfcHJvZ3JhbS5qcyIsImNyZWF0ZV9kaWZmZXJlbmNlX3RleHR1cmUuanMiLCJkZW1vbnMuanMiLCJmZXRjaF9maWxlLmpzIiwibG9hZF9pbWFnZS5qcyIsInJlYWRfdGV4dHVyZS5qcyIsInJlZ2lzdGVyLmpzIiwicmVuZGVyLmpzIiwidGVzdC5qcyIsInV0aWxzLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDL0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNwREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3JJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNoQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ2xDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQzlCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3hOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3JFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDdEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6InJlZ2lzdGVyLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLy8gQ29tcGlsZXMgYSBXZWJHTCBwcm9ncmFtIGludG8gdGhlIEdMIGNvbnRleHQgYW5kIHJldHVybnMgYSBwcm9taXNlLlxuLy8gVGhlIHByb2dyYW0gaXMgcGFzc2VkIHRvIHRoZSByZXNvbHZlIGNhbGxiYWNrLCBhbmQgYW55IGVycm9yIG1lc3NhZ2VzXG4vLyBhcmUgcmV0dXJuZWQgYXMgSFRNTCB0ZXh0IGluIHRoZSByZWplY3QgY2FsbGJhY2suXG4vL1xuLy8gYXJnczpcbi8vICBnbCAgICAgICAgICAgICAtLSBXZWJHTCBjb250ZXh0XG4vLyAgdmVydGV4U291cmNlICAgLS0gVVJMIG9mIHRoZSBzaGFkZXIgc291cmNlXG4vLyAgZnJhZ21lbnRTb3VyY2UgLS0gVVJMIG9mIHRoZSBmcmFnbWVudCBzaGFkZXJcblxuZnVuY3Rpb24gY29tcGlsZV9wcm9ncmFtICggZ2wsIHZlcnRleFNvdXJjZSwgZnJhZ21lbnRTb3VyY2UgKSB7XG5cbiAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUscmVqZWN0KSB7XG4gICAgdmFyIG1lc3NhZ2UgPSBcIlwiO1xuICAgIHZhciB2ZXJ0ZXhfc2hhZGVyID0gXCJcIjtcbiAgICB2YXIgZnJhZ21lbnRfc2hhZGVyID0gXCJcIjtcbiAgICBcbiAgICAvLyBDcmVhdGUgdGhlIHByb2dyYW1cbiAgICB2YXIgZ2xQcm9ncmFtID0gZ2wuY3JlYXRlUHJvZ3JhbSgpO1xuICAgIFxuICAgIC8vIExvYWQgb3VyIHNoYWRlcnNcbiAgICBmZXRjaF9maWxlKHZlcnRleFNvdXJjZSkudGhlbihmdW5jdGlvbih0ZXh0KSB7XG4gICAgICB2ZXJ0ZXhfc2hhZGVyID0gdGV4dDtcbiAgICAgIHJldHVybiBmZXRjaF9maWxlKGZyYWdtZW50U291cmNlKTtcbiAgICB9KS50aGVuIChmdW5jdGlvbih0ZXh0KXtcbiAgICAgIGZyYWdtZW50X3NoYWRlciA9IHRleHQ7XG4gICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG4gICAgfSkudGhlbiAoIGZ1bmN0aW9uKCkge1xuICAgICAgXG4gICAgICB2YXIgdmVydGV4U2hhZGVyID0gZ2wuY3JlYXRlU2hhZGVyKGdsLlZFUlRFWF9TSEFERVIpO1xuICAgICAgZ2wuc2hhZGVyU291cmNlKHZlcnRleFNoYWRlciwgdmVydGV4X3NoYWRlcik7XG4gICAgICBnbC5jb21waWxlU2hhZGVyKHZlcnRleFNoYWRlcik7XG4gICAgICBpZiAoIWdsLmdldFNoYWRlclBhcmFtZXRlcih2ZXJ0ZXhTaGFkZXIsIGdsLkNPTVBJTEVfU1RBVFVTKSkge1xuICAgICAgICBtZXNzYWdlID0gbWVzc2FnZSArIFwiPGg0PnZlcnRleDwvaDM+PHByZT5cIiArIGdsLmdldFNoYWRlckluZm9Mb2codmVydGV4U2hhZGVyKSArIFwiPC9wcmU+XCI7XG4gICAgICB9XG4gICAgICBcbiAgICAgIHZhciBmcmFnbWVudFNoYWRlciA9IGdsLmNyZWF0ZVNoYWRlcihnbC5GUkFHTUVOVF9TSEFERVIpO1xuICAgICAgZ2wuc2hhZGVyU291cmNlKGZyYWdtZW50U2hhZGVyLCBmcmFnbWVudF9zaGFkZXIpO1xuICAgICAgZ2wuY29tcGlsZVNoYWRlcihmcmFnbWVudFNoYWRlcik7XG4gICAgICBpZiAoIWdsLmdldFNoYWRlclBhcmFtZXRlcihmcmFnbWVudFNoYWRlciwgZ2wuQ09NUElMRV9TVEFUVVMpKSB7XG4gICAgICAgIG1lc3NhZ2UgPSBtZXNzYWdlICsgXCI8aDQ+ZnJhZ21lbnQ8L2gzPjxwcmU+XCIgKyBnbC5nZXRTaGFkZXJJbmZvTG9nKGZyYWdtZW50U2hhZGVyKSArIFwiPC9wcmU+XCI7XG4gICAgICB9XG5cbiAgICAgIGlmICggbWVzc2FnZSAhPSBcIlwiKSB7XG4gICAgICAgIG1lc3NhZ2UgPSBtZXNzYWdlLnJlcGxhY2UoL1xcMC9nLCBcIlwiKTtcbiAgICAgICAgbWVzc2FnZSA9IG1lc3NhZ2UucmVwbGFjZSgvXFxuL2csIFwiPGJyPlwiKTtcbiAgICAgICAgcmVqZWN0KG1lc3NhZ2UpO1xuICAgICAgfVxuXG4gICAgICB0cnkge1xuICAgICAgICBnbC5hdHRhY2hTaGFkZXIoZ2xQcm9ncmFtLCB2ZXJ0ZXhTaGFkZXIpO1xuICAgICAgICBjaGVja0dMRXJyb3IoZ2wpO1xuICAgICAgICBnbC5hdHRhY2hTaGFkZXIoZ2xQcm9ncmFtLCBmcmFnbWVudFNoYWRlcik7XG4gICAgICAgIGNoZWNrR0xFcnJvcihnbCk7XG4gICAgICAgIGdsLmxpbmtQcm9ncmFtKGdsUHJvZ3JhbSk7XG4gICAgICAgIGNoZWNrR0xFcnJvcihnbCk7XG4gICAgICB9IGNhdGNoICggbWVzc2FnZSApIHtcbiAgICAgICAgcmVqZWN0KG1lc3NhZ2UpO1xuICAgICAgfVxuICAgICAgcmVzb2x2ZShnbFByb2dyYW0pXG4gICAgICBcbiAgICB9KTtcbiAgfSk7XG59XG4iLCIvLyBDcmVhdGUgYSBmbG9hdGluZyBwb2ludCBidWZmZXIuXG4vL1xuLy8gYXJnczpcbi8vICAgciAgLS0gcmVnaXN0cmF0aW9uIG9iamVjdFxuLy8gICB3ICAtLSB3aWR0aCBvZiBidWZmZXJcbi8vICAgaCAgLS0gaGVpZ2h0IG9mIGJ1ZmZlclxuXG5mdW5jdGlvbiBjcmVhdGVfZmxvYXRfdGV4dHVyZSAoIHIsIHcsIGggKSB7XG4gIHZhciBnbCA9IHIuZ2w7XG5cbiAgLy8gRW5hYmxlIGV4dGVuc2lvbnNcbiAgZ2wuZ2V0RXh0ZW5zaW9uICggJ09FU190ZXh0dXJlX2Zsb2F0Jyk7XG4gIGdsLmdldEV4dGVuc2lvbiAoICdPRVNfdGV4dHVyZV9mbG9hdF9saW5lYXInKTtcbiAgZ2wuZ2V0RXh0ZW5zaW9uICggJ09FU190ZXh0dXJlX2hhbGZfZmxvYXQnKTtcbiAgZ2wuZ2V0RXh0ZW5zaW9uICggJ09FU190ZXh0dXJlX2hhbGZfZmxvYXRfbGluZWFyJyk7XG4gIFxuICB2YXIgZGlmZmVyZW5jZVRleHR1cmUgPSBnbC5jcmVhdGVUZXh0dXJlKCk7XG4gIGdsLmJpbmRUZXh0dXJlKGdsLlRFWFRVUkVfMkQsIGRpZmZlcmVuY2VUZXh0dXJlKTtcbiAgXG4gIGdsLnRleEltYWdlMkQoZ2wuVEVYVFVSRV8yRCwgMCwgZ2wuUkdCQSwgdywgaCwgMCwgZ2wuUkdCQSwgZ2wuRkxPQVQsIG51bGwpO1xuICBnbC50ZXhQYXJhbWV0ZXJpKGdsLlRFWFRVUkVfMkQsIGdsLlRFWFRVUkVfTUFHX0ZJTFRFUiwgZ2wuTElORUFSKTtcbiAgZ2wudGV4UGFyYW1ldGVyaShnbC5URVhUVVJFXzJELCBnbC5URVhUVVJFX01JTl9GSUxURVIsIGdsLkxJTkVBUik7XG4gIGdsLnRleFBhcmFtZXRlcmkoZ2wuVEVYVFVSRV8yRCwgZ2wuVEVYVFVSRV9XUkFQX1MsIGdsLkNMQU1QX1RPX0VER0UpO1xuICBnbC50ZXhQYXJhbWV0ZXJpKGdsLlRFWFRVUkVfMkQsIGdsLlRFWFRVUkVfV1JBUF9ULCBnbC5DTEFNUF9UT19FREdFKTtcblxuICBnbC5iaW5kVGV4dHVyZShnbC5URVhUVVJFXzJELCBudWxsKTtcbiAgcmV0dXJuIGRpZmZlcmVuY2VUZXh0dXJlO1xufVxuXG4vLyBDcmVhdGUgYSB0ZXh0dXJlIGJ1ZmZlci5cbi8vXG4vLyBhcmdzOlxuLy8gICByICAtLSByZWdpc3RyYXRpb24gb2JqZWN0XG4vLyAgIHcgIC0tIHdpZHRoIG9mIGJ1ZmZlclxuLy8gICBoICAtLSBoZWlnaHQgb2YgYnVmZmVyXG5cbmZ1bmN0aW9uIGNyZWF0ZV90ZXh0dXJlICggciwgdywgaCApIHtcbiAgdmFyIGdsID0gci5nbDtcbiAgXG4gIHZhciBkaWZmZXJlbmNlVGV4dHVyZSA9IGdsLmNyZWF0ZVRleHR1cmUoKTtcbiAgZ2wuYmluZFRleHR1cmUoZ2wuVEVYVFVSRV8yRCwgZGlmZmVyZW5jZVRleHR1cmUpO1xuICBcbiAgZ2wudGV4SW1hZ2UyRChnbC5URVhUVVJFXzJELCAwLCBnbC5SR0JBLCB3LCBoLCAwLCBnbC5SR0JBLCBnbC5VTlNJR05FRF9CWVRFLCBudWxsKTtcbiAgZ2wudGV4UGFyYW1ldGVyaShnbC5URVhUVVJFXzJELCBnbC5URVhUVVJFX01BR19GSUxURVIsIGdsLkxJTkVBUik7XG4gIGdsLnRleFBhcmFtZXRlcmkoZ2wuVEVYVFVSRV8yRCwgZ2wuVEVYVFVSRV9NSU5fRklMVEVSLCBnbC5MSU5FQVIpO1xuICBnbC50ZXhQYXJhbWV0ZXJpKGdsLlRFWFRVUkVfMkQsIGdsLlRFWFRVUkVfV1JBUF9TLCBnbC5DTEFNUF9UT19FREdFKTtcbiAgZ2wudGV4UGFyYW1ldGVyaShnbC5URVhUVVJFXzJELCBnbC5URVhUVVJFX1dSQVBfVCwgZ2wuQ0xBTVBfVE9fRURHRSk7XG5cbiAgZ2wuYmluZFRleHR1cmUoZ2wuVEVYVFVSRV8yRCwgbnVsbCk7XG4gIHJldHVybiBkaWZmZXJlbmNlVGV4dHVyZTtcbn1cblxuIiwiLypcbiAgZGVtb25zU3RlcCAtLSBjYWxjdWxhdGUgb25lIHN0ZXAgaW4gdGhlIGRlbW9uJ3MgYWxnb3J0aGltLCBpLmUuIHVwZGF0ZSBgcmBcbiAgUGFyYW1ldGVyczpcbiAgICByIC0tIHJlZ2lzdHJhdGlvbiBvYmplY3RcbiAgICBjb3VudCAtLSBudW1iZXIgb2Ygc3RlcHNcbiAgMS4gdHJhbnNmb3JtIHRoZSBtb3ZpbmdJbWFnZSB1c2luZyB0aGUgYGRpc3BsYWNlYCBrZXJuZWxcbiAgMi4gY2FsY3VsYXRlIHRoZSBtb3ZpbmdJbWFnZSBncmFkaWVudFxuICAzLiBzbW9vdGggdGhlIG1vdmluZ0ltYWdlIGdyYWRpZW50XG4gIDQuIGNhbGN1bGF0ZSBgZHJgLCB0aGUgZGVsdGEgaW4gYHJgXG4gIDUuIHNtb290aCBgZHJgXG4gIDYuIHVwZGF0ZSBgcmBcbiAgNy4gc21vb3RoIGByYFxuICovXG5cbmZ1bmN0aW9uIGRlbW9uc1N0ZXAocixjb3VudCkge1xuICBjb3VudCA9IGNvdW50IHx8IDE7XG4gIGNvbnNvbGUubG9nKFwiUnVubmluZyBcIiArIGNvdW50ICsgXCIgc3RlcHMgaW4gdGhlIERlbW9uJ3MgYWxnb3JpdGhtXCIpO1xuXG4gIC8vIGRlbHRhIGJldHdlZW4gcGl4ZWxzLCBpLmUuIDEgLyBpbWFnZSBzaXplXG4gIHZhciBkZWx0YSA9IDEvNTEyLjtcbiAgXG4gIC8vIFNpZ21hcyBhcmUgaW4gcGl4ZWxzXG4gIHZhciBpbWFnZVNpZ21hID0gMC4wO1xuICB2YXIgZ3JhZGllbnRTaWdtYSA9IDAuMDtcbiAgdmFyIGRyU2lnbWEgPSA1LjA7XG4gIHZhciByU2lnbWEgPSAwLjA7XG5cbiAgLy8gSG93IGZhc3QgdG8gdXBkYXRlXG4gIHZhciBzY2FsZSA9IDAuMjtcbiAgXG4gIHZhciBnbCA9IHIuZ2w7XG4gIGdsLmJpbmRGcmFtZWJ1ZmZlcihnbC5GUkFNRUJVRkZFUiwgci5mcmFtZWJ1ZmZlcik7XG4gIGdsLnZpZXdwb3J0KDAsMCw1MTIsNTEyKTtcbiAgXG4gIGZvciAoIHZhciBjb3VudGVyID0gMDsgY291bnRlciA8IGNvdW50OyBjb3VudGVyKysgKSB7XG4gICAgLy8gVXBkYXRlIG1vdmluZyBpbWFnZVxuICAgIGdsLmZyYW1lYnVmZmVyVGV4dHVyZTJEKGdsLkZSQU1FQlVGRkVSLCBnbC5DT0xPUl9BVFRBQ0hNRU5UMCwgZ2wuVEVYVFVSRV8yRCwgci50ZXh0dXJlc1tcImRpc3BsYWNlZFwiXSwgMCk7XG4gICAgcmVuZGVyICggciwgci5wcm9ncmFtc1tcImRpc3BsYWNlXCJdLCBbXG4gICAgICB7bmFtZTogXCJtb3ZpbmdJbWFnZVwiLCB2YWx1ZTogci5tb3ZpbmdUZXh0dXJlfSxcbiAgICAgIHtuYW1lOiBcInJcIiwgdmFsdWU6IHIudGV4dHVyZXNbXCJyXCJdfSxcbiAgICAgIHtuYW1lOiBcInNjYWxlXCIsIHZhbHVlOiBzY2FsZX0sXG4gICAgXSk7XG5cbiAgICAvLyBTbW9vdGggdGhlIGRpc3BsYWNlZCBpbWFnZVxuICAgIHNtb290aEJ1ZmZlciAoIHIsIFwiZGlzcGxhY2VkXCIsIGltYWdlU2lnbWEsIGRlbHRhICk7XG4gICAgXG4gICAgLy8gQ2FsY3VsYXRlIHRoZSBncmFkaWVudHNcbiAgICBnbC5mcmFtZWJ1ZmZlclRleHR1cmUyRChnbC5GUkFNRUJVRkZFUiwgZ2wuQ09MT1JfQVRUQUNITUVOVDAsIGdsLlRFWFRVUkVfMkQsIHIudGV4dHVyZXNbXCJCXCJdLCAwKTtcbiAgICByZW5kZXIgKCByLCByLnByb2dyYW1zW1wiY29weVwiXSwgW1xuICAgICAge25hbWU6IFwiaW1hZ2VcIiwgdmFsdWU6IHIudGV4dHVyZXNbXCJmaXhlZFwiXX0sXG4gICAgXSk7XG4gICAgXG4gICAgc21vb3RoQnVmZmVyICggciwgXCJBXCIsIGltYWdlU2lnbWEsIGRlbHRhICk7XG4gICAgZ2wuYmluZEZyYW1lYnVmZmVyKGdsLkZSQU1FQlVGRkVSLCByLmZyYW1lYnVmZmVyKTtcbiAgICBnbC5mcmFtZWJ1ZmZlclRleHR1cmUyRChnbC5GUkFNRUJVRkZFUiwgZ2wuQ09MT1JfQVRUQUNITUVOVDAsIGdsLlRFWFRVUkVfMkQsIHIudGV4dHVyZXNbXCJmaXhlZEdyYWRpZW50XCJdLCAwKTtcbiAgICByZW5kZXIgKCByLCByLnByb2dyYW1zW1wiZ3JhZGllbnRcIl0sIFtcbiAgICAgIHtuYW1lOiBcImltYWdlXCIsIHZhbHVlOiByLnRleHR1cmVzW1wiQlwiXX0sXG4gICAgICB7bmFtZTogXCJkZWx0YVwiLCB2YWx1ZTogZGVsdGF9LFxuICAgIF0pO1xuICAgIC8vIFNtb290aCB0aGUgZ3JhZGllbnRcbiAgICBzbW9vdGhCdWZmZXIgKCByLCBcImZpeGVkR3JhZGllbnRcIiwgZ3JhZGllbnRTaWdtYSwgZGVsdGEgKTtcbiAgICBcbiAgICBnbC5iaW5kRnJhbWVidWZmZXIoZ2wuRlJBTUVCVUZGRVIsIHIuZnJhbWVidWZmZXIpO1xuICAgIGdsLmZyYW1lYnVmZmVyVGV4dHVyZTJEKGdsLkZSQU1FQlVGRkVSLCBnbC5DT0xPUl9BVFRBQ0hNRU5UMCwgZ2wuVEVYVFVSRV8yRCwgci50ZXh0dXJlc1tcIm1vdmluZ0dyYWRpZW50XCJdLCAwKTtcbiAgICByZW5kZXIgKCByLCByLnByb2dyYW1zW1wiZ3JhZGllbnRcIl0sIFtcbiAgICAgIHtuYW1lOiBcImltYWdlXCIsIHZhbHVlOiByLnRleHR1cmVzWydkaXNwbGFjZWQnXX0sXG4gICAgICB7bmFtZTogXCJkZWx0YVwiLCB2YWx1ZTogZGVsdGF9LFxuICAgIF0pO1xuICAgIC8vIFNtb290aCB0aGUgZ3JhZGllbnRcbiAgICBzbW9vdGhCdWZmZXIgKCByLCBcIm1vdmluZ0dyYWRpZW50XCIsIGdyYWRpZW50U2lnbWEsIGRlbHRhICk7XG5cbiAgICAvLyA0LiBjYWxjdWxhdGUgYGRyYCwgdGhlIGRlbHRhIGluIGByYFxuICAgIGdsLmJpbmRGcmFtZWJ1ZmZlcihnbC5GUkFNRUJVRkZFUiwgci5mcmFtZWJ1ZmZlcik7XG4gICAgZ2wuZnJhbWVidWZmZXJUZXh0dXJlMkQoZ2wuRlJBTUVCVUZGRVIsIGdsLkNPTE9SX0FUVEFDSE1FTlQwLCBnbC5URVhUVVJFXzJELCByLnRleHR1cmVzW1wiZHJcIl0sIDApO1xuICAgIHJlbmRlciAoIHIsIHIucHJvZ3JhbXNbXCJkaXNwbGFjZW1lbnRcIl0sIFtcbiAgICAgIHtuYW1lOiBcImZpeGVkSW1hZ2VcIiwgdmFsdWU6IHIudGV4dHVyZXNbXCJmaXhlZFwiXX0sXG4gICAgICB7bmFtZTogXCJmaXhlZEltYWdlR3JhZGllbnRcIiwgdmFsdWU6IHIudGV4dHVyZXNbXCJmaXhlZEdyYWRpZW50XCJdfSxcbiAgICAgIHtuYW1lOiBcIm1vdmluZ0ltYWdlXCIsIHZhbHVlOiByLnRleHR1cmVzW1wiZGlzcGxhY2VkXCJdfSxcbiAgICAgIHtuYW1lOiBcIm1vdmluZ0ltYWdlR3JhZGllbnRcIiwgdmFsdWU6IHIudGV4dHVyZXNbXCJtb3ZpbmdHcmFkaWVudFwiXX0sXG4gICAgICB7bmFtZTogXCJzcGFjaW5nXCIsIHZhbHVlOiAxLjB9LFxuICAgIF0pO1xuXG4gICAgLy8gNS4gc21vb3RoIGBkcmBcbiAgICBzbW9vdGhCdWZmZXIgKCByLCBcImRyXCIsIGRyU2lnbWEsIGRlbHRhICk7XG4gICAgXG4gICAgLy8gNi4gdXBkYXRlIGByYFxuICAgIC8vIENhbGN1bGF0ZSB0byBcIkFcIiwgY29weSB0byBcInJcIlxuICAgIGdsLmZyYW1lYnVmZmVyVGV4dHVyZTJEKGdsLkZSQU1FQlVGRkVSLCBnbC5DT0xPUl9BVFRBQ0hNRU5UMCwgZ2wuVEVYVFVSRV8yRCwgci50ZXh0dXJlc1tcIkFcIl0sIDApO1xuICAgIHJlbmRlciAoIHIsIHIucHJvZ3JhbXNbXCJ1cGRhdGVSXCJdLCBbXG4gICAgICB7bmFtZTogXCJyXCIsIHZhbHVlOiByLnRleHR1cmVzW1wiclwiXX0sXG4gICAgICB7bmFtZTogXCJkclwiLCB2YWx1ZTogci50ZXh0dXJlc1tcImRyXCJdfSxcbiAgICBdKTtcblxuICAgIGdsLmZyYW1lYnVmZmVyVGV4dHVyZTJEKGdsLkZSQU1FQlVGRkVSLCBnbC5DT0xPUl9BVFRBQ0hNRU5UMCwgZ2wuVEVYVFVSRV8yRCwgci50ZXh0dXJlc1tcInJcIl0sIDApO1xuICAgIHJlbmRlciAoIHIsIHIucHJvZ3JhbXNbXCJjb3B5XCJdLCBbXG4gICAgICB7bmFtZTogXCJpbWFnZVwiLCB2YWx1ZTogci50ZXh0dXJlc1tcIkFcIl19LFxuICAgIF0pO1xuICAgIFxuICAgIC8vIDcuIHNtb290aCBgcmBcbiAgICBzbW9vdGhCdWZmZXIgKCByLCBcInJcIiwgclNpZ21hLCBkZWx0YSApO1xuICAgIFxuICAgIGdsLmZyYW1lYnVmZmVyVGV4dHVyZTJEKGdsLkZSQU1FQlVGRkVSLCBnbC5DT0xPUl9BVFRBQ0hNRU5UMCwgZ2wuVEVYVFVSRV8yRCwgci50ZXh0dXJlc1tcImRpZmZlcmVuY2VcIl0sIDApO1xuICAgIHJlbmRlciAoIHIsIHIucHJvZ3JhbXNbXCJkaWZmZXJlbmNlXCJdLCBbXG4gICAgICB7bmFtZTogXCJtb3ZpbmdJbWFnZVwiLCB2YWx1ZTogci50ZXh0dXJlc1tcImRpc3BsYWNlZFwiXX0sXG4gICAgICB7bmFtZTogXCJmaXhlZEltYWdlXCIsIHZhbHVlOiByLnRleHR1cmVzW1wiZml4ZWRcIl19LFxuICAgIF0pO1xuXG4gIH0gIFxufVxuXG5mdW5jdGlvbiBzbW9vdGhCdWZmZXIgKCByLCBidWZmZXIsIHNpZ21hLCBkZWx0YSApIHtcbiAgaWYgKCBzaWdtYSA9PSAwLjAgKSB7IHJldHVybjsgfVxuICAvLyBGaXJzdCBkbyBob3Jpem9udGFsIHBhc3MgZnJvbSBidWZmZXIgaW50byBcIkJcIlxuICAvLyBTZWNvbmQgZG8gdmVydGljYWwgcGFzcyBmcm9tIFwiQlwiIGludG8gYnVmZmVyXG4gIHZhciBnbCA9IHIuZ2w7XG4gIHZhciB0bXBCdWZmZXIgPSBcIkFcIjtcbiAgZ2wuYmluZEZyYW1lYnVmZmVyKGdsLkZSQU1FQlVGRkVSLCByLmZyYW1lYnVmZmVyKTtcbiAgZ2wuZnJhbWVidWZmZXJUZXh0dXJlMkQoZ2wuRlJBTUVCVUZGRVIsIGdsLkNPTE9SX0FUVEFDSE1FTlQwLCBnbC5URVhUVVJFXzJELCByLnRleHR1cmVzW3RtcEJ1ZmZlcl0sIDApO1xuICByZW5kZXIgKCByLCByLnByb2dyYW1zW1wic21vb3RoXCJdLCBbXG4gICAge25hbWU6IFwiaW1hZ2VcIiwgdmFsdWU6IHIudGV4dHVyZXNbYnVmZmVyXX0sXG4gICAge25hbWU6IFwiZGVsdGFcIiwgdmFsdWU6IGRlbHRhfSxcbiAgICB7bmFtZTogXCJzaWdtYVwiLCB2YWx1ZTogc2lnbWF9LFxuICAgIHtuYW1lOiBcImRpcmVjdGlvblwiLCB2YWx1ZTogMH0sXG4gIF0pO1xuICBnbC5iaW5kRnJhbWVidWZmZXIoZ2wuRlJBTUVCVUZGRVIsIHIuZnJhbWVidWZmZXIpO1xuICBnbC5mcmFtZWJ1ZmZlclRleHR1cmUyRChnbC5GUkFNRUJVRkZFUiwgZ2wuQ09MT1JfQVRUQUNITUVOVDAsIGdsLlRFWFRVUkVfMkQsIHIudGV4dHVyZXNbYnVmZmVyXSwgMCk7XG4gIHJlbmRlciAoIHIsIHIucHJvZ3JhbXNbXCJzbW9vdGhcIl0sIFtcbiAgICB7bmFtZTogXCJpbWFnZVwiLCB2YWx1ZTogci50ZXh0dXJlc1t0bXBCdWZmZXJdfSxcbiAgICB7bmFtZTogXCJkZWx0YVwiLCB2YWx1ZTogZGVsdGF9LFxuICAgIHtuYW1lOiBcInNpZ21hXCIsIHZhbHVlOiBzaWdtYX0sXG4gICAge25hbWU6IFwiZGlyZWN0aW9uXCIsIHZhbHVlOiAxfSxcbiAgXSk7XG59XG4iLCIvLyBGZXRjaCBhIGZpbGUgYXN5bmMgYW5kIHJldHVybiBhIHByb21pc2UuXG4vLyBUaGUgYHJlc29sdmVgIGNhbGxiYWNrIHJldHVybnMgdGhlIHRleHQsIHdoaWxlXG4vLyBgcmVqZWN0YCByZXR1cm5zIGEgdGV4dCBtZXNzYWdlIHdpdGggdGhlIGVycm9yLlxuLy9cbi8vIGFyZ3M6XG4vLyAgIHVybCAtLSB1cmwgb2YgdGhlIHRleHQgdG8gZ2V0XG5cbmZ1bmN0aW9uIGZldGNoX2ZpbGUodXJsLCBhc3luYylcbntcbiAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUscmVqZWN0KSB7XG5cdCAgdmFyIHJlcXVlc3QgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcblx0ICByZXF1ZXN0Lm9wZW4oXCJHRVRcIiwgdXJsKTtcblx0ICByZXF1ZXN0Lm92ZXJyaWRlTWltZVR5cGUoXCJ0ZXh0L3BsYWluXCIpO1xuXG4gICAgcmVxdWVzdC5vbmxvYWQgPSBmdW5jdGlvbigpIHtcbiAgICAgIC8vIENhbGxlZCBldmVuIG9uIDQwNCBlcnJvcnMsIHNvIGNoZWNrIHRoZSBzdGF0dXNcbiAgICAgIGlmIChyZXF1ZXN0LnN0YXR1cyA9PSAyMDApIHtcbiAgICAgICAgLy8gUmVzb2x2ZSB0aGUgcHJvbWlzZSB3aXRoIHRoZSByZXNwb25zZSB0ZXh0XG4gICAgICAgIHJlc29sdmUocmVxdWVzdC5yZXNwb25zZVRleHQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gT3RoZXJ3aXNlIHJlamVjdCB3aXRoIHRoZSBzdGF0dXMgdGV4dFxuICAgICAgICAvLyB3aGljaCB3aWxsIGhvcGVmdWxseSBiZSBhIG1lYW5pbmdmdWwgZXJyb3JcbiAgICAgICAgcmVqZWN0KHJlcXVlc3Quc3RhdHVzVGV4dCk7XG4gICAgICB9XG4gICAgfTtcbiAgICAvLyBIYW5kbGUgbmV0d29yayBlcnJvcnNcbiAgICByZXF1ZXN0Lm9uZXJyb3IgPSBmdW5jdGlvbigpIHtcbiAgICAgIHJlamVjdChcIk5ldHdvcmsgRXJyb3JcIik7XG4gICAgfTtcblx0ICByZXF1ZXN0LnNlbmQoKTtcbiAgfSk7XG59XG4iLCJcblxuLy8gTG9hZCBhbiBpbWFnZSBpbnRvIHRoZSBHTCBjb250ZXh0IGFuZCByZXR1cm4gdGhlIHRleHR1cmUgaWRlbnRpZmllciBpbiBhIHByb21pc2UuXG4vLyBSZXR1cm5zIGEgcHJvbWlzZS4gIFRoZSBgcmVzb2x2ZWAgY2FsbGJhY2sgcmV0dXJucyB0aGUgdGV4dHVyZS4gIFRoZSBgcmVqZWN0YCBjYWxsYmFja1xuLy8gcmV0dXJucyBhIHN0cmluZyBkZXNjcmliaW5nIHRoZSBlcnJvci5cbi8vXG4vLyBhcmdzOlxuLy8gIGdsICAtLSBXZWJHTCBjb250ZXh0XG4vLyAgdXJsIC0tIFVSTCBvZiB0aGUgaW1hZ2UgdG8gbG9hZFxuXG5mdW5jdGlvbiBsb2FkX2ltYWdlICggZ2wsIHVybCApIHtcbiAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCl7XG4gICAgdmFyIGZpeGVkVGV4dHVyZUltYWdlID0gbmV3IEltYWdlKCk7XG4gICAgZml4ZWRUZXh0dXJlSW1hZ2Uuc3JjID0gdXJsO1xuICAgIGZpeGVkVGV4dHVyZUltYWdlLm9ubG9hZCA9IGZ1bmN0aW9uKCkge1xuICAgICAgLy8gQmluZCB0aGlzIGltYWdlIHRvIGZpeGVkVGV4dHVyZVxuICAgICAgdmFyIGZpeGVkVGV4dHVyZSA9IGdsLmNyZWF0ZVRleHR1cmUoKTtcbiAgICAgIGdsLmJpbmRUZXh0dXJlKGdsLlRFWFRVUkVfMkQsIGZpeGVkVGV4dHVyZSk7XG4gICAgICBnbC5waXhlbFN0b3JlaShnbC5VTlBBQ0tfRkxJUF9ZX1dFQkdMLCB0cnVlKTtcbiAgICAgIC8vIGFyZ3MgdG8gdGV4SW1hZ2UyZCBhcmU6IHRhcmdldCAoMkQgb3IgY3ViZSksIExPRCBsZXZlbCAoMCksIGludGVybmFsIGZvcm1hdCAoUkdCQSksICBmb3JtYXQgKFJHQkEpLCBpbWFnZVxuICAgICAgZ2wudGV4SW1hZ2UyRChnbC5URVhUVVJFXzJELCAwLCBnbC5SR0JBLCBnbC5SR0JBLCBnbC5VTlNJR05FRF9CWVRFLCBmaXhlZFRleHR1cmVJbWFnZSk7XG4gICAgICBnbC50ZXhQYXJhbWV0ZXJpKGdsLlRFWFRVUkVfMkQsIGdsLlRFWFRVUkVfTUFHX0ZJTFRFUiwgZ2wuTElORUFSKTtcbiAgICAgIGdsLnRleFBhcmFtZXRlcmkoZ2wuVEVYVFVSRV8yRCwgZ2wuVEVYVFVSRV9NSU5fRklMVEVSLCBnbC5MSU5FQVIpO1xuICAgICAgZ2wudGV4UGFyYW1ldGVyaShnbC5URVhUVVJFXzJELCBnbC5URVhUVVJFX1dSQVBfUywgZ2wuQ0xBTVBfVE9fRURHRSk7XG4gICAgICBnbC50ZXhQYXJhbWV0ZXJpKGdsLlRFWFRVUkVfMkQsIGdsLlRFWFRVUkVfV1JBUF9ULCBnbC5DTEFNUF9UT19FREdFKTtcblxuICAgICAgcmVzb2x2ZShmaXhlZFRleHR1cmUpO1xuICAgIH07XG4gICAgXG4gICAgZml4ZWRUZXh0dXJlSW1hZ2Uub25hYm9ydCA9IGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICByZWplY3QoZXZlbnQubWVzc2FnZSk7XG4gICAgfTtcbiAgfSk7XG59XG4iLCIvLyBSZWFkIHRleHR1cmUgaW50byBGbG9hdCBhcnJheVxuLy9cbi8vIGFyZ3M6XG4vLyAgIHIgIC0tIHJlZ2lzdHJhdGlvbiBvYmplY3Rcbi8vICAgdCAgLS0gdGV4dHVyZSB0byByZWFkXG4vLyAgIHcgIC0tIHdpZHRoIG9mIGJ1ZmZlclxuLy8gICBoICAtLSBoZWlnaHQgb2YgYnVmZmVyXG5cblxuZnVuY3Rpb24gcmVhZF90ZXh0dXJlICggciwgdCwgdywgaCApIHtcbiAgdmFyIGdsID0gci5nbDtcblxuICB2YXIgb3V0ID0gbmV3IEZsb2F0MzJBcnJheSgzKncqaCk7XG5cblxuICBmb3IgKCB2YXIgaW5kZXggPSAwOyBpbmRleCA8IDM7IGluZGV4KysgKSB7XG4gICAgdmFyIHBpeGVscyA9IG5ldyBVaW50OEFycmF5KHcqaCAqIDQpO1xuICAgIGdsLmJpbmRGcmFtZWJ1ZmZlcihnbC5GUkFNRUJVRkZFUiwgci5mcmFtZWJ1ZmZlcik7XG4gICAgZ2wuZnJhbWVidWZmZXJUZXh0dXJlMkQoZ2wuRlJBTUVCVUZGRVIsIGdsLkNPTE9SX0FUVEFDSE1FTlQwLCBnbC5URVhUVVJFXzJELCByLnRleHR1cmVzWydlbmNvZGUnXSwgMCk7XG4gICAgcmVuZGVyICggciwgci5wcm9ncmFtc1tcImVuY29kZV9mbG9hdFwiXSwgW1xuICAgICAge25hbWU6IFwiaW1hZ2VcIiwgdmFsdWU6IHR9LFxuICAgICAge25hbWU6IFwiaW5kZXhcIiwgdmFsdWU6IGluZGV4fSxcbiAgICBdKTsgIFxuXG4gICAgZ2wucmVhZFBpeGVscygwLCAwLCB3LCBoLCBnbC5SR0JBLCBnbC5VTlNJR05FRF9CWVRFLCBwaXhlbHMpO1xuICAgIG91dC5zZXQobmV3IEZsb2F0MzJBcnJheShwaXhlbHMuYnVmZmVyKSwgaW5kZXgqdypoKTtcbiAgfVxuICByZXR1cm4gb3V0O1xuICBcbn1cbiIsIlxuXG52YXIgcmVnaXN0ZXIgPSB7XG5cbiAgY2FudmFzOiBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2FudmFzJyksXG4gIGdsOiBudWxsLFxuXG4gIC8vIFRleHR1cmVzXG4gIGZpeGVkVGV4dHVyZTogbnVsbCxcbiAgbW92aW5nVGV4dHVyZTogbnVsbCxcblxuICAvLyBDdXJyZW50bHkgZGlzcGxheWVkIGltYWdlIHZhbHVlc1xuICBwaXhlbHM6IG51bGwsXG4gIFxuICAvLyBidWZmZXIgaXMgdGhlIGdlbW90ZXJ5IGFycmF5IGZvciB0aGUgdHJpYW5nbGVzXG4gIGJ1ZmZlcjogbnVsbCxcblxuICAvLyBUZXh0dXJlIGNvb3JkaW5hdGVzXG4gIHRleHR1cmVDb29yZEJ1ZmZlcjogbnVsbCxcblxuICAvLyBwcm9ncmFtc1xuICBwcm9ncmFtczoge30sXG4gIC8vIE1ldHJpYyBwcm9ncmFtIHN1YnRyYWN0cyB0d28gdGV4dHVyZXNcbiAgbWV0cmljUHJvZ3JhbTogbnVsbCxcblxuICAvLyBEaXNwbGF5IHByb2dyYW0gc2ltcGx5IHJlbmRlcnMgYW4gaW1hZ2VcbiAgZGlzcGxheVByb2dyYW06IG51bGwsXG5cbiAgLy8gU3VtIHByb2dyYW0gd2lsbCBhZGQgYW5kIGRvd25zYW1wbGVcbiAgc3VtUHJvZ3JhbTogbnVsbCxcblxuICAvLyBGcmFtZWJ1ZmZlclxuICBmcmFtZWJ1ZmZlcjogbnVsbCxcbiAgXG4gIC8vIFRleHR1cmUgZm9yIGRpZmZlcmVuY2UgaW1hZ2VcbiAgdGV4dHVyZXM6IHt9LFxuICBzdW1QeXJhbWlkOiBbXSxcbiAgb3V0UHlyYW1pZDogW10sXG4gIGRpZmZlcmVuY2VUZXh0dXJlOiBudWxsLFxufTtcblxuXG5cbiQoZnVuY3Rpb24oKSB7XG4gIGluaXQoKTtcbn0pO1xuXG5cblxuZnVuY3Rpb24gaW5pdCgpIHtcbiAgdmFyIGdsID0gcmVnaXN0ZXIuZ2wgPSBjYW52YXMuZ2V0Q29udGV4dChcIndlYmdsXCIpO1xuICBcbiAgaWYgKCAhZ2wuZ2V0RXh0ZW5zaW9uKCdPRVNfdGV4dHVyZV9mbG9hdCcpICkge1xuICAgIGFsZXJ0ICggXCJUaGlzIGJyb3dzZXIgZG9lcyBub3Qgc3VwcG9ydCBmbG9hdGluZyBwb2ludCB0ZXh0dXJlcyFcIiApO1xuICB9O1xuXG4gIC8vIE9mZiBzY3JlZW4gZnJhbWUgYnVmZmVyXG4gIHJlZ2lzdGVyLmZyYW1lYnVmZmVyID0gZ2wuY3JlYXRlRnJhbWVidWZmZXIoKTtcbiAgXG4gIC8vIFZlcnRleCBidWZmZXJcbiAgdmFyIGJ1ZmZlciA9IHJlZ2lzdGVyLmJ1ZmZlciA9IGdsLmNyZWF0ZUJ1ZmZlcigpO1xuICBnbC5iaW5kQnVmZmVyKGdsLkFSUkFZX0JVRkZFUiwgYnVmZmVyKTtcbiAgZ2wuYnVmZmVyRGF0YSggZ2wuQVJSQVlfQlVGRkVSLFxuICAgICAgICAgICAgICAgICBuZXcgRmxvYXQzMkFycmF5KFtcbiAgICAgICAgICAgICAgICAgICAgIC0xLjAsIC0xLjAsXG4gICAgICAgICAgICAgICAgICAgICAgMS4wLCAtMS4wLFxuICAgICAgICAgICAgICAgICAgICAgLTEuMCwgIDEuMCxcbiAgICAgICAgICAgICAgICAgICAgIC0xLjAsICAxLjAsXG4gICAgICAgICAgICAgICAgICAgICAgMS4wLCAtMS4wLFxuICAgICAgICAgICAgICAgICAgICAgIDEuMCwgIDEuMF0pLFxuICAgICAgICAgICAgICAgICBnbC5TVEFUSUNfRFJBVyk7XG5cbiAgLy8gVGV4dHVyZSBjb29yZGluYXRlcyBuZWVkIHRvIGNvcnJlc3BvbmQgdG8gdGhlIHZlcnRleCBjb29yZGluYXRlc1xuICB2YXIgdGV4dHVyZUNvb3JkQnVmZmVyID0gcmVnaXN0ZXIudGV4dHVyZUNvb3JkQnVmZmVyID0gZ2wuY3JlYXRlQnVmZmVyKCk7XG4gIGdsLmJpbmRCdWZmZXIoZ2wuQVJSQVlfQlVGRkVSLCB0ZXh0dXJlQ29vcmRCdWZmZXIpO1xuICBnbC5idWZmZXJEYXRhKGdsLkFSUkFZX0JVRkZFUiwgbmV3IEZsb2F0MzJBcnJheShbXG4gICAgMCwwLFxuICAgIDEsMCxcbiAgICAwLDEsXG4gICAgMCwxLFxuICAgIDEsMCxcbiAgICAxLDFdKSwgZ2wuU1RBVElDX0RSQVcpO1xuICBnbC5iaW5kQnVmZmVyKGdsLkFSUkFZX0JVRkZFUiwgbnVsbCk7XG5cbiAgLy8gVGV4dHVyZXMgbmVlZGVkXG4gIHJlZ2lzdGVyLnRleHR1cmVzW1wiQVwiXSA9IGNyZWF0ZV9mbG9hdF90ZXh0dXJlICggcmVnaXN0ZXIsIDUxMiwgNTEyICk7XG4gIHJlZ2lzdGVyLnRleHR1cmVzW1wiQlwiXSA9IGNyZWF0ZV9mbG9hdF90ZXh0dXJlICggcmVnaXN0ZXIsIDUxMiwgNTEyICk7XG4gIHJlZ2lzdGVyLnRleHR1cmVzW1wiZW5jb2RlXCJdID0gY3JlYXRlX2Zsb2F0X3RleHR1cmUgKCByZWdpc3RlciwgNTEyLCA1MTIgKTtcbiAgcmVnaXN0ZXIudGV4dHVyZXNbXCJyXCJdID0gY3JlYXRlX2Zsb2F0X3RleHR1cmUgKCByZWdpc3RlciwgNTEyLCA1MTIgKTtcbiAgcmVnaXN0ZXIudGV4dHVyZXNbXCJkclwiXSA9IGNyZWF0ZV9mbG9hdF90ZXh0dXJlICggcmVnaXN0ZXIsIDUxMiwgNTEyICk7XG4gIHJlZ2lzdGVyLnRleHR1cmVzW1wiZGlmZmVyZW5jZVwiXSA9IGNyZWF0ZV9mbG9hdF90ZXh0dXJlICggcmVnaXN0ZXIsIDUxMiwgNTEyICk7XG4gIHJlZ2lzdGVyLnRleHR1cmVzW1wibW92aW5nR3JhZGllbnRcIl0gPSBjcmVhdGVfZmxvYXRfdGV4dHVyZSAoIHJlZ2lzdGVyLCA1MTIsIDUxMiApO1xuICByZWdpc3Rlci50ZXh0dXJlc1tcImRpc3BsYWNlZFwiXSA9IGNyZWF0ZV9mbG9hdF90ZXh0dXJlICggcmVnaXN0ZXIsIDUxMiwgNTEyICk7XG4gIHJlZ2lzdGVyLnRleHR1cmVzW1wiZml4ZWRHcmFkaWVudFwiXSA9IGNyZWF0ZV9mbG9hdF90ZXh0dXJlICggcmVnaXN0ZXIsIDUxMiwgNTEyICk7XG5cbiAgLy8gTG9hZCB0aGUgaW1hZ2UgdmlhIGEgcHJvbWlzZVxuICAvLyBsb2FkX2ltYWdlKGdsLCBcImltYWdlcy9jb3BkMV9lQkhDVF9zbGljZS5wbmdcIikudGhlbihmdW5jdGlvbih0ZXh0dXJlKXtcbiAgbG9hZF9pbWFnZShnbCwgXCJpbWFnZXMvc21hbGxfc3F1YXJlLnBuZ1wiKS50aGVuKGZ1bmN0aW9uKHRleHR1cmUpe1xuICAgIHJlZ2lzdGVyLmZpeGVkVGV4dHVyZSA9IHRleHR1cmU7XG4gICAgcmVnaXN0ZXIudGV4dHVyZXNbXCJmaXhlZFwiXSA9IHRleHR1cmU7XG4gICAgLy8gcmV0dXJuIGxvYWRfaW1hZ2UoZ2wsXCJpbWFnZXMvY29wZDFfaUJIQ1Rfc2xpY2UucG5nXCIpO1xuICAgIHJldHVybiBsb2FkX2ltYWdlKGdsLFwiaW1hZ2VzL2JpZ19jaXJjbGUucG5nXCIpO1xuICB9KS50aGVuKGZ1bmN0aW9uKHRleHR1cmUpIHtcbiAgICByZWdpc3Rlci5tb3ZpbmdUZXh0dXJlID0gdGV4dHVyZTtcbiAgICByZWdpc3Rlci50ZXh0dXJlc1tcIm1vdmluZ1wiXSA9IHRleHR1cmU7XG4gICAgLy8gQ2hhaW4gY29tcGlsaW5nIHRoZSBjb2RlXG4gICAgcmV0dXJuIGNvbXBpbGVfcHJvZ3JhbShnbCwgXCJzaGFkZXJzL3JlZ2lzdGVyLnZzXCIsIFwic2hhZGVycy9kaXNwbGF5LmZzXCIgKTtcbiAgfSkudGhlbihmdW5jdGlvbihwcm9ncmFtKXtcbiAgICByZWdpc3Rlci5kaXNwbGF5UHJvZ3JhbSA9IHByb2dyYW07XG4gICAgcmV0dXJuIGNvbXBpbGVfcHJvZ3JhbShnbCwgXCJzaGFkZXJzL3JlZ2lzdGVyLnZzXCIsIFwic2hhZGVycy9kaWZmZXJlbmNlLmZzXCIgKTtcbiAgfSkudGhlbihmdW5jdGlvbihwcm9ncmFtKXtcbiAgICByZWdpc3Rlci5wcm9ncmFtc1tcImRpZmZlcmVuY2VcIl0gPSBwcm9ncmFtO1xuICAgIHJldHVybiBjb21waWxlX3Byb2dyYW0oZ2wsIFwic2hhZGVycy9yZWdpc3Rlci52c1wiLCBcInNoYWRlcnMvc2NhbGUuZnNcIiApO1xuICB9KS50aGVuKGZ1bmN0aW9uKHByb2dyYW0pe1xuICAgIHJlZ2lzdGVyLnByb2dyYW1zW1wic2NhbGVcIl0gPSBwcm9ncmFtO1xuICAgIHJldHVybiBjb21waWxlX3Byb2dyYW0oZ2wsIFwic2hhZGVycy9yZWdpc3Rlci52c1wiLCBcInNoYWRlcnMvc3VtLmZzXCIgKTtcbiAgfSkudGhlbihmdW5jdGlvbihwcm9ncmFtKXtcbiAgICByZWdpc3Rlci5wcm9ncmFtc1tcInN1bVwiXSA9IHByb2dyYW07XG4gICAgcmV0dXJuIGNvbXBpbGVfcHJvZ3JhbShnbCwgXCJzaGFkZXJzL3JlZ2lzdGVyLnZzXCIsIFwic2hhZGVycy9jb3B5LmZzXCIgKTtcbiAgfSkudGhlbihmdW5jdGlvbihwcm9ncmFtKXtcbiAgICByZWdpc3Rlci5wcm9ncmFtc1tcImNvcHlcIl0gPSBwcm9ncmFtO1xuICAgIHJldHVybiBjb21waWxlX3Byb2dyYW0oZ2wsIFwic2hhZGVycy9yZWdpc3Rlci52c1wiLCBcInNoYWRlcnMvZW5jb2RlX2Zsb2F0LmZzXCIgKTtcbiAgfSkudGhlbihmdW5jdGlvbihwcm9ncmFtKXtcbiAgICByZWdpc3Rlci5wcm9ncmFtc1tcImVuY29kZV9mbG9hdFwiXSA9IHByb2dyYW07XG4gICAgcmV0dXJuIGNvbXBpbGVfcHJvZ3JhbShnbCwgXCJzaGFkZXJzL3JlZ2lzdGVyLnZzXCIsIFwic2hhZGVycy9ncmFkaWVudC5mc1wiICk7XG4gIH0pLnRoZW4oZnVuY3Rpb24ocHJvZ3JhbSl7XG4gICAgcmVnaXN0ZXIucHJvZ3JhbXNbXCJncmFkaWVudFwiXSA9IHByb2dyYW07XG4gICAgcmV0dXJuIGNvbXBpbGVfcHJvZ3JhbShnbCwgXCJzaGFkZXJzL3JlZ2lzdGVyLnZzXCIsIFwic2hhZGVycy9zbW9vdGguZnNcIiApO1xuICB9KS50aGVuKGZ1bmN0aW9uKHByb2dyYW0pe1xuICAgIHJlZ2lzdGVyLnByb2dyYW1zW1wic21vb3RoXCJdID0gcHJvZ3JhbTtcbiAgICByZXR1cm4gY29tcGlsZV9wcm9ncmFtKGdsLCBcInNoYWRlcnMvcmVnaXN0ZXIudnNcIiwgXCJzaGFkZXJzL2Rpc3BsYWNlbWVudC5mc1wiICk7XG4gIH0pLnRoZW4oZnVuY3Rpb24ocHJvZ3JhbSl7XG4gICAgcmVnaXN0ZXIucHJvZ3JhbXNbXCJkaXNwbGFjZW1lbnRcIl0gPSBwcm9ncmFtO1xuICAgIHJldHVybiBjb21waWxlX3Byb2dyYW0oZ2wsIFwic2hhZGVycy9yZWdpc3Rlci52c1wiLCBcInNoYWRlcnMvdXBkYXRlUi5mc1wiICk7XG4gIH0pLnRoZW4oZnVuY3Rpb24ocHJvZ3JhbSl7XG4gICAgcmVnaXN0ZXIucHJvZ3JhbXNbXCJ1cGRhdGVSXCJdID0gcHJvZ3JhbTtcbiAgICByZXR1cm4gY29tcGlsZV9wcm9ncmFtKGdsLCBcInNoYWRlcnMvcmVnaXN0ZXIudnNcIiwgXCJzaGFkZXJzL2Rpc3BsYWNlLmZzXCIgKTtcbiAgfSkudGhlbihmdW5jdGlvbihwcm9ncmFtKXtcbiAgICByZWdpc3Rlci5wcm9ncmFtc1tcImRpc3BsYWNlXCJdID0gcHJvZ3JhbTtcbiAgICAvLyBzdGFydF9yZW5kZXIocmVnaXN0ZXIpO1xuICAgIGRpc3BsYXkocmVnaXN0ZXIsJChcIiNidWZmZXJcIikudmFsKCkpO1xuICB9KS5jYXRjaChmdW5jdGlvbihlcnJvck1lc3NhZ2Upe1xuICAgIGNvbnNvbGUubG9nKFwiRXJyb3I6IFwiICsgZXJyb3JNZXNzYWdlKVxuICAgICQoXCIjc3RhdHVzXCIpLmh0bWwoZXJyb3JNZXNzYWdlKTtcbiAgfSk7XG5cblxuICAkKFwiI3N0ZXBcIikuY2xpY2soZnVuY3Rpb24oKSB7XG4gICAgc3RhcnRfcmVuZGVyKHJlZ2lzdGVyKTtcbiAgfSk7XG4gIFxuICAkKFwiI3N0ZXAxMFwiKS5jbGljayhmdW5jdGlvbigpIHtcbiAgICBzdGFydF9yZW5kZXIocmVnaXN0ZXIsMTApO1xuICB9KTtcblxuICAkKFwiI3Rlc3RcIikuY2xpY2soZnVuY3Rpb24oKSB7XG4gICAgdGVzdFN0ZXAocmVnaXN0ZXIsIDEpO1xuICAgIGRpc3BsYXkgKHJlZ2lzdGVyLCAkKCcjYnVmZmVyJykudmFsKCkpO1xuICB9KTtcbiAgXG4gICQoXCIjYnVmZmVyXCIpLmNoYW5nZShmdW5jdGlvbigpIHtcbiAgICBjb25zb2xlLmxvZyhcIkRpc3BsYXkgXCIgKyAkKFwiI2J1ZmZlclwiKS52YWwoKSk7XG4gICAgZGlzcGxheShyZWdpc3RlciwkKFwiI2J1ZmZlclwiKS52YWwoKSk7XG4gIH0pO1xuXG4gIHZhciBzaG93X3ZhbHVlID0gZnVuY3Rpb24oZXZlbnQpIHtcbiAgICBpZiAoIHJlZ2lzdGVyLnBpeGVscyA9PSBudWxsICkgeyByZXR1cm47IH1cbiAgICB2YXIgb2Zmc2V0ID0gZXZlbnQub2Zmc2V0WCArIGV2ZW50Lm9mZnNldFkgKiA1MTI7XG4gICAgdmFyIGRwID0gMjtcbiAgICB2YXIgdGV4dCA9IE51bWJlcihyZWdpc3Rlci5waXhlbHNbb2Zmc2V0XS50b0ZpeGVkKGRwKSkgKyBcIiwgXCJcbiAgICAgICAgKyBOdW1iZXIocmVnaXN0ZXIucGl4ZWxzW29mZnNldCs1MTIqNTEyXS50b0ZpeGVkKGRwKSkgKyBcIiwgXCJcbiAgICAgICAgKyBOdW1iZXIocmVnaXN0ZXIucGl4ZWxzW29mZnNldCs1MTIqNTEyKjJdLnRvRml4ZWQoZHApKTtcbiAgICAkKCcjdmFsdWUnKS50ZXh0KHRleHQpO1xuICB9XG4gICQoXCIjY2FudmFzXCIpLm1vdXNlbW92ZShzaG93X3ZhbHVlKTtcbiAgXG4gICQoXCIjcmVzdGFydFwiKS5jbGljayhmdW5jdGlvbigpIHtcbiAgICAvLyBaZXJvIHRoZSBSIGJ1ZmZlclxuICAgIGNvbnNvbGUubG9nKFwic2V0dGluZyByIGJ1ZmZlciB0byAwLjBcIilcbiAgICB2YXIgciA9IHJlZ2lzdGVyO1xuICAgIHZhciBnbCA9IHIuZ2w7XG4gICAgZ2wuYmluZEZyYW1lYnVmZmVyKGdsLkZSQU1FQlVGRkVSLCByLmZyYW1lYnVmZmVyKTtcbiAgICBnbC5mcmFtZWJ1ZmZlclRleHR1cmUyRChnbC5GUkFNRUJVRkZFUiwgZ2wuQ09MT1JfQVRUQUNITUVOVDAsIGdsLlRFWFRVUkVfMkQsIHIudGV4dHVyZXNbXCJyXCJdLCAwKTtcbiAgICByZW5kZXIgKCByLCByLnByb2dyYW1zW1wic2NhbGVcIl0sIFtcbiAgICAgIHtuYW1lOiBcImltYWdlXCIsIHZhbHVlOiByLnRleHR1cmVzW1wiQVwiXX0sXG4gICAgICB7bmFtZTogXCJzY2FsZVwiLCB2YWx1ZTogMC4wfSxcbiAgICBdKTtcbiAgICBkaXNwbGF5KHJlZ2lzdGVyLCQoXCIjYnVmZmVyXCIpLnZhbCgpKTtcbiAgfSk7XG4gIFxufVxuXG5mdW5jdGlvbiBkaXNwbGF5KHIsYnVmZmVyKSB7XG4gIGNvbnNvbGUubG9nKFwiRGlzcGxheWluZyBidWZmZXIgXCIgKyBidWZmZXIpO1xuICB2YXIgZ2wgPSByLmdsO1xuICBnbC52aWV3cG9ydCgwLDAsNTEyLDUxMik7XG4gIGdsLmJpbmRGcmFtZWJ1ZmZlcihnbC5GUkFNRUJVRkZFUiwgbnVsbCk7XG4gIHJlbmRlciAoIHIsIHIuZGlzcGxheVByb2dyYW0sIFtcbiAgICB7bmFtZTogXCJpbWFnZVwiLCB2YWx1ZTogci50ZXh0dXJlc1tidWZmZXJdfSxcbiAgXSk7XG5cbiAgLy8gUHVsbCB0aGUgYnVmZmVyIHRvIGEgbG9jYWwgYXJyYXlcbiAgci5waXhlbHMgPSByZWFkX3RleHR1cmUgKCByLCByLnRleHR1cmVzW2J1ZmZlcl0sIDUxMiwgNTEyKTtcbiAgXG4gIC8vIERvIGEgc2luZ2xlIHN0ZXBcbiAgLy8gc3RhcnRfcmVuZGVyKHIpO1xufVxuXG5mdW5jdGlvbiBzdGFydF9yZW5kZXIocixjb3VudCkge1xuICBkZW1vbnNTdGVwKHIsIGNvdW50fHwxKTtcbiAgZGlzcGxheSAociwgJCgnI2J1ZmZlcicpLnZhbCgpKTtcbn1cblxuXG5cblxuIiwiLy8gUmVuZGVyIHVzaW5nIFdlYkdMXG4vLyBhcmdzOlxuLy8gICByICAgICAgICAgIC0tIHJlZ2lzdGVyIG9iamVjdFxuLy8gICBwcm9ncmFtICAgIC0tIHdoaWNoIHByb2dyYW0gdG8gdXNlIGluIHRoZSByZW5kZXJpbmdcbi8vICAgcGFyYW1ldGVycyAtLSBhcnJheSBvZiB2YWx1ZXMgdG8gcGFzcyB0byB0aGUgcHJvZ3JhbSwgY29uc2lzdHMgb2YgbmFtZSAvIHZhbHVlIHBhaXJzLCBlLmcuIHsgbmFtZTogXCJ0aW1lXCIsIHZhbHVlOiAxMjMuMyB9XG4vLyAgICAgICAgICAgICAgICAgbWF5IGJlIGludCwgZmxvYXQsIGJvb2wsIHRleHR1cmVcblxuZnVuY3Rpb24gaXNJbnRlZ2VyKG4pe1xuICAgIHJldHVybiBuID09PSArbiAmJiBuID09PSAobnwwKTtcbn1cblxuZnVuY3Rpb24gaXNGbG9hdChuKXtcbiAgcmV0dXJuIHR5cGVvZihuKSA9PT0gXCJudW1iZXJcIjtcbn1cblxuZnVuY3Rpb24gaXNCb29sZWFuKG4pe1xuICByZXR1cm4gdHlwZW9mKG4pID09PSBcImJvb2xlYW5cIjtcbn1cblxuZnVuY3Rpb24gaXNJbWFnZShuKXtcbiAgcmV0dXJuIG4gaW5zdGFuY2VvZiBXZWJHTFRleHR1cmU7XG59XG5cbmZ1bmN0aW9uIHJlbmRlciAoIHIsIHByb2dyYW0sIHBhcmFtZXRlcnMgKSB7XG5cbiAgdmFyIGdsID0gci5nbDtcbiAgZ2wudXNlUHJvZ3JhbShwcm9ncmFtKTtcbiAgY2hlY2tHTEVycm9yKGdsKTtcbiAgLy8gd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZShyZW5kZXIsY2FudmFzKTtcblxuICB2YXIgdGV4ID0gZ2wuZ2V0QXR0cmliTG9jYXRpb24ocHJvZ3JhbSwgJ3RleFBvc2l0aW9uJyk7XG4gIGNoZWNrR0xFcnJvcihnbCk7XG4gIGdsLmJpbmRCdWZmZXIoZ2wuQVJSQVlfQlVGRkVSLCByLnRleHR1cmVDb29yZEJ1ZmZlcik7XG4gIGNoZWNrR0xFcnJvcihnbCk7XG4gIGdsLmVuYWJsZVZlcnRleEF0dHJpYkFycmF5KHRleCk7XG4gIGNoZWNrR0xFcnJvcihnbCk7XG4gIGdsLnZlcnRleEF0dHJpYlBvaW50ZXIodGV4LCAyLCBnbC5GTE9BVCwgZmFsc2UsIDAsIDApO1xuICBjaGVja0dMRXJyb3IoZ2wpO1xuXG4gIC8vIENyZWF0ZSBhIGJ1ZmZlciBhbmQgcHV0IGEgc2luZ2xlIGNsaXBzcGFjZSByZWN0YW5nbGUgaW5cbiAgLy8gaXQgKDIgdHJpYW5nbGVzKVxuICB2YXIgcG9zaXRpb24gPSBnbC5nZXRBdHRyaWJMb2NhdGlvbihyLmRpc3BsYXlQcm9ncmFtLCAncG9zaXRpb24nKTtcbiAgZ2wuYmluZEJ1ZmZlcihnbC5BUlJBWV9CVUZGRVIsIHIuYnVmZmVyKTtcbiAgZ2wuZW5hYmxlVmVydGV4QXR0cmliQXJyYXkocG9zaXRpb24pO1xuICBnbC52ZXJ0ZXhBdHRyaWJQb2ludGVyKHBvc2l0aW9uLCAyLCBnbC5GTE9BVCwgZmFsc2UsIDAsIDApO1xuXG4gIC8vIEJpbmQgdW5pZm9ybXNcbiAgdmFyIHRleHR1cmVJbmRleCA9IDA7XG4gIHBhcmFtZXRlcnMuZm9yRWFjaCggZnVuY3Rpb24ocGFyYW0sIGluZGV4KSB7XG4gICAgdmFyIGxvY2F0aW9uID0gZ2wuZ2V0VW5pZm9ybUxvY2F0aW9uKHByb2dyYW0sIHBhcmFtLm5hbWUpO1xuICAgIGlmICggaXNJbWFnZShwYXJhbS52YWx1ZSkgKSB7XG4gICAgICB2YXIgc2FtcGxlciA9IGdsLmdldFVuaWZvcm1Mb2NhdGlvbihwcm9ncmFtLCBwYXJhbS5uYW1lKTtcbiAgICAgIGdsLmFjdGl2ZVRleHR1cmUoZ2wuVEVYVFVSRTAgKyB0ZXh0dXJlSW5kZXgpO1xuICAgICAgZ2wuYmluZFRleHR1cmUoZ2wuVEVYVFVSRV8yRCwgcGFyYW0udmFsdWUpO1xuICAgICAgZ2wudW5pZm9ybTFpKHNhbXBsZXIsIHRleHR1cmVJbmRleCk7XG4gICAgICBjaGVja0dMRXJyb3IoZ2wpO1xuICAgICAgdGV4dHVyZUluZGV4Kys7XG4gICAgfSBlbHNlIGlmICggaXNCb29sZWFuKHBhcmFtLnZhbHVlKSApIHtcbiAgICAgIGdsLnVuaWZvcm0xaShsb2NhdGlvbiwgcGFyYW0udmFsdWUpO1xuICAgIH0gZWxzZSBpZiAoIGlzRmxvYXQocGFyYW0udmFsdWUpICkge1xuICAgICAgZ2wudW5pZm9ybTFmKGxvY2F0aW9uLCBwYXJhbS52YWx1ZSk7XG4gICAgfVxuICAgIFxuICB9KTtcblxuICAvLyBkcmF3XG4gIGdsLmRyYXdBcnJheXMoZ2wuVFJJQU5HTEVTLCAwLCA2KTtcbiAgXG59XG4iLCJcbmZ1bmN0aW9uIHRlc3RTdGVwKHIsY291bnQpIHtcbiAgY291bnQgPSBjb3VudCB8fCAxO1xuICBjb25zb2xlLmxvZyhcIlJ1bm5pbmcgXCIgKyBjb3VudCArIFwiIHN0ZXBzIGluIHRoZSBEZW1vbidzIGFsZ29yaXRobVwiKTtcbiAgZm9yICggdmFyIGNvdW50ZXIgPSAwOyBjb3VudGVyIDwgY291bnQ7IGNvdW50ZXIrKyApIHtcbiAgICB2YXIgZ2wgPSByLmdsO1xuICAgIFxuICAgIGdsLnZpZXdwb3J0KDAsMCw1MTIsNTEyKTtcbiAgICBnbC5jbGVhckNvbG9yKDAuMCwgMC4wLCAwLjAsIDEuMCk7XG4gICAgZ2wuY2xlYXIoZ2wuQ09MT1JfQlVGRkVSX0JJVCk7XG4gICAgZ2wuYmluZEZyYW1lYnVmZmVyKGdsLkZSQU1FQlVGRkVSLCByLmZyYW1lYnVmZmVyKTtcbiAgICBcbiAgICBnbC5mcmFtZWJ1ZmZlclRleHR1cmUyRChnbC5GUkFNRUJVRkZFUiwgZ2wuQ09MT1JfQVRUQUNITUVOVDAsIGdsLlRFWFRVUkVfMkQsIHIudGV4dHVyZXNbXCJyXCJdLCAwKTtcbiAgICByZW5kZXIgKCByLCByLnByb2dyYW1zW1wiY29weVwiXSwgW1xuICAgICAge25hbWU6IFwiaW1hZ2VcIiwgdmFsdWU6IHIudGV4dHVyZXNbXCJtb3ZpbmdcIl19LFxuICAgIF0pO1xuICAgIFxuICAgIC8vIDcuIHNtb290aCBgcmBcbiAgICB2YXIgc2lnbWEgPSAxLjA7XG4gICAgLy8gc21vb3RoQnVmZmVyICggciwgXCJyXCIsIDguMCApO1xuICB9ICBcbn1cbiIsIi8qKlxuICogQ3JlYXRlcyBhbmQgY29tcGlsZXMgYSBzaGFkZXIuXG4gKlxuICogQHBhcmFtIHshV2ViR0xSZW5kZXJpbmdDb250ZXh0fSBnbCBUaGUgV2ViR0wgQ29udGV4dC5cbiAqIEBwYXJhbSB7c3RyaW5nfSBzaGFkZXJTb3VyY2UgVGhlIEdMU0wgc291cmNlIGNvZGUgZm9yIHRoZSBzaGFkZXIuXG4gKiBAcGFyYW0ge251bWJlcn0gc2hhZGVyVHlwZSBUaGUgdHlwZSBvZiBzaGFkZXIsIFZFUlRFWF9TSEFERVIgb3JcbiAqICAgICBGUkFHTUVOVF9TSEFERVIuXG4gKiBAcmV0dXJuIHshV2ViR0xTaGFkZXJ9IFRoZSBzaGFkZXIuXG4gKi9cbmZ1bmN0aW9uIGNvbXBpbGVTaGFkZXIoZ2wsIHNoYWRlclNvdXJjZSwgc2hhZGVyVHlwZSkge1xuICAvLyBDcmVhdGUgdGhlIHNoYWRlciBvYmplY3RcbiAgdmFyIHNoYWRlciA9IGdsLmNyZWF0ZVNoYWRlcihzaGFkZXJUeXBlKTtcbiBcbiAgLy8gU2V0IHRoZSBzaGFkZXIgc291cmNlIGNvZGUuXG4gIGdsLnNoYWRlclNvdXJjZShzaGFkZXIsIHNoYWRlclNvdXJjZSk7XG4gXG4gIC8vIENvbXBpbGUgdGhlIHNoYWRlclxuICBnbC5jb21waWxlU2hhZGVyKHNoYWRlcik7XG4gXG4gIC8vIENoZWNrIGlmIGl0IGNvbXBpbGVkXG4gIHZhciBzdWNjZXNzID0gZ2wuZ2V0U2hhZGVyUGFyYW1ldGVyKHNoYWRlciwgZ2wuQ09NUElMRV9TVEFUVVMpO1xuICBpZiAoIXN1Y2Nlc3MpIHtcbiAgICAvLyBTb21ldGhpbmcgd2VudCB3cm9uZyBkdXJpbmcgY29tcGlsYXRpb247IGdldCB0aGUgZXJyb3JcbiAgICB0aHJvdyBcImNvdWxkIG5vdCBjb21waWxlIHNoYWRlcjpcIiArIGdsLmdldFNoYWRlckluZm9Mb2coc2hhZGVyKTtcbiAgfVxuIFxuICByZXR1cm4gc2hhZGVyO1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYSBwcm9ncmFtIGZyb20gMiBzaGFkZXJzLlxuICpcbiAqIEBwYXJhbSB7IVdlYkdMUmVuZGVyaW5nQ29udGV4dCkgZ2wgVGhlIFdlYkdMIGNvbnRleHQuXG4gKiBAcGFyYW0geyFXZWJHTFNoYWRlcn0gdmVydGV4U2hhZGVyIEEgdmVydGV4IHNoYWRlci5cbiAqIEBwYXJhbSB7IVdlYkdMU2hhZGVyfSBmcmFnbWVudFNoYWRlciBBIGZyYWdtZW50IHNoYWRlci5cbiAqIEByZXR1cm4geyFXZWJHTFByb2dyYW19IEEgcHJvZ3JhbS5cbiAqL1xuZnVuY3Rpb24gY3JlYXRlUHJvZ3JhbShnbCwgdmVydGV4U2hhZGVyLCBmcmFnbWVudFNoYWRlcikge1xuICAvLyBjcmVhdGUgYSBwcm9ncmFtLlxuICB2YXIgcHJvZ3JhbSA9IGdsLmNyZWF0ZVByb2dyYW0oKTtcbiBcbiAgLy8gYXR0YWNoIHRoZSBzaGFkZXJzLlxuICBnbC5hdHRhY2hTaGFkZXIocHJvZ3JhbSwgdmVydGV4U2hhZGVyKTtcbiAgZ2wuYXR0YWNoU2hhZGVyKHByb2dyYW0sIGZyYWdtZW50U2hhZGVyKTtcbiBcbiAgLy8gbGluayB0aGUgcHJvZ3JhbS5cbiAgZ2wubGlua1Byb2dyYW0ocHJvZ3JhbSk7XG4gXG4gIC8vIENoZWNrIGlmIGl0IGxpbmtlZC5cbiAgdmFyIHN1Y2Nlc3MgPSBnbC5nZXRQcm9ncmFtUGFyYW1ldGVyKHByb2dyYW0sIGdsLkxJTktfU1RBVFVTKTtcbiAgaWYgKCFzdWNjZXNzKSB7XG4gICAgICAvLyBzb21ldGhpbmcgd2VudCB3cm9uZyB3aXRoIHRoZSBsaW5rXG4gICAgICB0aHJvdyAoXCJwcm9ncmFtIGZpbGVkIHRvIGxpbms6XCIgKyBnbC5nZXRQcm9ncmFtSW5mb0xvZyAocHJvZ3JhbSkpO1xuICB9XG4gXG4gIHJldHVybiBwcm9ncmFtO1xufTtcblxuXG5mdW5jdGlvbiBjaGVja0dMRXJyb3IoZ2wpIHtcblx0dmFyIGVycm9yID0gZ2wuZ2V0RXJyb3IoKTtcblx0aWYgKGVycm9yICE9IGdsLk5PX0VSUk9SKSB7XG5cdFx0dmFyIHN0ciA9IFwiR0wgRXJyb3I6IFwiICsgZXJyb3IgKyBcIiBcIiArIGdsLmVudW1fc3RyaW5nc1tlcnJvcl07XG5cdFx0Y29uc29sZS5sb2coc3RyKTtcblx0XHR0aHJvdyBzdHI7XG5cdH1cbn1cblxuXG5cbmZ1bmN0aW9uIEZldGNoRmlsZSh1cmwsIGFzeW5jKVxue1xuXHR2YXIgcmVxdWVzdCA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuXHRyZXF1ZXN0Lm9wZW4oXCJHRVRcIiwgdXJsLCBhc3luYyk7XG5cdHJlcXVlc3Qub3ZlcnJpZGVNaW1lVHlwZShcInRleHQvcGxhaW5cIik7XG5cdHJlcXVlc3Quc2VuZChudWxsKTtcblx0cmV0dXJuIHJlcXVlc3QucmVzcG9uc2VUZXh0O1xufVxuIl0sInNvdXJjZVJvb3QiOiIvc291cmNlLyJ9
