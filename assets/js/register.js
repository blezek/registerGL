

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

  register.textures["A"] = create_float_texture ( register, 512, 512 );
  register.textures["B"] = create_float_texture ( register, 512, 512 );
  
  // Load the image via a promise
  load_image(gl, "images/chest.png").then(function(texture){
    register.fixedTexture = texture;
    return load_image(gl,"images/chest-rotated.png");
  }).then(function(texture) {
    register.movingTexture = texture;
    // Chain compiling the code
    return compile_program(gl, "shaders/register.vs", "shaders/display.fs" );
  }).then(function(program){
    register.displayProgram = program;
    return compile_program(gl, "shaders/register.vs", "shaders/difference.fs" );
  }).then(function(program){
    register.metricProgram = program;
    return compile_program(gl, "shaders/register.vs", "shaders/scale.fs" );
  }).then(function(program){
    console.log ( "Programs", register.programs )
    register.programs["scale"] = program;
    console.log ( "Programs", register.programs )
    start_render(register);
  }).catch(function(errorMessage){
    console.log("Error: " + errorMessage)
    $("#status").html(errorMessage);
  });
}

function start_render(r) {
  var gl = r.gl;
  gl.clearColor(1.0, 0.0, 0.0, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  // Render the difference image to a texture and display
  gl.bindFramebuffer(gl.FRAMEBUFFER, r.framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, r.textures["A"], 0);
  render ( r, r.metricProgram, [
    {name: "fixedImage", value: r.fixedTexture},
    {name: "movingImage", value: r.movingTexture},
  ]);

  // Scale up, then scale down
  gl.bindFramebuffer(gl.FRAMEBUFFER, r.framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, r.textures["A"], 0);
  render ( r, r.programs["scale"], [
    {name: "image", value: r.fixedTexture},
    {name: "scale", value: 2.1},
  ]);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, r.textures["B"], 0);
  render ( r, r.programs["scale"], [
    {name: "image", value: r.textures["A"]},
    {name: "scale", value: 1.0/2.1},
  ]);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  
  console.log("Showing fixed image")
  render ( r, r.displayProgram, [
    {name: "image", value: r.textures["B"]},
  ]);
}

