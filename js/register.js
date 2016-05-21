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
  var delta = 1./512.;
  
  // Sigmas are in pixels
  var imageSigma = 0.0;
  var gradientSigma = 0.0;
  var drSigma = 10.0;
  var rSigma = 1.0;

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


    smoothBuffer(r,"B", 10, delta);
    
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


  $("#step").click(function() {
    start_render(register);
  });
  
  $("#step10").click(function() {
    start_render(register,10);
  });

  $("#step100").click(function() {
    start_render(register,100);
  });

  $("#buffer").change(function() {
    display(register,$("#buffer").val());
  });

  $("#scale").change(function() {
    display(register,$("#buffer").val());
  });

  var show_value = function(event) {
    if ( register.pixels == null ) { return; }
    var offset = event.offsetX + (511 - event.offsetY) * 512;
    var dp = 2;
    var text = 'Pixel @ ' + event.offsetX + ", " + event.offsetY + ": " + Number(register.pixels[offset].toFixed(dp)) + ", "
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



// setup some key handlers
$(document).keypress(function(e){
  if ( document.activeElement.type === 'text' ) { return; }
  var k = e.which || e.keyCode;

  // map of ASCII codes -> buffer names
  var map = {};
  map["r".charCodeAt()] = "r";
  map["x".charCodeAt()] = "dr";
  map["M".charCodeAt()] = "movingGradient";
  map["F".charCodeAt()] = "fixedGradient";
  map["m".charCodeAt()] = "moving";
  map["f".charCodeAt()] = "fixed";
  map["i".charCodeAt()] = "displaced";
  map["d".charCodeAt()] = "difference";
  map["a".charCodeAt()] = "A";
  map["b".charCodeAt()] = "B";
  if ( k in map ) {
    var buffer = map[k];
    console.log("Keypress for " + k + " -> " + buffer);
    $("#buffer").val(buffer).change();
    return;
  }
  var buttons = {};
  buttons["s".charCodeAt()] = "#step";
  buttons["1".charCodeAt()] = "#step10";
  buttons["2".charCodeAt()] = "#step100";
  buttons["x".charCodeAt()] = "#restart";
  if ( k in buttons ) {
    $(buttons[k]).click();
    return;
  }
});

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
  load_image(gl, "images/copd1_eBHCT_slice.png").then(function(texture){
  // load_image(gl, "images/preOpT2.png").then(function(texture){
    register.fixedTexture = texture;
    register.textures["fixed"] = texture;
    return load_image(gl,"images/copd1_iBHCT_slice.png");
    // return load_image(gl,"images/intraOpT2.png");
    // return load_image(gl,"images/preOpT2-slight.png");
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
    start_render(register);
    // display(register,$("#buffer").val());
  }).catch(function(errorMessage){
    console.log("Error: " + errorMessage)
    $("#status").html(errorMessage);
  });
}

function display(r,buffer) {
  var scale = Number($("#scale").attr("value"));
  console.log("Displaying buffer " + buffer + " scale: " + scale);
  var gl = r.gl;
  gl.viewport(0,0,512,512);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  render ( r, r.displayProgram, [
    {name: "image", value: r.textures[buffer]},
    {name: "scale", value: scale},
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

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImNvbXBpbGVfcHJvZ3JhbS5qcyIsImNyZWF0ZV9kaWZmZXJlbmNlX3RleHR1cmUuanMiLCJkZW1vbnMuanMiLCJldmVudHMuanMiLCJmZXRjaF9maWxlLmpzIiwibG9hZF9pbWFnZS5qcyIsInJlYWRfdGV4dHVyZS5qcyIsInJlZ2lzdGVyLmpzIiwicmVuZGVyLmpzIiwidGVzdC5qcyIsInV0aWxzLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDL0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNwREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3hJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ2pGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNoQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ2xDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQzlCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQzlLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3JFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDdEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6InJlZ2lzdGVyLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLy8gQ29tcGlsZXMgYSBXZWJHTCBwcm9ncmFtIGludG8gdGhlIEdMIGNvbnRleHQgYW5kIHJldHVybnMgYSBwcm9taXNlLlxuLy8gVGhlIHByb2dyYW0gaXMgcGFzc2VkIHRvIHRoZSByZXNvbHZlIGNhbGxiYWNrLCBhbmQgYW55IGVycm9yIG1lc3NhZ2VzXG4vLyBhcmUgcmV0dXJuZWQgYXMgSFRNTCB0ZXh0IGluIHRoZSByZWplY3QgY2FsbGJhY2suXG4vL1xuLy8gYXJnczpcbi8vICBnbCAgICAgICAgICAgICAtLSBXZWJHTCBjb250ZXh0XG4vLyAgdmVydGV4U291cmNlICAgLS0gVVJMIG9mIHRoZSBzaGFkZXIgc291cmNlXG4vLyAgZnJhZ21lbnRTb3VyY2UgLS0gVVJMIG9mIHRoZSBmcmFnbWVudCBzaGFkZXJcblxuZnVuY3Rpb24gY29tcGlsZV9wcm9ncmFtICggZ2wsIHZlcnRleFNvdXJjZSwgZnJhZ21lbnRTb3VyY2UgKSB7XG5cbiAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUscmVqZWN0KSB7XG4gICAgdmFyIG1lc3NhZ2UgPSBcIlwiO1xuICAgIHZhciB2ZXJ0ZXhfc2hhZGVyID0gXCJcIjtcbiAgICB2YXIgZnJhZ21lbnRfc2hhZGVyID0gXCJcIjtcbiAgICBcbiAgICAvLyBDcmVhdGUgdGhlIHByb2dyYW1cbiAgICB2YXIgZ2xQcm9ncmFtID0gZ2wuY3JlYXRlUHJvZ3JhbSgpO1xuICAgIFxuICAgIC8vIExvYWQgb3VyIHNoYWRlcnNcbiAgICBmZXRjaF9maWxlKHZlcnRleFNvdXJjZSkudGhlbihmdW5jdGlvbih0ZXh0KSB7XG4gICAgICB2ZXJ0ZXhfc2hhZGVyID0gdGV4dDtcbiAgICAgIHJldHVybiBmZXRjaF9maWxlKGZyYWdtZW50U291cmNlKTtcbiAgICB9KS50aGVuIChmdW5jdGlvbih0ZXh0KXtcbiAgICAgIGZyYWdtZW50X3NoYWRlciA9IHRleHQ7XG4gICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG4gICAgfSkudGhlbiAoIGZ1bmN0aW9uKCkge1xuICAgICAgXG4gICAgICB2YXIgdmVydGV4U2hhZGVyID0gZ2wuY3JlYXRlU2hhZGVyKGdsLlZFUlRFWF9TSEFERVIpO1xuICAgICAgZ2wuc2hhZGVyU291cmNlKHZlcnRleFNoYWRlciwgdmVydGV4X3NoYWRlcik7XG4gICAgICBnbC5jb21waWxlU2hhZGVyKHZlcnRleFNoYWRlcik7XG4gICAgICBpZiAoIWdsLmdldFNoYWRlclBhcmFtZXRlcih2ZXJ0ZXhTaGFkZXIsIGdsLkNPTVBJTEVfU1RBVFVTKSkge1xuICAgICAgICBtZXNzYWdlID0gbWVzc2FnZSArIFwiPGg0PnZlcnRleDwvaDM+PHByZT5cIiArIGdsLmdldFNoYWRlckluZm9Mb2codmVydGV4U2hhZGVyKSArIFwiPC9wcmU+XCI7XG4gICAgICB9XG4gICAgICBcbiAgICAgIHZhciBmcmFnbWVudFNoYWRlciA9IGdsLmNyZWF0ZVNoYWRlcihnbC5GUkFHTUVOVF9TSEFERVIpO1xuICAgICAgZ2wuc2hhZGVyU291cmNlKGZyYWdtZW50U2hhZGVyLCBmcmFnbWVudF9zaGFkZXIpO1xuICAgICAgZ2wuY29tcGlsZVNoYWRlcihmcmFnbWVudFNoYWRlcik7XG4gICAgICBpZiAoIWdsLmdldFNoYWRlclBhcmFtZXRlcihmcmFnbWVudFNoYWRlciwgZ2wuQ09NUElMRV9TVEFUVVMpKSB7XG4gICAgICAgIG1lc3NhZ2UgPSBtZXNzYWdlICsgXCI8aDQ+ZnJhZ21lbnQ8L2gzPjxwcmU+XCIgKyBnbC5nZXRTaGFkZXJJbmZvTG9nKGZyYWdtZW50U2hhZGVyKSArIFwiPC9wcmU+XCI7XG4gICAgICB9XG5cbiAgICAgIGlmICggbWVzc2FnZSAhPSBcIlwiKSB7XG4gICAgICAgIG1lc3NhZ2UgPSBtZXNzYWdlLnJlcGxhY2UoL1xcMC9nLCBcIlwiKTtcbiAgICAgICAgbWVzc2FnZSA9IG1lc3NhZ2UucmVwbGFjZSgvXFxuL2csIFwiPGJyPlwiKTtcbiAgICAgICAgcmVqZWN0KG1lc3NhZ2UpO1xuICAgICAgfVxuXG4gICAgICB0cnkge1xuICAgICAgICBnbC5hdHRhY2hTaGFkZXIoZ2xQcm9ncmFtLCB2ZXJ0ZXhTaGFkZXIpO1xuICAgICAgICBjaGVja0dMRXJyb3IoZ2wpO1xuICAgICAgICBnbC5hdHRhY2hTaGFkZXIoZ2xQcm9ncmFtLCBmcmFnbWVudFNoYWRlcik7XG4gICAgICAgIGNoZWNrR0xFcnJvcihnbCk7XG4gICAgICAgIGdsLmxpbmtQcm9ncmFtKGdsUHJvZ3JhbSk7XG4gICAgICAgIGNoZWNrR0xFcnJvcihnbCk7XG4gICAgICB9IGNhdGNoICggbWVzc2FnZSApIHtcbiAgICAgICAgcmVqZWN0KG1lc3NhZ2UpO1xuICAgICAgfVxuICAgICAgcmVzb2x2ZShnbFByb2dyYW0pXG4gICAgICBcbiAgICB9KTtcbiAgfSk7XG59XG4iLCIvLyBDcmVhdGUgYSBmbG9hdGluZyBwb2ludCBidWZmZXIuXG4vL1xuLy8gYXJnczpcbi8vICAgciAgLS0gcmVnaXN0cmF0aW9uIG9iamVjdFxuLy8gICB3ICAtLSB3aWR0aCBvZiBidWZmZXJcbi8vICAgaCAgLS0gaGVpZ2h0IG9mIGJ1ZmZlclxuXG5mdW5jdGlvbiBjcmVhdGVfZmxvYXRfdGV4dHVyZSAoIHIsIHcsIGggKSB7XG4gIHZhciBnbCA9IHIuZ2w7XG5cbiAgLy8gRW5hYmxlIGV4dGVuc2lvbnNcbiAgZ2wuZ2V0RXh0ZW5zaW9uICggJ09FU190ZXh0dXJlX2Zsb2F0Jyk7XG4gIGdsLmdldEV4dGVuc2lvbiAoICdPRVNfdGV4dHVyZV9mbG9hdF9saW5lYXInKTtcbiAgZ2wuZ2V0RXh0ZW5zaW9uICggJ09FU190ZXh0dXJlX2hhbGZfZmxvYXQnKTtcbiAgZ2wuZ2V0RXh0ZW5zaW9uICggJ09FU190ZXh0dXJlX2hhbGZfZmxvYXRfbGluZWFyJyk7XG4gIFxuICB2YXIgZGlmZmVyZW5jZVRleHR1cmUgPSBnbC5jcmVhdGVUZXh0dXJlKCk7XG4gIGdsLmJpbmRUZXh0dXJlKGdsLlRFWFRVUkVfMkQsIGRpZmZlcmVuY2VUZXh0dXJlKTtcbiAgXG4gIGdsLnRleEltYWdlMkQoZ2wuVEVYVFVSRV8yRCwgMCwgZ2wuUkdCQSwgdywgaCwgMCwgZ2wuUkdCQSwgZ2wuRkxPQVQsIG51bGwpO1xuICBnbC50ZXhQYXJhbWV0ZXJpKGdsLlRFWFRVUkVfMkQsIGdsLlRFWFRVUkVfTUFHX0ZJTFRFUiwgZ2wuTElORUFSKTtcbiAgZ2wudGV4UGFyYW1ldGVyaShnbC5URVhUVVJFXzJELCBnbC5URVhUVVJFX01JTl9GSUxURVIsIGdsLkxJTkVBUik7XG4gIGdsLnRleFBhcmFtZXRlcmkoZ2wuVEVYVFVSRV8yRCwgZ2wuVEVYVFVSRV9XUkFQX1MsIGdsLkNMQU1QX1RPX0VER0UpO1xuICBnbC50ZXhQYXJhbWV0ZXJpKGdsLlRFWFRVUkVfMkQsIGdsLlRFWFRVUkVfV1JBUF9ULCBnbC5DTEFNUF9UT19FREdFKTtcblxuICBnbC5iaW5kVGV4dHVyZShnbC5URVhUVVJFXzJELCBudWxsKTtcbiAgcmV0dXJuIGRpZmZlcmVuY2VUZXh0dXJlO1xufVxuXG4vLyBDcmVhdGUgYSB0ZXh0dXJlIGJ1ZmZlci5cbi8vXG4vLyBhcmdzOlxuLy8gICByICAtLSByZWdpc3RyYXRpb24gb2JqZWN0XG4vLyAgIHcgIC0tIHdpZHRoIG9mIGJ1ZmZlclxuLy8gICBoICAtLSBoZWlnaHQgb2YgYnVmZmVyXG5cbmZ1bmN0aW9uIGNyZWF0ZV90ZXh0dXJlICggciwgdywgaCApIHtcbiAgdmFyIGdsID0gci5nbDtcbiAgXG4gIHZhciBkaWZmZXJlbmNlVGV4dHVyZSA9IGdsLmNyZWF0ZVRleHR1cmUoKTtcbiAgZ2wuYmluZFRleHR1cmUoZ2wuVEVYVFVSRV8yRCwgZGlmZmVyZW5jZVRleHR1cmUpO1xuICBcbiAgZ2wudGV4SW1hZ2UyRChnbC5URVhUVVJFXzJELCAwLCBnbC5SR0JBLCB3LCBoLCAwLCBnbC5SR0JBLCBnbC5VTlNJR05FRF9CWVRFLCBudWxsKTtcbiAgZ2wudGV4UGFyYW1ldGVyaShnbC5URVhUVVJFXzJELCBnbC5URVhUVVJFX01BR19GSUxURVIsIGdsLkxJTkVBUik7XG4gIGdsLnRleFBhcmFtZXRlcmkoZ2wuVEVYVFVSRV8yRCwgZ2wuVEVYVFVSRV9NSU5fRklMVEVSLCBnbC5MSU5FQVIpO1xuICBnbC50ZXhQYXJhbWV0ZXJpKGdsLlRFWFRVUkVfMkQsIGdsLlRFWFRVUkVfV1JBUF9TLCBnbC5DTEFNUF9UT19FREdFKTtcbiAgZ2wudGV4UGFyYW1ldGVyaShnbC5URVhUVVJFXzJELCBnbC5URVhUVVJFX1dSQVBfVCwgZ2wuQ0xBTVBfVE9fRURHRSk7XG5cbiAgZ2wuYmluZFRleHR1cmUoZ2wuVEVYVFVSRV8yRCwgbnVsbCk7XG4gIHJldHVybiBkaWZmZXJlbmNlVGV4dHVyZTtcbn1cblxuIiwiLypcbiAgZGVtb25zU3RlcCAtLSBjYWxjdWxhdGUgb25lIHN0ZXAgaW4gdGhlIGRlbW9uJ3MgYWxnb3J0aGltLCBpLmUuIHVwZGF0ZSBgcmBcbiAgUGFyYW1ldGVyczpcbiAgICByIC0tIHJlZ2lzdHJhdGlvbiBvYmplY3RcbiAgICBjb3VudCAtLSBudW1iZXIgb2Ygc3RlcHNcbiAgMS4gdHJhbnNmb3JtIHRoZSBtb3ZpbmdJbWFnZSB1c2luZyB0aGUgYGRpc3BsYWNlYCBrZXJuZWxcbiAgMi4gY2FsY3VsYXRlIHRoZSBtb3ZpbmdJbWFnZSBncmFkaWVudFxuICAzLiBzbW9vdGggdGhlIG1vdmluZ0ltYWdlIGdyYWRpZW50XG4gIDQuIGNhbGN1bGF0ZSBgZHJgLCB0aGUgZGVsdGEgaW4gYHJgXG4gIDUuIHNtb290aCBgZHJgXG4gIDYuIHVwZGF0ZSBgcmBcbiAgNy4gc21vb3RoIGByYFxuICovXG5cbmZ1bmN0aW9uIGRlbW9uc1N0ZXAocixjb3VudCkge1xuICBjb3VudCA9IGNvdW50IHx8IDE7XG4gIGNvbnNvbGUubG9nKFwiUnVubmluZyBcIiArIGNvdW50ICsgXCIgc3RlcHMgaW4gdGhlIERlbW9uJ3MgYWxnb3JpdGhtXCIpO1xuXG4gIC8vIGRlbHRhIGJldHdlZW4gcGl4ZWxzLCBpLmUuIDEgLyBpbWFnZSBzaXplXG4gIHZhciBkZWx0YSA9IDEuLzUxMi47XG4gIFxuICAvLyBTaWdtYXMgYXJlIGluIHBpeGVsc1xuICB2YXIgaW1hZ2VTaWdtYSA9IDAuMDtcbiAgdmFyIGdyYWRpZW50U2lnbWEgPSAwLjA7XG4gIHZhciBkclNpZ21hID0gMTAuMDtcbiAgdmFyIHJTaWdtYSA9IDEuMDtcblxuICAvLyBIb3cgZmFzdCB0byB1cGRhdGVcbiAgdmFyIHNjYWxlID0gMC4yO1xuICBcbiAgdmFyIGdsID0gci5nbDtcbiAgZ2wuYmluZEZyYW1lYnVmZmVyKGdsLkZSQU1FQlVGRkVSLCByLmZyYW1lYnVmZmVyKTtcbiAgZ2wudmlld3BvcnQoMCwwLDUxMiw1MTIpO1xuICBcbiAgZm9yICggdmFyIGNvdW50ZXIgPSAwOyBjb3VudGVyIDwgY291bnQ7IGNvdW50ZXIrKyApIHtcbiAgICAvLyBVcGRhdGUgbW92aW5nIGltYWdlXG4gICAgZ2wuZnJhbWVidWZmZXJUZXh0dXJlMkQoZ2wuRlJBTUVCVUZGRVIsIGdsLkNPTE9SX0FUVEFDSE1FTlQwLCBnbC5URVhUVVJFXzJELCByLnRleHR1cmVzW1wiZGlzcGxhY2VkXCJdLCAwKTtcbiAgICByZW5kZXIgKCByLCByLnByb2dyYW1zW1wiZGlzcGxhY2VcIl0sIFtcbiAgICAgIHtuYW1lOiBcIm1vdmluZ0ltYWdlXCIsIHZhbHVlOiByLm1vdmluZ1RleHR1cmV9LFxuICAgICAge25hbWU6IFwiclwiLCB2YWx1ZTogci50ZXh0dXJlc1tcInJcIl19LFxuICAgICAge25hbWU6IFwic2NhbGVcIiwgdmFsdWU6IHNjYWxlfSxcbiAgICBdKTtcblxuICAgIC8vIFNtb290aCB0aGUgZGlzcGxhY2VkIGltYWdlXG4gICAgc21vb3RoQnVmZmVyICggciwgXCJkaXNwbGFjZWRcIiwgaW1hZ2VTaWdtYSwgZGVsdGEgKTtcbiAgICBcbiAgICAvLyBDYWxjdWxhdGUgdGhlIGdyYWRpZW50c1xuICAgIGdsLmZyYW1lYnVmZmVyVGV4dHVyZTJEKGdsLkZSQU1FQlVGRkVSLCBnbC5DT0xPUl9BVFRBQ0hNRU5UMCwgZ2wuVEVYVFVSRV8yRCwgci50ZXh0dXJlc1tcIkJcIl0sIDApO1xuICAgIHJlbmRlciAoIHIsIHIucHJvZ3JhbXNbXCJjb3B5XCJdLCBbXG4gICAgICB7bmFtZTogXCJpbWFnZVwiLCB2YWx1ZTogci50ZXh0dXJlc1tcImZpeGVkXCJdfSxcbiAgICBdKTtcbiAgICBcbiAgICBzbW9vdGhCdWZmZXIgKCByLCBcIkFcIiwgaW1hZ2VTaWdtYSwgZGVsdGEgKTtcbiAgICBnbC5iaW5kRnJhbWVidWZmZXIoZ2wuRlJBTUVCVUZGRVIsIHIuZnJhbWVidWZmZXIpO1xuICAgIGdsLmZyYW1lYnVmZmVyVGV4dHVyZTJEKGdsLkZSQU1FQlVGRkVSLCBnbC5DT0xPUl9BVFRBQ0hNRU5UMCwgZ2wuVEVYVFVSRV8yRCwgci50ZXh0dXJlc1tcImZpeGVkR3JhZGllbnRcIl0sIDApO1xuICAgIHJlbmRlciAoIHIsIHIucHJvZ3JhbXNbXCJncmFkaWVudFwiXSwgW1xuICAgICAge25hbWU6IFwiaW1hZ2VcIiwgdmFsdWU6IHIudGV4dHVyZXNbXCJCXCJdfSxcbiAgICAgIHtuYW1lOiBcImRlbHRhXCIsIHZhbHVlOiBkZWx0YX0sXG4gICAgXSk7XG4gICAgLy8gU21vb3RoIHRoZSBncmFkaWVudFxuICAgIHNtb290aEJ1ZmZlciAoIHIsIFwiZml4ZWRHcmFkaWVudFwiLCBncmFkaWVudFNpZ21hLCBkZWx0YSApO1xuICAgIFxuICAgIGdsLmJpbmRGcmFtZWJ1ZmZlcihnbC5GUkFNRUJVRkZFUiwgci5mcmFtZWJ1ZmZlcik7XG4gICAgZ2wuZnJhbWVidWZmZXJUZXh0dXJlMkQoZ2wuRlJBTUVCVUZGRVIsIGdsLkNPTE9SX0FUVEFDSE1FTlQwLCBnbC5URVhUVVJFXzJELCByLnRleHR1cmVzW1wibW92aW5nR3JhZGllbnRcIl0sIDApO1xuICAgIHJlbmRlciAoIHIsIHIucHJvZ3JhbXNbXCJncmFkaWVudFwiXSwgW1xuICAgICAge25hbWU6IFwiaW1hZ2VcIiwgdmFsdWU6IHIudGV4dHVyZXNbJ2Rpc3BsYWNlZCddfSxcbiAgICAgIHtuYW1lOiBcImRlbHRhXCIsIHZhbHVlOiBkZWx0YX0sXG4gICAgXSk7XG4gICAgLy8gU21vb3RoIHRoZSBncmFkaWVudFxuICAgIHNtb290aEJ1ZmZlciAoIHIsIFwibW92aW5nR3JhZGllbnRcIiwgZ3JhZGllbnRTaWdtYSwgZGVsdGEgKTtcblxuICAgIC8vIDQuIGNhbGN1bGF0ZSBgZHJgLCB0aGUgZGVsdGEgaW4gYHJgXG4gICAgZ2wuYmluZEZyYW1lYnVmZmVyKGdsLkZSQU1FQlVGRkVSLCByLmZyYW1lYnVmZmVyKTtcbiAgICBnbC5mcmFtZWJ1ZmZlclRleHR1cmUyRChnbC5GUkFNRUJVRkZFUiwgZ2wuQ09MT1JfQVRUQUNITUVOVDAsIGdsLlRFWFRVUkVfMkQsIHIudGV4dHVyZXNbXCJkclwiXSwgMCk7XG4gICAgcmVuZGVyICggciwgci5wcm9ncmFtc1tcImRpc3BsYWNlbWVudFwiXSwgW1xuICAgICAge25hbWU6IFwiZml4ZWRJbWFnZVwiLCB2YWx1ZTogci50ZXh0dXJlc1tcImZpeGVkXCJdfSxcbiAgICAgIHtuYW1lOiBcImZpeGVkSW1hZ2VHcmFkaWVudFwiLCB2YWx1ZTogci50ZXh0dXJlc1tcImZpeGVkR3JhZGllbnRcIl19LFxuICAgICAge25hbWU6IFwibW92aW5nSW1hZ2VcIiwgdmFsdWU6IHIudGV4dHVyZXNbXCJkaXNwbGFjZWRcIl19LFxuICAgICAge25hbWU6IFwibW92aW5nSW1hZ2VHcmFkaWVudFwiLCB2YWx1ZTogci50ZXh0dXJlc1tcIm1vdmluZ0dyYWRpZW50XCJdfSxcbiAgICAgIHtuYW1lOiBcInNwYWNpbmdcIiwgdmFsdWU6IDEuMH0sXG4gICAgXSk7XG5cbiAgICAvLyA1LiBzbW9vdGggYGRyYFxuICAgIHNtb290aEJ1ZmZlciAoIHIsIFwiZHJcIiwgZHJTaWdtYSwgZGVsdGEgKTtcbiAgICBcbiAgICAvLyA2LiB1cGRhdGUgYHJgXG4gICAgLy8gQ2FsY3VsYXRlIHRvIFwiQVwiLCBjb3B5IHRvIFwiclwiXG4gICAgZ2wuZnJhbWVidWZmZXJUZXh0dXJlMkQoZ2wuRlJBTUVCVUZGRVIsIGdsLkNPTE9SX0FUVEFDSE1FTlQwLCBnbC5URVhUVVJFXzJELCByLnRleHR1cmVzW1wiQVwiXSwgMCk7XG4gICAgcmVuZGVyICggciwgci5wcm9ncmFtc1tcInVwZGF0ZVJcIl0sIFtcbiAgICAgIHtuYW1lOiBcInJcIiwgdmFsdWU6IHIudGV4dHVyZXNbXCJyXCJdfSxcbiAgICAgIHtuYW1lOiBcImRyXCIsIHZhbHVlOiByLnRleHR1cmVzW1wiZHJcIl19LFxuICAgIF0pO1xuXG4gICAgZ2wuZnJhbWVidWZmZXJUZXh0dXJlMkQoZ2wuRlJBTUVCVUZGRVIsIGdsLkNPTE9SX0FUVEFDSE1FTlQwLCBnbC5URVhUVVJFXzJELCByLnRleHR1cmVzW1wiclwiXSwgMCk7XG4gICAgcmVuZGVyICggciwgci5wcm9ncmFtc1tcImNvcHlcIl0sIFtcbiAgICAgIHtuYW1lOiBcImltYWdlXCIsIHZhbHVlOiByLnRleHR1cmVzW1wiQVwiXX0sXG4gICAgXSk7XG4gICAgXG4gICAgLy8gNy4gc21vb3RoIGByYFxuICAgIHNtb290aEJ1ZmZlciAoIHIsIFwiclwiLCByU2lnbWEsIGRlbHRhICk7XG4gICAgXG4gICAgZ2wuZnJhbWVidWZmZXJUZXh0dXJlMkQoZ2wuRlJBTUVCVUZGRVIsIGdsLkNPTE9SX0FUVEFDSE1FTlQwLCBnbC5URVhUVVJFXzJELCByLnRleHR1cmVzW1wiZGlmZmVyZW5jZVwiXSwgMCk7XG4gICAgcmVuZGVyICggciwgci5wcm9ncmFtc1tcImRpZmZlcmVuY2VcIl0sIFtcbiAgICAgIHtuYW1lOiBcIm1vdmluZ0ltYWdlXCIsIHZhbHVlOiByLnRleHR1cmVzW1wiZGlzcGxhY2VkXCJdfSxcbiAgICAgIHtuYW1lOiBcImZpeGVkSW1hZ2VcIiwgdmFsdWU6IHIudGV4dHVyZXNbXCJmaXhlZFwiXX0sXG4gICAgXSk7XG5cblxuICAgIHNtb290aEJ1ZmZlcihyLFwiQlwiLCAxMCwgZGVsdGEpO1xuICAgIFxuICB9ICBcbn1cblxuZnVuY3Rpb24gc21vb3RoQnVmZmVyICggciwgYnVmZmVyLCBzaWdtYSwgZGVsdGEgKSB7XG4gIGlmICggc2lnbWEgPT0gMC4wICkgeyByZXR1cm47IH1cbiAgLy8gRmlyc3QgZG8gaG9yaXpvbnRhbCBwYXNzIGZyb20gYnVmZmVyIGludG8gXCJCXCJcbiAgLy8gU2Vjb25kIGRvIHZlcnRpY2FsIHBhc3MgZnJvbSBcIkJcIiBpbnRvIGJ1ZmZlclxuICB2YXIgZ2wgPSByLmdsO1xuICB2YXIgdG1wQnVmZmVyID0gXCJBXCI7XG4gIGdsLmJpbmRGcmFtZWJ1ZmZlcihnbC5GUkFNRUJVRkZFUiwgci5mcmFtZWJ1ZmZlcik7XG4gIGdsLmZyYW1lYnVmZmVyVGV4dHVyZTJEKGdsLkZSQU1FQlVGRkVSLCBnbC5DT0xPUl9BVFRBQ0hNRU5UMCwgZ2wuVEVYVFVSRV8yRCwgci50ZXh0dXJlc1t0bXBCdWZmZXJdLCAwKTtcbiAgcmVuZGVyICggciwgci5wcm9ncmFtc1tcInNtb290aFwiXSwgW1xuICAgIHtuYW1lOiBcImltYWdlXCIsIHZhbHVlOiByLnRleHR1cmVzW2J1ZmZlcl19LFxuICAgIHtuYW1lOiBcImRlbHRhXCIsIHZhbHVlOiBkZWx0YX0sXG4gICAge25hbWU6IFwic2lnbWFcIiwgdmFsdWU6IHNpZ21hfSxcbiAgICB7bmFtZTogXCJkaXJlY3Rpb25cIiwgdmFsdWU6IDB9LFxuICBdKTtcbiAgZ2wuYmluZEZyYW1lYnVmZmVyKGdsLkZSQU1FQlVGRkVSLCByLmZyYW1lYnVmZmVyKTtcbiAgZ2wuZnJhbWVidWZmZXJUZXh0dXJlMkQoZ2wuRlJBTUVCVUZGRVIsIGdsLkNPTE9SX0FUVEFDSE1FTlQwLCBnbC5URVhUVVJFXzJELCByLnRleHR1cmVzW2J1ZmZlcl0sIDApO1xuICByZW5kZXIgKCByLCByLnByb2dyYW1zW1wic21vb3RoXCJdLCBbXG4gICAge25hbWU6IFwiaW1hZ2VcIiwgdmFsdWU6IHIudGV4dHVyZXNbdG1wQnVmZmVyXX0sXG4gICAge25hbWU6IFwiZGVsdGFcIiwgdmFsdWU6IGRlbHRhfSxcbiAgICB7bmFtZTogXCJzaWdtYVwiLCB2YWx1ZTogc2lnbWF9LFxuICAgIHtuYW1lOiBcImRpcmVjdGlvblwiLCB2YWx1ZTogMX0sXG4gIF0pO1xufVxuIiwiXG4gICQoXCIjc3RlcFwiKS5jbGljayhmdW5jdGlvbigpIHtcbiAgICBzdGFydF9yZW5kZXIocmVnaXN0ZXIpO1xuICB9KTtcbiAgXG4gICQoXCIjc3RlcDEwXCIpLmNsaWNrKGZ1bmN0aW9uKCkge1xuICAgIHN0YXJ0X3JlbmRlcihyZWdpc3RlciwxMCk7XG4gIH0pO1xuXG4gICQoXCIjc3RlcDEwMFwiKS5jbGljayhmdW5jdGlvbigpIHtcbiAgICBzdGFydF9yZW5kZXIocmVnaXN0ZXIsMTAwKTtcbiAgfSk7XG5cbiAgJChcIiNidWZmZXJcIikuY2hhbmdlKGZ1bmN0aW9uKCkge1xuICAgIGRpc3BsYXkocmVnaXN0ZXIsJChcIiNidWZmZXJcIikudmFsKCkpO1xuICB9KTtcblxuICAkKFwiI3NjYWxlXCIpLmNoYW5nZShmdW5jdGlvbigpIHtcbiAgICBkaXNwbGF5KHJlZ2lzdGVyLCQoXCIjYnVmZmVyXCIpLnZhbCgpKTtcbiAgfSk7XG5cbiAgdmFyIHNob3dfdmFsdWUgPSBmdW5jdGlvbihldmVudCkge1xuICAgIGlmICggcmVnaXN0ZXIucGl4ZWxzID09IG51bGwgKSB7IHJldHVybjsgfVxuICAgIHZhciBvZmZzZXQgPSBldmVudC5vZmZzZXRYICsgKDUxMSAtIGV2ZW50Lm9mZnNldFkpICogNTEyO1xuICAgIHZhciBkcCA9IDI7XG4gICAgdmFyIHRleHQgPSAnUGl4ZWwgQCAnICsgZXZlbnQub2Zmc2V0WCArIFwiLCBcIiArIGV2ZW50Lm9mZnNldFkgKyBcIjogXCIgKyBOdW1iZXIocmVnaXN0ZXIucGl4ZWxzW29mZnNldF0udG9GaXhlZChkcCkpICsgXCIsIFwiXG4gICAgICAgICsgTnVtYmVyKHJlZ2lzdGVyLnBpeGVsc1tvZmZzZXQrNTEyKjUxMl0udG9GaXhlZChkcCkpICsgXCIsIFwiXG4gICAgICAgICsgTnVtYmVyKHJlZ2lzdGVyLnBpeGVsc1tvZmZzZXQrNTEyKjUxMioyXS50b0ZpeGVkKGRwKSk7XG4gICAgJCgnI3ZhbHVlJykudGV4dCh0ZXh0KTtcbiAgfVxuICAkKFwiI2NhbnZhc1wiKS5tb3VzZW1vdmUoc2hvd192YWx1ZSk7XG4gIFxuICAkKFwiI3Jlc3RhcnRcIikuY2xpY2soZnVuY3Rpb24oKSB7XG4gICAgLy8gWmVybyB0aGUgUiBidWZmZXJcbiAgICBjb25zb2xlLmxvZyhcInNldHRpbmcgciBidWZmZXIgdG8gMC4wXCIpXG4gICAgdmFyIHIgPSByZWdpc3RlcjtcbiAgICB2YXIgZ2wgPSByLmdsO1xuICAgIGdsLmJpbmRGcmFtZWJ1ZmZlcihnbC5GUkFNRUJVRkZFUiwgci5mcmFtZWJ1ZmZlcik7XG4gICAgZ2wuZnJhbWVidWZmZXJUZXh0dXJlMkQoZ2wuRlJBTUVCVUZGRVIsIGdsLkNPTE9SX0FUVEFDSE1FTlQwLCBnbC5URVhUVVJFXzJELCByLnRleHR1cmVzW1wiclwiXSwgMCk7XG4gICAgcmVuZGVyICggciwgci5wcm9ncmFtc1tcInNjYWxlXCJdLCBbXG4gICAgICB7bmFtZTogXCJpbWFnZVwiLCB2YWx1ZTogci50ZXh0dXJlc1tcIkFcIl19LFxuICAgICAge25hbWU6IFwic2NhbGVcIiwgdmFsdWU6IDAuMH0sXG4gICAgXSk7XG4gICAgZGlzcGxheShyZWdpc3RlciwkKFwiI2J1ZmZlclwiKS52YWwoKSk7XG4gIH0pO1xuXG5cblxuLy8gc2V0dXAgc29tZSBrZXkgaGFuZGxlcnNcbiQoZG9jdW1lbnQpLmtleXByZXNzKGZ1bmN0aW9uKGUpe1xuICBpZiAoIGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQudHlwZSA9PT0gJ3RleHQnICkgeyByZXR1cm47IH1cbiAgdmFyIGsgPSBlLndoaWNoIHx8IGUua2V5Q29kZTtcblxuICAvLyBtYXAgb2YgQVNDSUkgY29kZXMgLT4gYnVmZmVyIG5hbWVzXG4gIHZhciBtYXAgPSB7fTtcbiAgbWFwW1wiclwiLmNoYXJDb2RlQXQoKV0gPSBcInJcIjtcbiAgbWFwW1wieFwiLmNoYXJDb2RlQXQoKV0gPSBcImRyXCI7XG4gIG1hcFtcIk1cIi5jaGFyQ29kZUF0KCldID0gXCJtb3ZpbmdHcmFkaWVudFwiO1xuICBtYXBbXCJGXCIuY2hhckNvZGVBdCgpXSA9IFwiZml4ZWRHcmFkaWVudFwiO1xuICBtYXBbXCJtXCIuY2hhckNvZGVBdCgpXSA9IFwibW92aW5nXCI7XG4gIG1hcFtcImZcIi5jaGFyQ29kZUF0KCldID0gXCJmaXhlZFwiO1xuICBtYXBbXCJpXCIuY2hhckNvZGVBdCgpXSA9IFwiZGlzcGxhY2VkXCI7XG4gIG1hcFtcImRcIi5jaGFyQ29kZUF0KCldID0gXCJkaWZmZXJlbmNlXCI7XG4gIG1hcFtcImFcIi5jaGFyQ29kZUF0KCldID0gXCJBXCI7XG4gIG1hcFtcImJcIi5jaGFyQ29kZUF0KCldID0gXCJCXCI7XG4gIGlmICggayBpbiBtYXAgKSB7XG4gICAgdmFyIGJ1ZmZlciA9IG1hcFtrXTtcbiAgICBjb25zb2xlLmxvZyhcIktleXByZXNzIGZvciBcIiArIGsgKyBcIiAtPiBcIiArIGJ1ZmZlcik7XG4gICAgJChcIiNidWZmZXJcIikudmFsKGJ1ZmZlcikuY2hhbmdlKCk7XG4gICAgcmV0dXJuO1xuICB9XG4gIHZhciBidXR0b25zID0ge307XG4gIGJ1dHRvbnNbXCJzXCIuY2hhckNvZGVBdCgpXSA9IFwiI3N0ZXBcIjtcbiAgYnV0dG9uc1tcIjFcIi5jaGFyQ29kZUF0KCldID0gXCIjc3RlcDEwXCI7XG4gIGJ1dHRvbnNbXCIyXCIuY2hhckNvZGVBdCgpXSA9IFwiI3N0ZXAxMDBcIjtcbiAgYnV0dG9uc1tcInhcIi5jaGFyQ29kZUF0KCldID0gXCIjcmVzdGFydFwiO1xuICBpZiAoIGsgaW4gYnV0dG9ucyApIHtcbiAgICAkKGJ1dHRvbnNba10pLmNsaWNrKCk7XG4gICAgcmV0dXJuO1xuICB9XG59KTtcbiIsIi8vIEZldGNoIGEgZmlsZSBhc3luYyBhbmQgcmV0dXJuIGEgcHJvbWlzZS5cbi8vIFRoZSBgcmVzb2x2ZWAgY2FsbGJhY2sgcmV0dXJucyB0aGUgdGV4dCwgd2hpbGVcbi8vIGByZWplY3RgIHJldHVybnMgYSB0ZXh0IG1lc3NhZ2Ugd2l0aCB0aGUgZXJyb3IuXG4vL1xuLy8gYXJnczpcbi8vICAgdXJsIC0tIHVybCBvZiB0aGUgdGV4dCB0byBnZXRcblxuZnVuY3Rpb24gZmV0Y2hfZmlsZSh1cmwsIGFzeW5jKVxue1xuICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSxyZWplY3QpIHtcblx0ICB2YXIgcmVxdWVzdCA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuXHQgIHJlcXVlc3Qub3BlbihcIkdFVFwiLCB1cmwpO1xuXHQgIHJlcXVlc3Qub3ZlcnJpZGVNaW1lVHlwZShcInRleHQvcGxhaW5cIik7XG5cbiAgICByZXF1ZXN0Lm9ubG9hZCA9IGZ1bmN0aW9uKCkge1xuICAgICAgLy8gQ2FsbGVkIGV2ZW4gb24gNDA0IGVycm9ycywgc28gY2hlY2sgdGhlIHN0YXR1c1xuICAgICAgaWYgKHJlcXVlc3Quc3RhdHVzID09IDIwMCkge1xuICAgICAgICAvLyBSZXNvbHZlIHRoZSBwcm9taXNlIHdpdGggdGhlIHJlc3BvbnNlIHRleHRcbiAgICAgICAgcmVzb2x2ZShyZXF1ZXN0LnJlc3BvbnNlVGV4dCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBPdGhlcndpc2UgcmVqZWN0IHdpdGggdGhlIHN0YXR1cyB0ZXh0XG4gICAgICAgIC8vIHdoaWNoIHdpbGwgaG9wZWZ1bGx5IGJlIGEgbWVhbmluZ2Z1bCBlcnJvclxuICAgICAgICByZWplY3QocmVxdWVzdC5zdGF0dXNUZXh0KTtcbiAgICAgIH1cbiAgICB9O1xuICAgIC8vIEhhbmRsZSBuZXR3b3JrIGVycm9yc1xuICAgIHJlcXVlc3Qub25lcnJvciA9IGZ1bmN0aW9uKCkge1xuICAgICAgcmVqZWN0KFwiTmV0d29yayBFcnJvclwiKTtcbiAgICB9O1xuXHQgIHJlcXVlc3Quc2VuZCgpO1xuICB9KTtcbn1cbiIsIlxuXG4vLyBMb2FkIGFuIGltYWdlIGludG8gdGhlIEdMIGNvbnRleHQgYW5kIHJldHVybiB0aGUgdGV4dHVyZSBpZGVudGlmaWVyIGluIGEgcHJvbWlzZS5cbi8vIFJldHVybnMgYSBwcm9taXNlLiAgVGhlIGByZXNvbHZlYCBjYWxsYmFjayByZXR1cm5zIHRoZSB0ZXh0dXJlLiAgVGhlIGByZWplY3RgIGNhbGxiYWNrXG4vLyByZXR1cm5zIGEgc3RyaW5nIGRlc2NyaWJpbmcgdGhlIGVycm9yLlxuLy9cbi8vIGFyZ3M6XG4vLyAgZ2wgIC0tIFdlYkdMIGNvbnRleHRcbi8vICB1cmwgLS0gVVJMIG9mIHRoZSBpbWFnZSB0byBsb2FkXG5cbmZ1bmN0aW9uIGxvYWRfaW1hZ2UgKCBnbCwgdXJsICkge1xuICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KXtcbiAgICB2YXIgZml4ZWRUZXh0dXJlSW1hZ2UgPSBuZXcgSW1hZ2UoKTtcbiAgICBmaXhlZFRleHR1cmVJbWFnZS5zcmMgPSB1cmw7XG4gICAgZml4ZWRUZXh0dXJlSW1hZ2Uub25sb2FkID0gZnVuY3Rpb24oKSB7XG4gICAgICAvLyBCaW5kIHRoaXMgaW1hZ2UgdG8gZml4ZWRUZXh0dXJlXG4gICAgICB2YXIgZml4ZWRUZXh0dXJlID0gZ2wuY3JlYXRlVGV4dHVyZSgpO1xuICAgICAgZ2wuYmluZFRleHR1cmUoZ2wuVEVYVFVSRV8yRCwgZml4ZWRUZXh0dXJlKTtcbiAgICAgIGdsLnBpeGVsU3RvcmVpKGdsLlVOUEFDS19GTElQX1lfV0VCR0wsIHRydWUpO1xuICAgICAgLy8gYXJncyB0byB0ZXhJbWFnZTJkIGFyZTogdGFyZ2V0ICgyRCBvciBjdWJlKSwgTE9EIGxldmVsICgwKSwgaW50ZXJuYWwgZm9ybWF0IChSR0JBKSwgIGZvcm1hdCAoUkdCQSksIGltYWdlXG4gICAgICBnbC50ZXhJbWFnZTJEKGdsLlRFWFRVUkVfMkQsIDAsIGdsLlJHQkEsIGdsLlJHQkEsIGdsLlVOU0lHTkVEX0JZVEUsIGZpeGVkVGV4dHVyZUltYWdlKTtcbiAgICAgIGdsLnRleFBhcmFtZXRlcmkoZ2wuVEVYVFVSRV8yRCwgZ2wuVEVYVFVSRV9NQUdfRklMVEVSLCBnbC5MSU5FQVIpO1xuICAgICAgZ2wudGV4UGFyYW1ldGVyaShnbC5URVhUVVJFXzJELCBnbC5URVhUVVJFX01JTl9GSUxURVIsIGdsLkxJTkVBUik7XG4gICAgICBnbC50ZXhQYXJhbWV0ZXJpKGdsLlRFWFRVUkVfMkQsIGdsLlRFWFRVUkVfV1JBUF9TLCBnbC5DTEFNUF9UT19FREdFKTtcbiAgICAgIGdsLnRleFBhcmFtZXRlcmkoZ2wuVEVYVFVSRV8yRCwgZ2wuVEVYVFVSRV9XUkFQX1QsIGdsLkNMQU1QX1RPX0VER0UpO1xuXG4gICAgICByZXNvbHZlKGZpeGVkVGV4dHVyZSk7XG4gICAgfTtcbiAgICBcbiAgICBmaXhlZFRleHR1cmVJbWFnZS5vbmFib3J0ID0gZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgIHJlamVjdChldmVudC5tZXNzYWdlKTtcbiAgICB9O1xuICB9KTtcbn1cbiIsIi8vIFJlYWQgdGV4dHVyZSBpbnRvIEZsb2F0IGFycmF5XG4vL1xuLy8gYXJnczpcbi8vICAgciAgLS0gcmVnaXN0cmF0aW9uIG9iamVjdFxuLy8gICB0ICAtLSB0ZXh0dXJlIHRvIHJlYWRcbi8vICAgdyAgLS0gd2lkdGggb2YgYnVmZmVyXG4vLyAgIGggIC0tIGhlaWdodCBvZiBidWZmZXJcblxuXG5mdW5jdGlvbiByZWFkX3RleHR1cmUgKCByLCB0LCB3LCBoICkge1xuICB2YXIgZ2wgPSByLmdsO1xuXG4gIHZhciBvdXQgPSBuZXcgRmxvYXQzMkFycmF5KDMqdypoKTtcblxuXG4gIGZvciAoIHZhciBpbmRleCA9IDA7IGluZGV4IDwgMzsgaW5kZXgrKyApIHtcbiAgICB2YXIgcGl4ZWxzID0gbmV3IFVpbnQ4QXJyYXkodypoICogNCk7XG4gICAgZ2wuYmluZEZyYW1lYnVmZmVyKGdsLkZSQU1FQlVGRkVSLCByLmZyYW1lYnVmZmVyKTtcbiAgICBnbC5mcmFtZWJ1ZmZlclRleHR1cmUyRChnbC5GUkFNRUJVRkZFUiwgZ2wuQ09MT1JfQVRUQUNITUVOVDAsIGdsLlRFWFRVUkVfMkQsIHIudGV4dHVyZXNbJ2VuY29kZSddLCAwKTtcbiAgICByZW5kZXIgKCByLCByLnByb2dyYW1zW1wiZW5jb2RlX2Zsb2F0XCJdLCBbXG4gICAgICB7bmFtZTogXCJpbWFnZVwiLCB2YWx1ZTogdH0sXG4gICAgICB7bmFtZTogXCJpbmRleFwiLCB2YWx1ZTogaW5kZXh9LFxuICAgIF0pOyAgXG5cbiAgICBnbC5yZWFkUGl4ZWxzKDAsIDAsIHcsIGgsIGdsLlJHQkEsIGdsLlVOU0lHTkVEX0JZVEUsIHBpeGVscyk7XG4gICAgb3V0LnNldChuZXcgRmxvYXQzMkFycmF5KHBpeGVscy5idWZmZXIpLCBpbmRleCp3KmgpO1xuICB9XG4gIHJldHVybiBvdXQ7XG4gIFxufVxuIiwiXG5cbnZhciByZWdpc3RlciA9IHtcblxuICBjYW52YXM6IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjYW52YXMnKSxcbiAgZ2w6IG51bGwsXG5cbiAgLy8gVGV4dHVyZXNcbiAgZml4ZWRUZXh0dXJlOiBudWxsLFxuICBtb3ZpbmdUZXh0dXJlOiBudWxsLFxuXG4gIC8vIEN1cnJlbnRseSBkaXNwbGF5ZWQgaW1hZ2UgdmFsdWVzXG4gIHBpeGVsczogbnVsbCxcbiAgXG4gIC8vIGJ1ZmZlciBpcyB0aGUgZ2Vtb3RlcnkgYXJyYXkgZm9yIHRoZSB0cmlhbmdsZXNcbiAgYnVmZmVyOiBudWxsLFxuXG4gIC8vIFRleHR1cmUgY29vcmRpbmF0ZXNcbiAgdGV4dHVyZUNvb3JkQnVmZmVyOiBudWxsLFxuXG4gIC8vIHByb2dyYW1zXG4gIHByb2dyYW1zOiB7fSxcbiAgLy8gTWV0cmljIHByb2dyYW0gc3VidHJhY3RzIHR3byB0ZXh0dXJlc1xuICBtZXRyaWNQcm9ncmFtOiBudWxsLFxuXG4gIC8vIERpc3BsYXkgcHJvZ3JhbSBzaW1wbHkgcmVuZGVycyBhbiBpbWFnZVxuICBkaXNwbGF5UHJvZ3JhbTogbnVsbCxcblxuICAvLyBTdW0gcHJvZ3JhbSB3aWxsIGFkZCBhbmQgZG93bnNhbXBsZVxuICBzdW1Qcm9ncmFtOiBudWxsLFxuXG4gIC8vIEZyYW1lYnVmZmVyXG4gIGZyYW1lYnVmZmVyOiBudWxsLFxuICBcbiAgLy8gVGV4dHVyZSBmb3IgZGlmZmVyZW5jZSBpbWFnZVxuICB0ZXh0dXJlczoge30sXG4gIHN1bVB5cmFtaWQ6IFtdLFxuICBvdXRQeXJhbWlkOiBbXSxcbiAgZGlmZmVyZW5jZVRleHR1cmU6IG51bGwsXG59O1xuXG5cblxuJChmdW5jdGlvbigpIHtcbiAgaW5pdCgpO1xufSk7XG5cblxuXG5mdW5jdGlvbiBpbml0KCkge1xuICB2YXIgZ2wgPSByZWdpc3Rlci5nbCA9IGNhbnZhcy5nZXRDb250ZXh0KFwid2ViZ2xcIik7XG4gIFxuICBpZiAoICFnbC5nZXRFeHRlbnNpb24oJ09FU190ZXh0dXJlX2Zsb2F0JykgKSB7XG4gICAgYWxlcnQgKCBcIlRoaXMgYnJvd3NlciBkb2VzIG5vdCBzdXBwb3J0IGZsb2F0aW5nIHBvaW50IHRleHR1cmVzIVwiICk7XG4gIH07XG5cbiAgLy8gT2ZmIHNjcmVlbiBmcmFtZSBidWZmZXJcbiAgcmVnaXN0ZXIuZnJhbWVidWZmZXIgPSBnbC5jcmVhdGVGcmFtZWJ1ZmZlcigpO1xuICBcbiAgLy8gVmVydGV4IGJ1ZmZlclxuICB2YXIgYnVmZmVyID0gcmVnaXN0ZXIuYnVmZmVyID0gZ2wuY3JlYXRlQnVmZmVyKCk7XG4gIGdsLmJpbmRCdWZmZXIoZ2wuQVJSQVlfQlVGRkVSLCBidWZmZXIpO1xuICBnbC5idWZmZXJEYXRhKCBnbC5BUlJBWV9CVUZGRVIsXG4gICAgICAgICAgICAgICAgIG5ldyBGbG9hdDMyQXJyYXkoW1xuICAgICAgICAgICAgICAgICAgICAgLTEuMCwgLTEuMCxcbiAgICAgICAgICAgICAgICAgICAgICAxLjAsIC0xLjAsXG4gICAgICAgICAgICAgICAgICAgICAtMS4wLCAgMS4wLFxuICAgICAgICAgICAgICAgICAgICAgLTEuMCwgIDEuMCxcbiAgICAgICAgICAgICAgICAgICAgICAxLjAsIC0xLjAsXG4gICAgICAgICAgICAgICAgICAgICAgMS4wLCAgMS4wXSksXG4gICAgICAgICAgICAgICAgIGdsLlNUQVRJQ19EUkFXKTtcblxuICAvLyBUZXh0dXJlIGNvb3JkaW5hdGVzIG5lZWQgdG8gY29ycmVzcG9uZCB0byB0aGUgdmVydGV4IGNvb3JkaW5hdGVzXG4gIHZhciB0ZXh0dXJlQ29vcmRCdWZmZXIgPSByZWdpc3Rlci50ZXh0dXJlQ29vcmRCdWZmZXIgPSBnbC5jcmVhdGVCdWZmZXIoKTtcbiAgZ2wuYmluZEJ1ZmZlcihnbC5BUlJBWV9CVUZGRVIsIHRleHR1cmVDb29yZEJ1ZmZlcik7XG4gIGdsLmJ1ZmZlckRhdGEoZ2wuQVJSQVlfQlVGRkVSLCBuZXcgRmxvYXQzMkFycmF5KFtcbiAgICAwLDAsXG4gICAgMSwwLFxuICAgIDAsMSxcbiAgICAwLDEsXG4gICAgMSwwLFxuICAgIDEsMV0pLCBnbC5TVEFUSUNfRFJBVyk7XG4gIGdsLmJpbmRCdWZmZXIoZ2wuQVJSQVlfQlVGRkVSLCBudWxsKTtcblxuICAvLyBUZXh0dXJlcyBuZWVkZWRcbiAgcmVnaXN0ZXIudGV4dHVyZXNbXCJBXCJdID0gY3JlYXRlX2Zsb2F0X3RleHR1cmUgKCByZWdpc3RlciwgNTEyLCA1MTIgKTtcbiAgcmVnaXN0ZXIudGV4dHVyZXNbXCJCXCJdID0gY3JlYXRlX2Zsb2F0X3RleHR1cmUgKCByZWdpc3RlciwgNTEyLCA1MTIgKTtcbiAgcmVnaXN0ZXIudGV4dHVyZXNbXCJlbmNvZGVcIl0gPSBjcmVhdGVfZmxvYXRfdGV4dHVyZSAoIHJlZ2lzdGVyLCA1MTIsIDUxMiApO1xuICByZWdpc3Rlci50ZXh0dXJlc1tcInJcIl0gPSBjcmVhdGVfZmxvYXRfdGV4dHVyZSAoIHJlZ2lzdGVyLCA1MTIsIDUxMiApO1xuICByZWdpc3Rlci50ZXh0dXJlc1tcImRyXCJdID0gY3JlYXRlX2Zsb2F0X3RleHR1cmUgKCByZWdpc3RlciwgNTEyLCA1MTIgKTtcbiAgcmVnaXN0ZXIudGV4dHVyZXNbXCJkaWZmZXJlbmNlXCJdID0gY3JlYXRlX2Zsb2F0X3RleHR1cmUgKCByZWdpc3RlciwgNTEyLCA1MTIgKTtcbiAgcmVnaXN0ZXIudGV4dHVyZXNbXCJtb3ZpbmdHcmFkaWVudFwiXSA9IGNyZWF0ZV9mbG9hdF90ZXh0dXJlICggcmVnaXN0ZXIsIDUxMiwgNTEyICk7XG4gIHJlZ2lzdGVyLnRleHR1cmVzW1wiZGlzcGxhY2VkXCJdID0gY3JlYXRlX2Zsb2F0X3RleHR1cmUgKCByZWdpc3RlciwgNTEyLCA1MTIgKTtcbiAgcmVnaXN0ZXIudGV4dHVyZXNbXCJmaXhlZEdyYWRpZW50XCJdID0gY3JlYXRlX2Zsb2F0X3RleHR1cmUgKCByZWdpc3RlciwgNTEyLCA1MTIgKTtcblxuICAvLyBMb2FkIHRoZSBpbWFnZSB2aWEgYSBwcm9taXNlXG4gIGxvYWRfaW1hZ2UoZ2wsIFwiaW1hZ2VzL2NvcGQxX2VCSENUX3NsaWNlLnBuZ1wiKS50aGVuKGZ1bmN0aW9uKHRleHR1cmUpe1xuICAvLyBsb2FkX2ltYWdlKGdsLCBcImltYWdlcy9wcmVPcFQyLnBuZ1wiKS50aGVuKGZ1bmN0aW9uKHRleHR1cmUpe1xuICAgIHJlZ2lzdGVyLmZpeGVkVGV4dHVyZSA9IHRleHR1cmU7XG4gICAgcmVnaXN0ZXIudGV4dHVyZXNbXCJmaXhlZFwiXSA9IHRleHR1cmU7XG4gICAgcmV0dXJuIGxvYWRfaW1hZ2UoZ2wsXCJpbWFnZXMvY29wZDFfaUJIQ1Rfc2xpY2UucG5nXCIpO1xuICAgIC8vIHJldHVybiBsb2FkX2ltYWdlKGdsLFwiaW1hZ2VzL2ludHJhT3BUMi5wbmdcIik7XG4gICAgLy8gcmV0dXJuIGxvYWRfaW1hZ2UoZ2wsXCJpbWFnZXMvcHJlT3BUMi1zbGlnaHQucG5nXCIpO1xuICB9KS50aGVuKGZ1bmN0aW9uKHRleHR1cmUpIHtcbiAgICByZWdpc3Rlci5tb3ZpbmdUZXh0dXJlID0gdGV4dHVyZTtcbiAgICByZWdpc3Rlci50ZXh0dXJlc1tcIm1vdmluZ1wiXSA9IHRleHR1cmU7XG4gICAgLy8gQ2hhaW4gY29tcGlsaW5nIHRoZSBjb2RlXG4gICAgcmV0dXJuIGNvbXBpbGVfcHJvZ3JhbShnbCwgXCJzaGFkZXJzL3JlZ2lzdGVyLnZzXCIsIFwic2hhZGVycy9kaXNwbGF5LmZzXCIgKTtcbiAgfSkudGhlbihmdW5jdGlvbihwcm9ncmFtKXtcbiAgICByZWdpc3Rlci5kaXNwbGF5UHJvZ3JhbSA9IHByb2dyYW07XG4gICAgcmV0dXJuIGNvbXBpbGVfcHJvZ3JhbShnbCwgXCJzaGFkZXJzL3JlZ2lzdGVyLnZzXCIsIFwic2hhZGVycy9kaWZmZXJlbmNlLmZzXCIgKTtcbiAgfSkudGhlbihmdW5jdGlvbihwcm9ncmFtKXtcbiAgICByZWdpc3Rlci5wcm9ncmFtc1tcImRpZmZlcmVuY2VcIl0gPSBwcm9ncmFtO1xuICAgIHJldHVybiBjb21waWxlX3Byb2dyYW0oZ2wsIFwic2hhZGVycy9yZWdpc3Rlci52c1wiLCBcInNoYWRlcnMvc2NhbGUuZnNcIiApO1xuICB9KS50aGVuKGZ1bmN0aW9uKHByb2dyYW0pe1xuICAgIHJlZ2lzdGVyLnByb2dyYW1zW1wic2NhbGVcIl0gPSBwcm9ncmFtO1xuICAgIHJldHVybiBjb21waWxlX3Byb2dyYW0oZ2wsIFwic2hhZGVycy9yZWdpc3Rlci52c1wiLCBcInNoYWRlcnMvc3VtLmZzXCIgKTtcbiAgfSkudGhlbihmdW5jdGlvbihwcm9ncmFtKXtcbiAgICByZWdpc3Rlci5wcm9ncmFtc1tcInN1bVwiXSA9IHByb2dyYW07XG4gICAgcmV0dXJuIGNvbXBpbGVfcHJvZ3JhbShnbCwgXCJzaGFkZXJzL3JlZ2lzdGVyLnZzXCIsIFwic2hhZGVycy9jb3B5LmZzXCIgKTtcbiAgfSkudGhlbihmdW5jdGlvbihwcm9ncmFtKXtcbiAgICByZWdpc3Rlci5wcm9ncmFtc1tcImNvcHlcIl0gPSBwcm9ncmFtO1xuICAgIHJldHVybiBjb21waWxlX3Byb2dyYW0oZ2wsIFwic2hhZGVycy9yZWdpc3Rlci52c1wiLCBcInNoYWRlcnMvZW5jb2RlX2Zsb2F0LmZzXCIgKTtcbiAgfSkudGhlbihmdW5jdGlvbihwcm9ncmFtKXtcbiAgICByZWdpc3Rlci5wcm9ncmFtc1tcImVuY29kZV9mbG9hdFwiXSA9IHByb2dyYW07XG4gICAgcmV0dXJuIGNvbXBpbGVfcHJvZ3JhbShnbCwgXCJzaGFkZXJzL3JlZ2lzdGVyLnZzXCIsIFwic2hhZGVycy9ncmFkaWVudC5mc1wiICk7XG4gIH0pLnRoZW4oZnVuY3Rpb24ocHJvZ3JhbSl7XG4gICAgcmVnaXN0ZXIucHJvZ3JhbXNbXCJncmFkaWVudFwiXSA9IHByb2dyYW07XG4gICAgcmV0dXJuIGNvbXBpbGVfcHJvZ3JhbShnbCwgXCJzaGFkZXJzL3JlZ2lzdGVyLnZzXCIsIFwic2hhZGVycy9zbW9vdGguZnNcIiApO1xuICB9KS50aGVuKGZ1bmN0aW9uKHByb2dyYW0pe1xuICAgIHJlZ2lzdGVyLnByb2dyYW1zW1wic21vb3RoXCJdID0gcHJvZ3JhbTtcbiAgICByZXR1cm4gY29tcGlsZV9wcm9ncmFtKGdsLCBcInNoYWRlcnMvcmVnaXN0ZXIudnNcIiwgXCJzaGFkZXJzL2Rpc3BsYWNlbWVudC5mc1wiICk7XG4gIH0pLnRoZW4oZnVuY3Rpb24ocHJvZ3JhbSl7XG4gICAgcmVnaXN0ZXIucHJvZ3JhbXNbXCJkaXNwbGFjZW1lbnRcIl0gPSBwcm9ncmFtO1xuICAgIHJldHVybiBjb21waWxlX3Byb2dyYW0oZ2wsIFwic2hhZGVycy9yZWdpc3Rlci52c1wiLCBcInNoYWRlcnMvdXBkYXRlUi5mc1wiICk7XG4gIH0pLnRoZW4oZnVuY3Rpb24ocHJvZ3JhbSl7XG4gICAgcmVnaXN0ZXIucHJvZ3JhbXNbXCJ1cGRhdGVSXCJdID0gcHJvZ3JhbTtcbiAgICByZXR1cm4gY29tcGlsZV9wcm9ncmFtKGdsLCBcInNoYWRlcnMvcmVnaXN0ZXIudnNcIiwgXCJzaGFkZXJzL2Rpc3BsYWNlLmZzXCIgKTtcbiAgfSkudGhlbihmdW5jdGlvbihwcm9ncmFtKXtcbiAgICByZWdpc3Rlci5wcm9ncmFtc1tcImRpc3BsYWNlXCJdID0gcHJvZ3JhbTtcbiAgICBzdGFydF9yZW5kZXIocmVnaXN0ZXIpO1xuICAgIC8vIGRpc3BsYXkocmVnaXN0ZXIsJChcIiNidWZmZXJcIikudmFsKCkpO1xuICB9KS5jYXRjaChmdW5jdGlvbihlcnJvck1lc3NhZ2Upe1xuICAgIGNvbnNvbGUubG9nKFwiRXJyb3I6IFwiICsgZXJyb3JNZXNzYWdlKVxuICAgICQoXCIjc3RhdHVzXCIpLmh0bWwoZXJyb3JNZXNzYWdlKTtcbiAgfSk7XG59XG5cbmZ1bmN0aW9uIGRpc3BsYXkocixidWZmZXIpIHtcbiAgdmFyIHNjYWxlID0gTnVtYmVyKCQoXCIjc2NhbGVcIikuYXR0cihcInZhbHVlXCIpKTtcbiAgY29uc29sZS5sb2coXCJEaXNwbGF5aW5nIGJ1ZmZlciBcIiArIGJ1ZmZlciArIFwiIHNjYWxlOiBcIiArIHNjYWxlKTtcbiAgdmFyIGdsID0gci5nbDtcbiAgZ2wudmlld3BvcnQoMCwwLDUxMiw1MTIpO1xuICBnbC5iaW5kRnJhbWVidWZmZXIoZ2wuRlJBTUVCVUZGRVIsIG51bGwpO1xuICByZW5kZXIgKCByLCByLmRpc3BsYXlQcm9ncmFtLCBbXG4gICAge25hbWU6IFwiaW1hZ2VcIiwgdmFsdWU6IHIudGV4dHVyZXNbYnVmZmVyXX0sXG4gICAge25hbWU6IFwic2NhbGVcIiwgdmFsdWU6IHNjYWxlfSxcbiAgXSk7XG5cbiAgLy8gUHVsbCB0aGUgYnVmZmVyIHRvIGEgbG9jYWwgYXJyYXlcbiAgci5waXhlbHMgPSByZWFkX3RleHR1cmUgKCByLCByLnRleHR1cmVzW2J1ZmZlcl0sIDUxMiwgNTEyKTtcbiAgXG4gIC8vIERvIGEgc2luZ2xlIHN0ZXBcbiAgLy8gc3RhcnRfcmVuZGVyKHIpO1xufVxuXG5mdW5jdGlvbiBzdGFydF9yZW5kZXIocixjb3VudCkge1xuICBkZW1vbnNTdGVwKHIsIGNvdW50fHwxKTtcbiAgZGlzcGxheSAociwgJCgnI2J1ZmZlcicpLnZhbCgpKTtcbn1cblxuXG5cblxuIiwiLy8gUmVuZGVyIHVzaW5nIFdlYkdMXG4vLyBhcmdzOlxuLy8gICByICAgICAgICAgIC0tIHJlZ2lzdGVyIG9iamVjdFxuLy8gICBwcm9ncmFtICAgIC0tIHdoaWNoIHByb2dyYW0gdG8gdXNlIGluIHRoZSByZW5kZXJpbmdcbi8vICAgcGFyYW1ldGVycyAtLSBhcnJheSBvZiB2YWx1ZXMgdG8gcGFzcyB0byB0aGUgcHJvZ3JhbSwgY29uc2lzdHMgb2YgbmFtZSAvIHZhbHVlIHBhaXJzLCBlLmcuIHsgbmFtZTogXCJ0aW1lXCIsIHZhbHVlOiAxMjMuMyB9XG4vLyAgICAgICAgICAgICAgICAgbWF5IGJlIGludCwgZmxvYXQsIGJvb2wsIHRleHR1cmVcblxuZnVuY3Rpb24gaXNJbnRlZ2VyKG4pe1xuICAgIHJldHVybiBuID09PSArbiAmJiBuID09PSAobnwwKTtcbn1cblxuZnVuY3Rpb24gaXNGbG9hdChuKXtcbiAgcmV0dXJuIHR5cGVvZihuKSA9PT0gXCJudW1iZXJcIjtcbn1cblxuZnVuY3Rpb24gaXNCb29sZWFuKG4pe1xuICByZXR1cm4gdHlwZW9mKG4pID09PSBcImJvb2xlYW5cIjtcbn1cblxuZnVuY3Rpb24gaXNJbWFnZShuKXtcbiAgcmV0dXJuIG4gaW5zdGFuY2VvZiBXZWJHTFRleHR1cmU7XG59XG5cbmZ1bmN0aW9uIHJlbmRlciAoIHIsIHByb2dyYW0sIHBhcmFtZXRlcnMgKSB7XG5cbiAgdmFyIGdsID0gci5nbDtcbiAgZ2wudXNlUHJvZ3JhbShwcm9ncmFtKTtcbiAgY2hlY2tHTEVycm9yKGdsKTtcbiAgLy8gd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZShyZW5kZXIsY2FudmFzKTtcblxuICB2YXIgdGV4ID0gZ2wuZ2V0QXR0cmliTG9jYXRpb24ocHJvZ3JhbSwgJ3RleFBvc2l0aW9uJyk7XG4gIGNoZWNrR0xFcnJvcihnbCk7XG4gIGdsLmJpbmRCdWZmZXIoZ2wuQVJSQVlfQlVGRkVSLCByLnRleHR1cmVDb29yZEJ1ZmZlcik7XG4gIGNoZWNrR0xFcnJvcihnbCk7XG4gIGdsLmVuYWJsZVZlcnRleEF0dHJpYkFycmF5KHRleCk7XG4gIGNoZWNrR0xFcnJvcihnbCk7XG4gIGdsLnZlcnRleEF0dHJpYlBvaW50ZXIodGV4LCAyLCBnbC5GTE9BVCwgZmFsc2UsIDAsIDApO1xuICBjaGVja0dMRXJyb3IoZ2wpO1xuXG4gIC8vIENyZWF0ZSBhIGJ1ZmZlciBhbmQgcHV0IGEgc2luZ2xlIGNsaXBzcGFjZSByZWN0YW5nbGUgaW5cbiAgLy8gaXQgKDIgdHJpYW5nbGVzKVxuICB2YXIgcG9zaXRpb24gPSBnbC5nZXRBdHRyaWJMb2NhdGlvbihyLmRpc3BsYXlQcm9ncmFtLCAncG9zaXRpb24nKTtcbiAgZ2wuYmluZEJ1ZmZlcihnbC5BUlJBWV9CVUZGRVIsIHIuYnVmZmVyKTtcbiAgZ2wuZW5hYmxlVmVydGV4QXR0cmliQXJyYXkocG9zaXRpb24pO1xuICBnbC52ZXJ0ZXhBdHRyaWJQb2ludGVyKHBvc2l0aW9uLCAyLCBnbC5GTE9BVCwgZmFsc2UsIDAsIDApO1xuXG4gIC8vIEJpbmQgdW5pZm9ybXNcbiAgdmFyIHRleHR1cmVJbmRleCA9IDA7XG4gIHBhcmFtZXRlcnMuZm9yRWFjaCggZnVuY3Rpb24ocGFyYW0sIGluZGV4KSB7XG4gICAgdmFyIGxvY2F0aW9uID0gZ2wuZ2V0VW5pZm9ybUxvY2F0aW9uKHByb2dyYW0sIHBhcmFtLm5hbWUpO1xuICAgIGlmICggaXNJbWFnZShwYXJhbS52YWx1ZSkgKSB7XG4gICAgICB2YXIgc2FtcGxlciA9IGdsLmdldFVuaWZvcm1Mb2NhdGlvbihwcm9ncmFtLCBwYXJhbS5uYW1lKTtcbiAgICAgIGdsLmFjdGl2ZVRleHR1cmUoZ2wuVEVYVFVSRTAgKyB0ZXh0dXJlSW5kZXgpO1xuICAgICAgZ2wuYmluZFRleHR1cmUoZ2wuVEVYVFVSRV8yRCwgcGFyYW0udmFsdWUpO1xuICAgICAgZ2wudW5pZm9ybTFpKHNhbXBsZXIsIHRleHR1cmVJbmRleCk7XG4gICAgICBjaGVja0dMRXJyb3IoZ2wpO1xuICAgICAgdGV4dHVyZUluZGV4Kys7XG4gICAgfSBlbHNlIGlmICggaXNCb29sZWFuKHBhcmFtLnZhbHVlKSApIHtcbiAgICAgIGdsLnVuaWZvcm0xaShsb2NhdGlvbiwgcGFyYW0udmFsdWUpO1xuICAgIH0gZWxzZSBpZiAoIGlzRmxvYXQocGFyYW0udmFsdWUpICkge1xuICAgICAgZ2wudW5pZm9ybTFmKGxvY2F0aW9uLCBwYXJhbS52YWx1ZSk7XG4gICAgfVxuICAgIFxuICB9KTtcblxuICAvLyBkcmF3XG4gIGdsLmRyYXdBcnJheXMoZ2wuVFJJQU5HTEVTLCAwLCA2KTtcbiAgXG59XG4iLCJcbmZ1bmN0aW9uIHRlc3RTdGVwKHIsY291bnQpIHtcbiAgY291bnQgPSBjb3VudCB8fCAxO1xuICBjb25zb2xlLmxvZyhcIlJ1bm5pbmcgXCIgKyBjb3VudCArIFwiIHN0ZXBzIGluIHRoZSBEZW1vbidzIGFsZ29yaXRobVwiKTtcbiAgZm9yICggdmFyIGNvdW50ZXIgPSAwOyBjb3VudGVyIDwgY291bnQ7IGNvdW50ZXIrKyApIHtcbiAgICB2YXIgZ2wgPSByLmdsO1xuICAgIFxuICAgIGdsLnZpZXdwb3J0KDAsMCw1MTIsNTEyKTtcbiAgICBnbC5jbGVhckNvbG9yKDAuMCwgMC4wLCAwLjAsIDEuMCk7XG4gICAgZ2wuY2xlYXIoZ2wuQ09MT1JfQlVGRkVSX0JJVCk7XG4gICAgZ2wuYmluZEZyYW1lYnVmZmVyKGdsLkZSQU1FQlVGRkVSLCByLmZyYW1lYnVmZmVyKTtcbiAgICBcbiAgICBnbC5mcmFtZWJ1ZmZlclRleHR1cmUyRChnbC5GUkFNRUJVRkZFUiwgZ2wuQ09MT1JfQVRUQUNITUVOVDAsIGdsLlRFWFRVUkVfMkQsIHIudGV4dHVyZXNbXCJyXCJdLCAwKTtcbiAgICByZW5kZXIgKCByLCByLnByb2dyYW1zW1wiY29weVwiXSwgW1xuICAgICAge25hbWU6IFwiaW1hZ2VcIiwgdmFsdWU6IHIudGV4dHVyZXNbXCJtb3ZpbmdcIl19LFxuICAgIF0pO1xuICAgIFxuICAgIC8vIDcuIHNtb290aCBgcmBcbiAgICB2YXIgc2lnbWEgPSAxLjA7XG4gICAgLy8gc21vb3RoQnVmZmVyICggciwgXCJyXCIsIDguMCApO1xuICB9ICBcbn1cbiIsIi8qKlxuICogQ3JlYXRlcyBhbmQgY29tcGlsZXMgYSBzaGFkZXIuXG4gKlxuICogQHBhcmFtIHshV2ViR0xSZW5kZXJpbmdDb250ZXh0fSBnbCBUaGUgV2ViR0wgQ29udGV4dC5cbiAqIEBwYXJhbSB7c3RyaW5nfSBzaGFkZXJTb3VyY2UgVGhlIEdMU0wgc291cmNlIGNvZGUgZm9yIHRoZSBzaGFkZXIuXG4gKiBAcGFyYW0ge251bWJlcn0gc2hhZGVyVHlwZSBUaGUgdHlwZSBvZiBzaGFkZXIsIFZFUlRFWF9TSEFERVIgb3JcbiAqICAgICBGUkFHTUVOVF9TSEFERVIuXG4gKiBAcmV0dXJuIHshV2ViR0xTaGFkZXJ9IFRoZSBzaGFkZXIuXG4gKi9cbmZ1bmN0aW9uIGNvbXBpbGVTaGFkZXIoZ2wsIHNoYWRlclNvdXJjZSwgc2hhZGVyVHlwZSkge1xuICAvLyBDcmVhdGUgdGhlIHNoYWRlciBvYmplY3RcbiAgdmFyIHNoYWRlciA9IGdsLmNyZWF0ZVNoYWRlcihzaGFkZXJUeXBlKTtcbiBcbiAgLy8gU2V0IHRoZSBzaGFkZXIgc291cmNlIGNvZGUuXG4gIGdsLnNoYWRlclNvdXJjZShzaGFkZXIsIHNoYWRlclNvdXJjZSk7XG4gXG4gIC8vIENvbXBpbGUgdGhlIHNoYWRlclxuICBnbC5jb21waWxlU2hhZGVyKHNoYWRlcik7XG4gXG4gIC8vIENoZWNrIGlmIGl0IGNvbXBpbGVkXG4gIHZhciBzdWNjZXNzID0gZ2wuZ2V0U2hhZGVyUGFyYW1ldGVyKHNoYWRlciwgZ2wuQ09NUElMRV9TVEFUVVMpO1xuICBpZiAoIXN1Y2Nlc3MpIHtcbiAgICAvLyBTb21ldGhpbmcgd2VudCB3cm9uZyBkdXJpbmcgY29tcGlsYXRpb247IGdldCB0aGUgZXJyb3JcbiAgICB0aHJvdyBcImNvdWxkIG5vdCBjb21waWxlIHNoYWRlcjpcIiArIGdsLmdldFNoYWRlckluZm9Mb2coc2hhZGVyKTtcbiAgfVxuIFxuICByZXR1cm4gc2hhZGVyO1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYSBwcm9ncmFtIGZyb20gMiBzaGFkZXJzLlxuICpcbiAqIEBwYXJhbSB7IVdlYkdMUmVuZGVyaW5nQ29udGV4dCkgZ2wgVGhlIFdlYkdMIGNvbnRleHQuXG4gKiBAcGFyYW0geyFXZWJHTFNoYWRlcn0gdmVydGV4U2hhZGVyIEEgdmVydGV4IHNoYWRlci5cbiAqIEBwYXJhbSB7IVdlYkdMU2hhZGVyfSBmcmFnbWVudFNoYWRlciBBIGZyYWdtZW50IHNoYWRlci5cbiAqIEByZXR1cm4geyFXZWJHTFByb2dyYW19IEEgcHJvZ3JhbS5cbiAqL1xuZnVuY3Rpb24gY3JlYXRlUHJvZ3JhbShnbCwgdmVydGV4U2hhZGVyLCBmcmFnbWVudFNoYWRlcikge1xuICAvLyBjcmVhdGUgYSBwcm9ncmFtLlxuICB2YXIgcHJvZ3JhbSA9IGdsLmNyZWF0ZVByb2dyYW0oKTtcbiBcbiAgLy8gYXR0YWNoIHRoZSBzaGFkZXJzLlxuICBnbC5hdHRhY2hTaGFkZXIocHJvZ3JhbSwgdmVydGV4U2hhZGVyKTtcbiAgZ2wuYXR0YWNoU2hhZGVyKHByb2dyYW0sIGZyYWdtZW50U2hhZGVyKTtcbiBcbiAgLy8gbGluayB0aGUgcHJvZ3JhbS5cbiAgZ2wubGlua1Byb2dyYW0ocHJvZ3JhbSk7XG4gXG4gIC8vIENoZWNrIGlmIGl0IGxpbmtlZC5cbiAgdmFyIHN1Y2Nlc3MgPSBnbC5nZXRQcm9ncmFtUGFyYW1ldGVyKHByb2dyYW0sIGdsLkxJTktfU1RBVFVTKTtcbiAgaWYgKCFzdWNjZXNzKSB7XG4gICAgICAvLyBzb21ldGhpbmcgd2VudCB3cm9uZyB3aXRoIHRoZSBsaW5rXG4gICAgICB0aHJvdyAoXCJwcm9ncmFtIGZpbGVkIHRvIGxpbms6XCIgKyBnbC5nZXRQcm9ncmFtSW5mb0xvZyAocHJvZ3JhbSkpO1xuICB9XG4gXG4gIHJldHVybiBwcm9ncmFtO1xufTtcblxuXG5mdW5jdGlvbiBjaGVja0dMRXJyb3IoZ2wpIHtcblx0dmFyIGVycm9yID0gZ2wuZ2V0RXJyb3IoKTtcblx0aWYgKGVycm9yICE9IGdsLk5PX0VSUk9SKSB7XG5cdFx0dmFyIHN0ciA9IFwiR0wgRXJyb3I6IFwiICsgZXJyb3IgKyBcIiBcIiArIGdsLmVudW1fc3RyaW5nc1tlcnJvcl07XG5cdFx0Y29uc29sZS5sb2coc3RyKTtcblx0XHR0aHJvdyBzdHI7XG5cdH1cbn1cblxuXG5cbmZ1bmN0aW9uIEZldGNoRmlsZSh1cmwsIGFzeW5jKVxue1xuXHR2YXIgcmVxdWVzdCA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuXHRyZXF1ZXN0Lm9wZW4oXCJHRVRcIiwgdXJsLCBhc3luYyk7XG5cdHJlcXVlc3Qub3ZlcnJpZGVNaW1lVHlwZShcInRleHQvcGxhaW5cIik7XG5cdHJlcXVlc3Quc2VuZChudWxsKTtcblx0cmV0dXJuIHJlcXVlc3QucmVzcG9uc2VUZXh0O1xufVxuIl0sInNvdXJjZVJvb3QiOiIvc291cmNlLyJ9
