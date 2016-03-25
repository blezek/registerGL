

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

  register.textures["A"] = create_float_texture ( register, 512, 512 );
  register.textures["B"] = create_float_texture ( register, 512, 512 );

  // Summing textures
  var dim = 512;
  while ( dim > 1 ) {
    register.sumPyramid.push ( create_float_texture ( register, dim, dim ) );
    register.outPyramid.push ( create_texture ( register, dim, dim ) );
    dim = dim / 2.0;
  }
  
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
    register.programs["scale"] = program;
    return compile_program(gl, "shaders/register.vs", "shaders/sum.fs" );
  }).then(function(program){
    register.programs["sum"] = program;
    return compile_program(gl, "shaders/register.vs", "shaders/encode_float.fs" );
  }).then(function(program){
    register.programs["encode_float"] = program;
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
    {name: "scale", value: 2.0},
  ]);
  gl.bindFramebuffer(gl.FRAMEBUFFER, r.framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, r.textures["B"], 0);
  render ( r, r.programs["scale"], [
    {name: "image", value: r.textures["A"]},
    {name: "scale", value: 1.0/2.0},
  ]);




  // See if we can read pixels back from WebGL
  
  // Copy the texture into the highest level of the pyramid
  gl.bindFramebuffer(gl.FRAMEBUFFER, r.framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, r.sumPyramid[0], 0);
  render ( r, r.programs["sum"], [
    {name: "image", value: r.fixedTexture},
    {name: "count", value: 1},
    {name: "offset", value: 0.0},
  ]);

  var pixels;
  pixels = read_texture(r, r.fixedTexture, 512, 512);
  console.log("FixedTexture -- Pixel sum: ", pixels.reduce(function(a,b){return a+b;}));
  var pixels = read_texture(r, r.sumPyramid[0], 512, 512);
  console.log("Sum[0]       -- Pixel sum: ", pixels.reduce(function(a,b){return a+b;}));

  
  // Sum ...
  var dim = 256;
  var index = 0;
  while ( dim > 1 ) {
    var offset = 1.0 / (2.0*dim);
    console.log("Summing size " + dim + " into texture " + (index+1) + " offset is " + offset);
    gl.viewport(0,0,dim,dim);
    gl.bindFramebuffer(gl.FRAMEBUFFER, r.framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, r.sumPyramid[index+1], 0);
    render ( r, r.programs["sum"], [
      {name: "image", value: r.sumPyramid[index]},
      {name: "count", value: 2},
      {name: "offset", value: offset},
    ]);

    var pixels = read_texture(r, r.sumPyramid[index+1], dim, dim);
    console.log("Sum["+index+"]       -- Pixel sum: ", pixels.reduce(function(a,b){return a+b;}));

    dim = dim / 2.0;
    index = index + 1;
  }

  // var dim = 256;
  // var offset = 1.0 / (2.0*dim);
  // gl.viewport(0,0,dim,dim);
  // gl.bindFramebuffer(gl.FRAMEBUFFER, r.framebuffer);
  // gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, r.sumPyramid[1], 0);
  // render ( r, r.programs["sum"], [
  //   {name: "image", value: r.fixedTexture},
  //   {name: "count", value: 2},
  //   {name: "offset", value: offset},
  // ]);
  
  gl.viewport(0,0,512,512);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  
  console.log("Showing fixed image")
  render ( r, r.displayProgram, [
    {name: "image", value: r.sumPyramid[6]},
  ]);
}

